# HTML5 VideoCore prototype

This adds an opt-in **frame-blending** renderer to HTML5 VideoCore. It targets 60 canvas updates per second, processes at up to 720p, and blends successive decoded frames. This is not optical-flow or AI interpolation. Ghosting is possible and the visual output trails audio and separate subtitle overlays by approximately one source frame. Original playback speed, audio, tracking and seek controls remain with the video element.

## Integration

Ordinary Seanime plugins cannot execute this renderer. Plugin JavaScript runs in Goja on the server; plugin webviews use a sandboxed iframe without same-origin access to VideoCore. Consequently the official installed Denshi 3.10.3 cannot gain this backend by updating the FrameBoost manifest alone.

Apply it to a **Seanime 3.10.3 source checkout**, then build Denshi following its development instructions:

```sh
node scripts/integrate-html5.mjs /path/to/seanime
```

The script adds the renderer and type declarations to VideoCore, and a React effect that mounts an on/off button and cleans it up when the video is replaced. It rejects unknown source layouts or duplicate integration. FrameBoost starts off. Choose HTML5 VideoCore in the custom build, start playback and click **FrameBoost: off** to enable blending. Hover over the button for status. Stop it by clicking again.

Native video captions, protected video, another canvas renderer such as Anime4K, and picture-in-picture fall back to the original video. Pause, seeking, tab hiding and source replacement reset frame buffers. Custom Denshi binaries and real laptop performance have not been validated yet; the component lifecycle and rendering clock are covered by automated tests. A real headless Edge smoke test passed with a synthetic 24 FPS canvas video: visible decoded-frame output, on/off control, cleanup, and no page errors.

Run the optional browser smoke test with an installed Playwright package:

```sh
node scripts/smoke-html5.cjs /path/to/node_modules/playwright
```

For higher quality motion interpolation, a future WebGPU optical-flow or neural backend and a supported renderer bridge are still required. A 60 FPS canvas target alone does not establish achieved smooth motion or 60 unique motion frames per second.
