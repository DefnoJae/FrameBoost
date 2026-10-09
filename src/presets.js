// Shared by the Seanime payload builder and tests. No GPU acceleration is claimed.
export const FILTER_LABEL = "frameboost";
export const presets = {
  motion: {
    name: "60 FPS motion interpolation (experimental)",
    graph: "minterpolate=fps=60:mi_mode=mci:mc_mode=obmc:me_mode=bilat:me=epzs:vsbmc=0",
    description: "Generates motion frames using CPU processing. Start with 720p; 1080p may stutter. Requires the bundled minterpolate filter.",
  },
  blend: {
    name: "60 FPS frame blending",
    graph: "minterpolate=fps=60:mi_mode=blend",
    description: "Blends adjacent frames. Lower processing cost, but can cause ghosting; does not estimate motion.",
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
