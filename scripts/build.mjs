import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { configFor, presets } from '../src/presets.js';
import { buildPayload } from './payload.mjs';
const base = new URL('../', import.meta.url);
// Releases are pushed directly to main; Seanime re-fetches this URI on install.
const ref = 'main';
const packageInfo = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
const rawBase = 'https://raw.githubusercontent.com/DefnoJae/FrameBoost/' + ref;
const manifest = {
  id: 'frameboost', name: 'FrameBoost', version: packageInfo.version,
  manifestURI: rawBase + '/Manifest.json',
  language: 'javascript', type: 'plugin', lang: 'en', author: 'DefnoJae',
  description: 'Experimental 60/144 FPS MPV presets and external MPV filter controls. Built-in MpvCore requires manual configuration.',
  icon: rawBase + '/assets/icon.svg',
  website: 'https://github.com/DefnoJae/FrameBoost',
  readme: 'https://github.com/DefnoJae/FrameBoost/blob/' + ref + '/README.md',
  notes: 'CPU MPV interpolation; real-time 1080p playback is not guaranteed. HTML5 blending prototype requires a custom Denshi build; updating this plugin alone does not enable HTML5 processing.',
  plugin: { version: '1', permissions: { scopes: ['playback'] } },
  payload: await buildPayload(),
};
await writeFile(new URL('Manifest.json', base), JSON.stringify(manifest, null, 2) + '\n');
await mkdir(new URL('presets/', base), { recursive: true });
for (const id of Object.keys(presets)) {
  const name = id.replace(/144$/, '') + '-' + presets[id].fps + '.conf';
  await writeFile(new URL('presets/' + name, base), configFor(id));
}
console.log('Built Manifest.json and MPV presets.');
