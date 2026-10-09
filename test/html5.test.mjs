import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFrameBoost, blendAmount } from '../html5/frameboost.js';

function fixture() {
  const events = new Map(), frames = new Map(), paints = new Map(), surfaces = [];
  let id = 0, observed = false, disconnected = false;
  const doc = {
    hidden: false, pictureInPictureElement: null,
    addEventListener(name, fn) { events.set('doc:' + name, fn); },
    removeEventListener(name) { events.delete('doc:' + name); },
    createElement() {
      const calls = [];
      const surface = { dataset: {}, style: {}, calls, removed: false,
        setAttribute() {}, remove() { this.removed = true; },
        getContext() { return { globalAlpha: 1, drawImage(...args) { calls.push({ alpha: this.globalAlpha, args }); } }; },
      };
      surfaces.push(surface); return surface;
    },
  };
  doc.defaultView = {
    getComputedStyle: () => ({ objectFit: 'contain', objectPosition: 'center', filter: 'none' }),
    requestAnimationFrame(fn) { const key = ++id; paints.set(key, fn); return key; },
    cancelAnimationFrame(key) { paints.delete(key); },
    ResizeObserver: class { observe() { observed = true; } disconnect() { disconnected = true; } },
  };
  const video = {
    ownerDocument: doc, parentElement: { querySelector: () => null },
    videoWidth: 1920, videoHeight: 1080, clientWidth: 960, clientHeight: 540,
    offsetLeft: 0, offsetTop: 0, playbackRate: 1, paused: false, ended: false, seeking: false,
    readyState: 4, textTracks: [], mediaKeys: null, after() {},
    addEventListener(name, fn) { events.set(name, fn); },
    removeEventListener(name) { events.delete(name); },
    requestVideoFrameCallback(fn) { const key = ++id; frames.set(key, fn); return key; },
    cancelVideoFrameCallback(key) { frames.delete(key); },
  };
  function run(queue, ...args) {
    const [key, fn] = queue.entries().next().value;
    queue.delete(key); fn(...args);
  }
  return { video, doc, frames, paints, surfaces, events,
    capture: (t, mediaTime) => run(frames, t, { mediaTime, expectedDisplayTime: t }),
    paint: t => run(paints, t),
    observed: () => observed, disconnected: () => disconnected,
  };
}

test('blend weights are bounded, including startup and stale timestamps', () => {
  assert.equal(blendAmount(10, 20, 40), 0);
  assert.equal(blendAmount(40, 20, 40), 0.5);
  assert.equal(blendAmount(100, 20, 40), 1);
  assert.equal(blendAmount(10, 20, 0), 1);
});
test('HTML5 backend starts off, blends buffered frames and caps resolution', () => {
  const f = fixture();
  const controller = attachFrameBoost(f.video);
  assert.equal(f.frames.size, 0);
  assert.ok(f.observed());
  assert.equal(controller.setEnabled(true), true);
  f.capture(100, 0); f.paint(100);
  assert.equal(f.surfaces[0].style.display, 'none');
  f.capture(140, 0.04); f.paint(160);
  assert.equal(f.surfaces[0].width, 1280);
  assert.equal(f.surfaces[0].height, 720);
  assert.equal(f.surfaces[0].style.display, 'block');
  assert.equal(f.surfaces[0].calls.at(-1).alpha, 0.5);
  const count = f.surfaces[0].calls.length;
  f.paint(162); // Same 60 Hz bucket on a high refresh display.
  assert.equal(f.surfaces[0].calls.length, count);
  controller.destroy();
  assert.equal(f.frames.size, 0); assert.equal(f.paints.size, 0);
  assert.equal(f.events.size, 0); assert.ok(f.disconnected());
  assert.ok(f.surfaces[0].removed);
});
test('seeking and pause cancel processing and show original video', () => {
  const f = fixture(); const controller = attachFrameBoost(f.video);
  controller.setEnabled(true);
  f.events.get('seeking')();
  assert.equal(f.frames.size, 0); assert.equal(f.paints.size, 0);
  assert.equal(f.surfaces[0].style.display, 'none');
  f.events.get('seeked')(); assert.equal(f.frames.size, 1);
  f.video.paused = true; f.events.get('pause')();
  assert.equal(f.frames.size, 0);
  controller.destroy();
});
test('native captions and conflicting canvas renderer bypass interpolation', () => {
  const f = fixture(); const controller = attachFrameBoost(f.video);
  f.video.textTracks = [{ mode: 'showing' }];
  assert.equal(controller.setEnabled(true), false);
  f.video.textTracks = [];
  f.video.parentElement.querySelector = () => ({});
  assert.equal(controller.setEnabled(true), false);
  assert.equal(f.frames.size, 0);
  controller.destroy();
});
test('source discontinuities discard the old frame pair', () => {
  const f = fixture(); const controller = attachFrameBoost(f.video);
  controller.setEnabled(true); f.capture(100, 0); f.capture(140, 0.04);
  f.capture(180, 50); f.paint(180);
  assert.equal(f.surfaces[0].style.display, 'none');
  controller.destroy();
});
test('unsupported video callbacks leave original playback untouched', () => {
  const f = fixture(); delete f.video.requestVideoFrameCallback;
  assert.equal(attachFrameBoost(f.video).setEnabled(true), false);
  assert.equal(f.surfaces.length, 0);
});
