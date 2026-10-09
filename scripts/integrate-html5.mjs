import { readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/integrate-html5.mjs <Seanime-source-directory>');
const directory = path.join(path.resolve(root), 'seanime-web/src/app/(main)/_features/video-core');
const target = path.join(directory, 'video-core.tsx');
const original = await readFile(target, 'utf8');
const anchor = '    const [videoElement, setVideoElement] = useAtom(vc_videoElement)';
const marker = '// FrameBoost HTML5 integration';
if (original.includes(marker)) throw new Error('FrameBoost is already integrated; no files changed');
if (original.split(anchor).length !== 2) throw new Error('Unsupported Seanime source layout; no files changed');
const effect = '\n    ' + marker + '\n    React.useEffect(() => {\n'
  + '        if (!videoElement) return\n'
  + '        return mountFrameBoostControls(videoElement)\n'
  + '    }, [videoElement])\n';
await copyFile(new URL('../html5/frameboost.js', import.meta.url), path.join(directory, 'frameboost.js'));
await copyFile(new URL('../html5/frameboost.d.ts', import.meta.url), path.join(directory, 'frameboost.d.ts'));
await writeFile(target, 'import { mountFrameBoostControls } from "./frameboost"\n' + original.replace(anchor, anchor + effect));
console.log('Integrated opt-in HTML5 blending into VideoCore. Build Denshi from this checkout; official installed binaries are unchanged.');
