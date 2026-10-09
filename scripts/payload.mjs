import { readFile } from 'node:fs/promises';
export async function buildPayload() {
  const base = new URL('../', import.meta.url);
  const helpers = (await readFile(new URL('src/presets.js', base), 'utf8')).replace(/^export /gm, '');
  const plugin = await readFile(new URL('src/plugin.js', base), 'utf8');
  const marker = '/* FRAMEBOOST_PRESETS */';
  if (plugin.split(marker).length !== 2) throw new Error('Expected exactly one UI helper insertion marker');
  return plugin.replace(marker, helpers);
}
