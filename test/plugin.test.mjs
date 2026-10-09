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
  const tray = { close() {}, update() {}, render(fn) { fn(); } };
  for (const name of ['text', 'input', 'button', 'select']) tray[name] = () => {};
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
  return { handlers, calls, messages, filters, refs };
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
  assert.equal(manifest.version, '0.1.1');
});
