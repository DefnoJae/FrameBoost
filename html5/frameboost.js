/** HTML5 prototype. Runs in the player renderer, never in Seanime's Goja plugin VM. */
export function blendAmount(now, displayedAt, frameDurationMs) {
  if (!(frameDurationMs > 0)) return 1;
  return Math.max(0, Math.min(1, (now - displayedAt) / frameDurationMs));
}

export function attachFrameBoost(video, { targetFps = 60, maxHeight = 720, onStatus = () => {} } = {}) {
  if (targetFps !== 60 || !Number.isFinite(maxHeight) || maxHeight < 1) throw new Error('Invalid FrameBoost options');
  const doc = video.ownerDocument;
  const win = doc.defaultView;
  const parent = video.parentElement;
  if (!parent || !video.requestVideoFrameCallback || !video.cancelVideoFrameCallback) {
    onStatus('Unsupported: video frame callbacks are unavailable');
    return { setEnabled() { return false; }, destroy() {} };
  }
  const canvas = doc.createElement('canvas');
  const previous = doc.createElement('canvas');
  const current = doc.createElement('canvas');
  const output = canvas.getContext('2d', { alpha: false });
  const prev = previous.getContext('2d', { alpha: false });
  const next = current.getContext('2d', { alpha: false });
  if (!output || !prev || !next) {
    onStatus('Unsupported: Canvas 2D unavailable');
    return { setEnabled() { return false; }, destroy() {} };
  }
  canvas.dataset.frameboost = 'html5';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none', display: 'none', objectFit: 'contain' });
  // No z-index: subsequent subtitle/overlay siblings retain their existing order.
  video.after(canvas);
  let enabled = false, destroyed = false, frameId = null, paintId = null;
  let mediaTime = null, displayedAt = 0, durationMs = 1000 / 24, pairs = 0, lastBucket = -1;
  let width = 0, height = 0;
  const listeners = [];

  function report(message) { onStatus(message); }
  function layout() {
    const style = win.getComputedStyle(video);
    Object.assign(canvas.style, {
      left: video.offsetLeft + 'px', top: video.offsetTop + 'px',
      width: video.clientWidth + 'px', height: video.clientHeight + 'px',
      objectFit: style.objectFit, objectPosition: style.objectPosition, filter: style.filter,
      borderRadius: style.borderRadius,
    });
  }
  function clear() {
    mediaTime = null; pairs = 0; lastBucket = -1;
    canvas.style.display = 'none';
  }
  function cancel() {
    if (frameId !== null) video.cancelVideoFrameCallback(frameId);
    if (paintId !== null) win.cancelAnimationFrame(paintId);
    frameId = paintId = null;
  }
  function bypassReason() {
    if (doc.pictureInPictureElement === video) return 'Picture-in-picture uses the original video';
    if (Array.from(video.textTracks || []).some(track => track.mode === 'showing')) return 'Native captions active; using original video to preserve subtitles';
    if (parent.querySelector('canvas:not([data-frameboost])')) return 'Another canvas renderer is active; disable Anime4K before enabling FrameBoost';
    if (video.mediaKeys) return 'Protected playback uses the original video';
    return '';
  }
  function capture(now, metadata) {
    frameId = null;
    if (!enabled || destroyed) return;
    try {
      const reason = bypassReason();
      if (reason) { enabled = false; cancel(); clear(); report(reason); return; }
      const ratio = Math.min(1, maxHeight / video.videoHeight);
      const w = Math.max(1, Math.round(video.videoWidth * ratio));
      const h = Math.max(1, Math.round(video.videoHeight * ratio));
      if (!video.videoWidth || !video.videoHeight) { clear(); }
      else {
        if (w !== width || h !== height) {
          width = w; height = h;
          for (const surface of [canvas, previous, current]) { surface.width = w; surface.height = h; }
          clear(); layout();
        }
        const delta = mediaTime === null ? 0 : metadata.mediaTime - mediaTime;
        if (delta <= 0 || delta > 0.2) clear();
        else {
          prev.drawImage(current, 0, 0);
          durationMs = delta * 1000 / Math.max(0.01, video.playbackRate);
          pairs++;
        }
        next.drawImage(video, 0, 0, width, height);
        mediaTime = metadata.mediaTime;
        displayedAt = metadata.expectedDisplayTime || now;
      }
      frameId = video.requestVideoFrameCallback(capture);
    } catch (error) {
      enabled = false; cancel(); clear(); report('Frame capture failed: ' + error.message);
    }
  }
  function paint(now) {
    paintId = null;
    if (!enabled || destroyed) return;
    // Quantize to a 60 Hz clock; rAF itself follows the monitor (e.g. 144 Hz).
    const bucket = Math.floor(now * targetFps / 1000);
    if (pairs && bucket !== lastBucket && !video.paused && !video.seeking && video.readyState >= 2) {
      lastBucket = bucket;
      output.globalAlpha = 1;
      output.drawImage(previous, 0, 0);
      output.globalAlpha = blendAmount(now, displayedAt, durationMs);
      output.drawImage(current, 0, 0);
      output.globalAlpha = 1;
      canvas.style.display = 'block';
    }
    paintId = win.requestAnimationFrame(paint);
  }
  function start() {
    cancel(); clear();
    if (!enabled || video.paused || video.ended || doc.hidden) return;
    frameId = video.requestVideoFrameCallback(capture);
    paintId = win.requestAnimationFrame(paint);
  }
  function suspend() { cancel(); clear(); }
  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    listeners.push(() => target.removeEventListener(event, callback));
  }
  listen(video, 'play', start);
  listen(video, 'pause', suspend);
  listen(video, 'ended', suspend);
  listen(video, 'waiting', suspend);
  listen(video, 'canplay', start);
  listen(video, 'seeking', suspend);
  listen(video, 'seeked', start);
  listen(video, 'emptied', suspend);
  listen(video, 'loadeddata', start);
  listen(video, 'ratechange', start);
  listen(video, 'enterpictureinpicture', suspend);
  listen(video, 'leavepictureinpicture', start);
  listen(doc, 'visibilitychange', () => doc.hidden ? suspend() : start());
  const observer = new win.ResizeObserver(layout);
  observer.observe(video);
  layout();
  return {
    setEnabled(value) {
      if (destroyed) return false;
      const reason = value ? bypassReason() : '';
      enabled = Boolean(value) && !reason;
      start();
      report(reason || (enabled ? 'HTML5 blending enabled; 60 FPS target, up to 720p processing, about one source-frame visual delay' : 'HTML5 blending off'));
      return enabled;
    },
    destroy() {
      destroyed = true; enabled = false; cancel(); clear();
      observer.disconnect(); listeners.forEach(remove => remove()); canvas.remove();
      for (const surface of [canvas, previous, current]) { surface.width = surface.height = 0; }
    },
  };
}

/** Mount an opt-in toggle beside the existing VideoCore video. No autoplay changes. */
export function mountFrameBoostControls(video) {
  const doc = video.ownerDocument;
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'FrameBoost: off';
  button.setAttribute('aria-pressed', 'false');
  Object.assign(button.style, { position: 'absolute', left: '12px', top: '12px', zIndex: '50',
    background: '#171c2e', color: '#8ef0ce', border: '1px solid #8ef0ce', borderRadius: '8px', padding: '8px' });
  let active = false;
  const backend = attachFrameBoost(video, { onStatus(message) {
    button.title = message;
    if (!message.startsWith('HTML5 blending enabled')) {
      active = false; button.textContent = 'FrameBoost: off'; button.setAttribute('aria-pressed', 'false');
    }
  } });
  button.addEventListener('click', event => {
    event.stopPropagation();
    active = backend.setEnabled(!active);
    button.textContent = active ? 'FrameBoost: blend 60' : 'FrameBoost: off';
    button.setAttribute('aria-pressed', String(active));
  });
  video.parentElement.append(button);
  return () => { backend.destroy(); button.remove(); };
}
