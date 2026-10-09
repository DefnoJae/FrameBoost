import { writeFile, mkdir } from 'node:fs/promises';
import { configFor } from '../src/presets.js';
import { buildPayload } from './payload.mjs';
const base = new URL('../', import.meta.url);
// Seanime fetches manifestURI again during installation. Keep this development
// manifest on its own branch so preview installs cannot fall back to stale main.
const ref = 'codex/frameboost-first-version';
const rawBase = 'https://raw.githubusercontent.com/DefnoJae/FrameBoost/' + ref;
const manifest = {
  id: 'frameboost', name: 'FrameBoost', version: '0.1.2',
  manifestURI: rawBase + '/Manifest.json',
  language: 'javascript', type: 'plugin', lang: 'en', author: 'DefnoJae',
  description: 'Experimental 60 FPS MPV presets and external MPV filter controls. Built-in MpvCore requires manual configuration.',
  icon: rawBase + '/assets/icon.svg',
  website: 'https://github.com/DefnoJae/FrameBoost',
  readme: 'https://github.com/DefnoJae/FrameBoost/blob/' + ref + '/README.md',
  notes: 'CPU interpolation; GPU acceleration and real-time 1080p playback are not guaranteed. Built-in playback has no live plugin toggle.',
  plugin: { version: '1', permissions: { scopes: ['playback'] } },
  payload: await buildPayload(),
};
await writeFile(new URL('Manifest.json', base), JSON.stringify(manifest, null, 2) + '\n');
await mkdir(new URL('presets/', base), { recursive: true });
for (const id of ['motion', 'blend']) await writeFile(new URL('presets/' + id + '-60.conf', base), configFor(id));
console.log('Built Manifest.json and MPV presets.');
