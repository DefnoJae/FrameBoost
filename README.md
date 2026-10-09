# FrameBoost

Experimental 60 FPS playback tools for **Seanime Denshi 3.10.3**.

## What works in this first version

- An installable Seanime tray plugin with motion-interpolation and frame-blending presets.
- Configuration snippets for Denshi's built-in **MpvCore** player.
- Enable/disable controls for Seanime's **external MPV** connection, preserving other filters.

**The built-in player requires copying the preset into Custom MPV Options. Its public plugin API has no arbitrary filter command, so the tray's live controls only target external MPV.** There is no AI model or Radeon GPU interpolation backend in this release. Do not expect a guaranteed real-time 1080p result.

## Install

In Seanime's Extensions screen, add this manifest URL:

```text
https://raw.githubusercontent.com/DefnoJae/FrameBoost/main/Manifest.json
```

Enable the plugin and grant its playback permission. Open FrameBoost's tray icon.

Releases are pushed directly to `main`, with the generated manifest updated on every release. Verify the installed version is **0.1.5**. If you installed from the former preview branch, reinstall using the URL above so future updates follow `main`.

Version 0.1.5 explains the HTML5 custom-build requirement directly in the tray and disables external MPV controls when no external connection exists. They cannot activate interpolation in either built-in player.

Version 0.1.3 fixes the tray's empty component type by returning a stack of component descriptors from the render callback. Tests validate the returned tree on first render and after updates.

## Built-in Denshi player

1. In Settings → Video Playback, enable the libmpv-based built-in player (MpvCore).
2. Choose a preset in FrameBoost and copy its configuration into **Custom MPV Options**. Preserve your existing configuration. Place the block before any `[profile]` sections and add it only once.
3. Stop playback and reopen the episode; Denshi captures this configuration when its player mounts.
4. Test with 720p first. Pause/resume, seek, check audio sync, and play a fast camera pan. A configured 60 FPS target does not prove the laptop can process frames quickly enough.
5. To disable, remove the FrameBoost block and stop/reopen playback. Restore your previous `hwdec` option if you changed it.

The preset uses `hwdec=auto-copy` to make decoded frames accessible to the CPU filter. Motion estimation is CPU-based. The RX 6550M is not being used as an AI interpolation accelerator. Frame blending costs less but may produce ghosting.

If playback fails with a missing `minterpolate` filter, this libmpv build lacks the needed FFmpeg filter. Remove the block. If playback stutters, try the blend preset or disable FrameBoost. Avoid stacking interpolation with expensive upscaling while evaluating performance.

## External MPV

Configure external MPV in Seanime and start a video there. FrameBoost can attach a labeled filter and remove just that filter. It does not change playback speed or automatically enable itself on future episodes. Attachment is checked through MPV's `vf` property; it does not measure achieved FPS. Hardware decoding that cannot supply CPU frames may need an `auto-copy` configuration in external MPV.

## HTML5 support prototype

An opt-in HTML5 VideoCore frame-blending backend is available in `html5/`. It requires a source integration and custom Denshi build; updating the ordinary FrameBoost plugin does not enable it in official Denshi. See [HTML5 setup and limitations](html5/README.md). This first renderer is frame blending, not motion-estimated interpolation.

## Development and validation

Requires Node.js 20+. No dependencies.

```sh
npm run build
npm test
```

`Manifest.json` embeds the payload; rebuild it after editing `src/`. Tests exercise the actual plugin callbacks in a mock of Seanime's API, including disconnected players, unsupported filters, duplicate activation, and preserving other filters. Live Denshi playback and hardware performance still need validation.

Version 0.1.1 fixes startup in Seanime's separate UI runtime. Preset helpers are embedded inside the registered callback; tests serialize that callback into a fresh VM just as Seanime does. Reload or reinstall the updated manifest if version 0.1.0 reports `configFor is not defined`.

Implementation references: [Seanime 3.10.3 source](https://github.com/5rahim/seanime/tree/v3.10.3), [MPV filters](https://mpv.io/manual/stable/#video-filters), [FFmpeg minterpolate](https://ffmpeg.org/ffmpeg-filters.html#minterpolate).
