// Shared by the Seanime payload builder and tests. No GPU acceleration is claimed.
export const FILTER_LABEL = "frameboost";
export const presets = {
  motion: {
    fps: 60,
    name: "60 FPS motion interpolation (experimental)",
    graph: "minterpolate=fps=60:mi_mode=mci:mc_mode=obmc:me_mode=bilat:me=epzs:vsbmc=0",
    description: "Generates motion frames using CPU processing. Start with 720p; 1080p may stutter. Requires the bundled minterpolate filter.",
  },
  blend: {
    fps: 60,
    name: "60 FPS frame blending",
    graph: "minterpolate=fps=60:mi_mode=blend",
    description: "Blends adjacent frames. Lower processing cost, but can cause ghosting; does not estimate motion.",
  },
  blend144: {
    fps: 144,
    name: "144 FPS frame blending (experimental)",
    graph: "minterpolate=fps=144:mi_mode=blend",
    description: "Targets a 144 Hz screen using frame blending. Does not generate motion detail. More output frames can increase drops; compare a fresh playback session with 60 FPS.",
  },
  motion144: {
    fps: 144,
    name: "144 FPS motion interpolation (heavy CPU load)",
    graph: "minterpolate=fps=144:mi_mode=mci:mc_mode=obmc:me_mode=bilat:me=epzs:vsbmc=0",
    description: "Estimates motion for 144 FPS output using CPU processing. Try 720p first. 1080p may not keep up; return to 60 FPS if frames drop or audio drifts.",
  },
};

export function getPreset(id) {
  if (!Object.prototype.hasOwnProperty.call(presets, id)) throw new Error("Unknown FrameBoost preset");
  return presets[id];
}

export function filterSpec(id) {
  return "@" + FILTER_LABEL + ":lavfi=[" + getPreset(id).graph + "]";
}

export function configFor(id) {
  return "# FrameBoost: " + getPreset(id).name + "\n"
    + "# Remove this block to disable; stop and reopen playback after changing.\n"
    + "hwdec=auto-copy\n"
    + "vf-add=" + filterSpec(id) + "\n";
}
