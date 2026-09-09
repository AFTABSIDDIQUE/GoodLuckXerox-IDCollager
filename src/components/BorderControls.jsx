function BorderControls({
  pxToMm,
  grid,
  borderEnabled,
  setBorderEnabled,
  BORDER_MIN_MM,
  BORDER_MAX_MM,
  BORDER_STEP_MM,
  borderWidthMm,
  setBorderWidthMm,
  borderSliderFillPct,
  borderRounded,
  setBorderRounded,
  borderRadiusMm,
  setBorderRadiusMm,
  borderRadiusSliderFillPct,
  setA4Pages,
}) {
  return (
          <section className="panel-section">

            <div className="panel-section-title">
              <span className="eyebrow">
                03
              </span>
              Border
            </div>

            <div className="toggle-row">

              <div className="toggle-row-text">
                <span className="toggle-row-title">
                  Add a frame border
                </span>
                <span className="toggle-row-sub">
                  Draws a black line around each printed photo
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={borderEnabled}
                className={`switch ${
                  borderEnabled ? "on" : ""
                }`}
                onClick={() => {
                  setBorderEnabled(
                    (previous) => !previous
                  );

                  setA4Pages([]);
                }}
              >
                <span className="switch-knob" />
              </button>

            </div>

            {borderEnabled && (
              <div className="border-thickness-panel">

                <div className="border-thickness-label">
                  <span>Thickness</span>
                  <span className="mono">
                    {borderWidthMm.toFixed(1)}mm
                  </span>
                </div>

                <input
                  type="range"
                  className="border-slider"
                  min={BORDER_MIN_MM}
                  max={BORDER_MAX_MM}
                  step={BORDER_STEP_MM}
                  value={borderWidthMm}
                  style={{
                    "--slider-fill": `${borderSliderFillPct}%`,
                  }}
                  onChange={(event) => {
                    setBorderWidthMm(
                      Number(event.target.value)
                    );

                    setA4Pages([]);
                  }}
                  aria-label="Border thickness"
                />

                <div className="border-slider-ticks">
                  <span>{BORDER_MIN_MM}mm</span>
                  <span>{BORDER_MAX_MM}mm</span>
                </div>

              </div>
            )}

            <div className="toggle-row">

              <div className="toggle-row-text">
                <span className="toggle-row-title">
                  Rounded corners
                </span>
                <span className="toggle-row-sub">
                  Rounds the corners of each photo and its
                  border
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={borderRounded}
                className={`switch ${
                  borderRounded ? "on" : ""
                }`}
                onClick={() => {
                  setBorderRounded(
                    (previous) => !previous
                  );

                  setA4Pages([]);
                }}
              >
                <span className="switch-knob" />
              </button>

            </div>

            {borderRounded && (
              <div className="border-thickness-panel">

                <div className="border-thickness-label">
                  <span>Corner radius</span>
                  <span className="mono">
                    {borderRadiusMm.toFixed(1)}mm
                  </span>
                </div>

                <input
                  type="range"
                  className="border-slider"
                  min={0}
                  max={10}
                  step={0.5}
                  value={borderRadiusMm}
                  style={{
                    "--slider-fill": `${borderRadiusSliderFillPct}%`,
                  }}
                  onChange={(event) => {
                    setBorderRadiusMm(
                      Number(event.target.value)
                    );

                    setA4Pages([]);
                  }}
                  aria-label="Corner radius"
                />

                <div className="border-slider-ticks">
                  <span>0mm</span>
                  <span>10mm</span>
                </div>

              </div>
            )}

            <p className="panel-hint">
              The border is drawn right at the edge of each{" "}
              {pxToMm(grid.photoWidthPx)}×
              {pxToMm(grid.photoHeightPx)}mm photo, on the
              printed sheet.
            </p>

          </section>
  );
}

export default BorderControls;
