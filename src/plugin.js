// Seanime serializes this callback into a separate UI runtime.
$ui.register(function (ctx) {
  /* FRAMEBOOST_PRESETS */
  var selected = ctx.fieldRef("motion");
  var config = ctx.fieldRef(configFor("motion"));
  var status = "Built-in MpvCore: paste the configuration below into Custom MPV Options.";
  var tray = ctx.newTray({
    iconUrl: "https://raw.githubusercontent.com/DefnoJae/FrameBoost/main/assets/icon.svg",
    withContent: true,
    width: "430px",
  });

  function fail(error) {
    status = "FrameBoost: " + (error && error.message ? error.message : String(error));
    ctx.toast.error(status);
    tray.update();
  }

  function connection() {
    var conn = ctx.mpv.getConnection();
    if (!conn || conn.isClosed()) {
      throw new Error("No external MPV connection. For built-in MpvCore, use the configuration below.");
    }
    return conn;
  }

  function hasFilter(conn) {
    var filters = conn.get("vf");
    if (!Array.isArray(filters)) throw new Error("Could not read MPV filters; no change made.");
    return filters.some(function (item) { return item.label === FILTER_LABEL; });
  }

  selected.onValueChange(function (id) {
    config.setValue(configFor(id));
    tray.update();
  });

  var enable = ctx.eventHandler("frameboost-enable", function () {
    try {
      var conn = connection();
      // Do not replace the existing vf chain, decoder, speed, or sync options.
      if (hasFilter(conn)) throw new Error("FrameBoost is already attached. Disable it before changing presets.");
      conn.call("vf", "add", filterSpec(selected.current));
      if (!hasFilter(conn)) throw new Error("MPV did not attach the filter. Check its logs for minterpolate support.");
      status = "FrameBoost filter attached to external MPV. Target: 60 FPS; real-time performance is not verified.";
      ctx.toast.info(status);
      tray.update();
    } catch (error) { fail(error); }
  });

  var disable = ctx.eventHandler("frameboost-disable", function () {
    try {
      var conn = connection();
      if (hasFilter(conn)) conn.call("vf", "remove", "@" + FILTER_LABEL);
      if (hasFilter(conn)) throw new Error("MPV did not remove the FrameBoost filter.");
      status = "FrameBoost is off in external MPV. Other filters were preserved.";
      ctx.toast.info(status);
      tray.update();
    } catch (error) { fail(error); }
  });

  var settings = ctx.eventHandler("frameboost-settings", function () {
    ctx.screen.navigateTo("/settings", { tab: "playback" });
    tray.close();
  });

  tray.render(function () {
    tray.text("FrameBoost", { style: { fontSize: "20px", fontWeight: "700" } });
    tray.text("Experimental • Seanime Denshi 3.10.3");
    tray.select({ label: "Preset", fieldRef: selected, options: Object.keys(presets).map(function (id) {
      return { value: id, label: presets[id].name };
    }) });
    tray.text(getPreset(selected.current).description);
    tray.text("Built-in MpvCore setup");
    tray.text("Copy this block into Settings → Video Playback → Custom MPV Options, above any [profile] sections. Add it once. Stop and reopen the video. Remove the block to disable.");
    tray.input({ label: "MPV configuration (select and copy)", fieldRef: config, textarea: true });
    tray.button({ label: "Open playback settings", onClick: settings });
    tray.text("External MPV controls");
    tray.button({ label: "Enable selected preset", onClick: enable });
    tray.button({ label: "Disable FrameBoost", onClick: disable });
    tray.text(status);
  });
});
