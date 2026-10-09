import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { configFor, filterSpec } from '../src/presets.js';
import { buildPayload } from '../scripts/payload.mjs';

const root = new URL('../', import.meta.url);
const source = await buildPayload();

function setup({ connected = true, supported = true, filters = [{ name: 'scale', label: 'existing' }] } = {}) {
  const handlers = {}, calls = [], messages = [], refs = [];
  const conn = {
    isClosed: () => false,
    get: () => filters,
    call: (...args) => {
      calls.push(args);
      if (args[1] === 'add' && supported) filters.push({ name: 'lavfi', label: 'frameboost' });
      if (args[1] === 'remove') filters.splice(filters.findIndex(f => f.label === 'frameboost'), 1);
    },
  };
  let renderFn, rendered;
  function render() {
    rendered = renderFn();
    assert.ok(rendered && rendered.type, 'Tray render must return a component descriptor');
    for (const child of rendered.props.items) assert.ok(child && child.type, 'Every child needs a component type');
  }
  const tray = { close() {}, onOpen() {}, update() { render(); }, render(fn) { renderFn = fn; render(); } };
  for (const name of ['text', 'input', 'button', 'select', 'stack']) tray[name] = (props, extra) => ({
    type: name, props: typeof props === 'string' ? { text: props, ...extra } : props,
  });
  const ctx = {
    fieldRef(value) { const ref = { current: value, setValue(v) { this.current = v; }, onValueChange(fn) { this.change = fn; } }; refs.push(ref); return ref; },
    newTray: () => tray,
    eventHandler(id, fn) { handlers[id] = fn; return id; },
    mpv: { getConnection: () => connected ? conn : undefined },
    toast: { error: m => messages.push(m), info: m => messages.push(m) },
    screen: { navigateTo() {} },
  };
  // Match Seanime's serialization into a separate VM without loader globals.
  vm.runInNewContext(source, { $ui: { register: fn => {
    vm.runInNewContext('(' + fn.toString() + ')(__ctx)', { __ctx: ctx });
  } } });
  return { handlers, calls, messages, filters, refs, tree: () => rendered };
}

test('built-in configuration requests motion frames and a labeled append', () => {
  assert.match(configFor('motion'), /hwdec=auto-copy/);
  assert.match(configFor('motion'), /vf-add=@frameboost:lavfi=\[minterpolate=fps=60:mi_mode=mci/);
  assert.throws(() => filterSpec('__proto__'), /Unknown/);
});
test('external enable then disable preserves unrelated filters', () => {
  const s = setup();
  s.handlers['frameboost-enable']();
  assert.equal(s.filters.length, 2);
  s.handlers['frameboost-disable']();
  assert.deepEqual(s.filters, [{ name: 'scale', label: 'existing' }]);
  assert.deepEqual(s.calls.map(c => c[1]), ['add', 'remove']);
});
test('disconnected built-in player never invokes external commands', () => {
  const s = setup({ connected: false });
  s.handlers['frameboost-enable']();
  assert.equal(s.calls.length, 0);
  assert.match(s.messages[0], /built-in MpvCore/);
});
test('unsupported filter does not report successful attachment', () => {
  const s = setup({ supported: false });
  s.handlers['frameboost-enable']();
  assert.match(s.messages[0], /did not attach/);
  assert.equal(s.filters.length, 1);
});
test('duplicate enable is rejected without replacing filters', () => {
  const s = setup();
  s.handlers['frameboost-enable']();
  s.handlers['frameboost-enable']();
  assert.equal(s.calls.length, 1);
  assert.match(s.messages[1], /already attached/);
});
test('preset selection updates the built-in configuration', () => {
  const s = setup();
  s.refs[0].current = 'blend';
  s.refs[0].change('blend');
  assert.match(s.refs[1].current, /mi_mode=blend/);
  s.handlers['frameboost-enable']();
  assert.match(s.calls[0][2], /mi_mode=blend/);
});
test('disable when already off makes no mutation', () => {
  const s = setup();
  s.handlers['frameboost-disable']();
  assert.equal(s.calls.length, 0);
});

test('distributed manifest contains the isolated-VM-safe payload', () => {
  const manifest = JSON.parse(readFileSync(new URL('Manifest.json', root), 'utf8'));
  assert.equal(manifest.payload, source);
  const packageInfo = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.version, packageInfo.version);
});

test('release installation and resources stay on main', () => {
  const manifest = JSON.parse(readFileSync(new URL('Manifest.json', root), 'utf8'));
  const branchBase = 'https://raw.githubusercontent.com/DefnoJae/FrameBoost/main/';
  assert.equal(manifest.manifestURI, branchBase + 'Manifest.json');
  assert.equal(manifest.icon, branchBase + 'assets/icon.svg');
  assert.ok(manifest.payload.includes(branchBase + 'assets/icon.svg'));
});

test('tray returns a component tree with controls and updates its status', () => {
  const s = setup();
  assert.equal(s.tree().type, 'stack');
  assert.equal(s.tree().props.items.length, 13);
  assert.equal(s.tree().props.items.filter(c => c.type === 'button').length, 3);
  assert.equal(s.tree().props.items.find(c => c.type === 'input').props.textarea, true);
  s.handlers['frameboost-enable']();
  assert.match(s.tree().props.items.at(-1).props.text, /filter attached/);
  s.handlers['frameboost-disable']();
  assert.match(s.tree().props.items.at(-1).props.text, /is off/);
});

test('disconnected MPV disables live controls and explains HTML5 requirements', () => {
  const s = setup({ connected: false });
  const items = s.tree().props.items;
  const buttons = items.filter(c => c.type === 'button' && c.props.onClick !== 'frameboost-settings');
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(c => c.props.disabled === true));
  assert.ok(items.some(c => c.props.text?.includes('HTML5 blending requires a custom Denshi build')));
});

test('144 FPS selection updates built-in config and external filter and status', () => {
  const s = setup();
  s.refs[0].current = 'blend144'; s.refs[0].change('blend144');
  assert.match(s.refs[1].current, /fps=144:mi_mode=blend/);
  s.handlers['frameboost-enable']();
  assert.match(s.calls[0][2], /fps=144:mi_mode=blend/);
  assert.match(s.messages.at(-1), /Target: 144 FPS/);
  assert.match(configFor('motion144'), /fps=144:mi_mode=mci/);
});

test('144 presets are distributed and default remains 60 FPS', () => {
  assert.equal(readFileSync(new URL('presets/blend-144.conf', root), 'utf8'), configFor('blend144'));
  assert.equal(readFileSync(new URL('presets/motion-144.conf', root), 'utf8'), configFor('motion144'));
  const s = setup();
  assert.match(s.refs[1].current, /fps=60:/);
});
