function LayoutControls({
  baseLayouts,
  computeGrid,
  pageOrientation,
  selectedLayout,
  setSelectedLayout,
  pxToMm,
  customWidthMm,
  setCustomWidthMm,
  customHeightMm,
  setCustomHeightMm,
  customColumns,
  setCustomColumns,
  customRows,
  setCustomRows,
  customGapMm,
  setCustomGapMm,
  GAP_MIN_MM,
  GAP_MAX_MM,
  grid,
}) {
  return (
          <section className="panel-section">

            <div className="panel-section-title">
              <span className="eyebrow">
                01
              </span>
              Layout
            </div>

            <div className="layout-grid">

              {Object.entries(
                baseLayouts
              ).map(
                ([key, value]) => {
                  const previewGrid =
                    computeGrid(
                      value,
                      pageOrientation
                    );

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`layout-card ${
                        selectedLayout ===
                        key
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedLayout(
                          key
                        )
                      }
                    >

                      <span
                        className="layout-card-swatch"
                        style={{
                          aspectRatio:
                            `${previewGrid.photoWidthPx} / ${previewGrid.photoHeightPx}`,
                        }}
                      >
                        <span className="crop-corner tl" />
                        <span className="crop-corner tr" />
                        <span className="crop-corner bl" />
                        <span className="crop-corner br" />
                      </span>

                      <span className="layout-card-name">
                        {value.name}
                      </span>

                      <span className="layout-card-meta mono">
                        {pxToMm(
                          previewGrid.photoWidthPx
                        )}
                        ×
                        {pxToMm(
                          previewGrid.photoHeightPx
                        )}
                        mm
                      </span>

                      <span className="layout-card-tag">
                        {value.tag}
                      </span>

                    </button>
                  );
                }
              )}

              <button
                type="button"
                className={`layout-card ${
                  selectedLayout ===
                  "custom"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setSelectedLayout(
                    "custom"
                  )
                }
              >

                <span className="layout-card-swatch custom-swatch">
                  <span className="custom-icon">
                    ＋
                  </span>
                </span>

                <span className="layout-card-name">
                  Custom Size
                </span>

                <span className="layout-card-meta mono">
                  {customWidthMm}×
                  {customHeightMm}
                  mm
                </span>

                <span className="layout-card-tag">
                  Free size, any count
                </span>

              </button>

            </div>

            {selectedLayout ===
              "custom" && (
              <div className="custom-panel">

                <div className="custom-field">
                  <label>
                    Width (mm)
                  </label>

                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={
                      customWidthMm
                    }
                    onChange={(event) =>
                      setCustomWidthMm(
                        Math.max(
                          10,
                          Number(
                            event.target
                              .value
                          ) || 10
                        )
                      )
                    }
                  />
                </div>

                <div className="custom-field">
                  <label>
                    Height (mm)
                  </label>

                  <input
                    type="number"
                    min="10"
                    max="280"
                    value={
                      customHeightMm
                    }
                    onChange={(event) =>
                      setCustomHeightMm(
                        Math.max(
                          10,
                          Number(
                            event.target
                              .value
                          ) || 10
                        )
                      )
                    }
                  />
                </div>

                <div className="custom-field">
                  <label>
                    Columns
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={
                      customColumns
                    }
                    onChange={(event) =>
                      setCustomColumns(
                        Math.max(
                          1,
                          Number(
                            event.target
                              .value
                          ) || 1
                        )
                      )
                    }
                  />
                </div>

                <div className="custom-field">
                  <label>
                    Rows
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={
                      customRows
                    }
                    onChange={(event) =>
                      setCustomRows(
                        Math.max(
                          1,
                          Number(
                            event.target
                              .value
                          ) || 1
                        )
                      )
                    }
                  />
                </div>

                <div className="custom-field">
                  <label>
                    Gap (mm)
                  </label>

                  <input
                    type="number"
                    min={
                      GAP_MIN_MM
                    }
                    max={
                      GAP_MAX_MM
                    }
                    value={
                      customGapMm
                    }
                    onChange={(event) =>
                      setCustomGapMm(
                        Math.min(
                          GAP_MAX_MM,
                          Math.max(
                            0,
                            Number(
                              event.target
                                .value
                            ) || 0
                          )
                        )
                      )
                    }
                  />
                </div>

                {grid.clamped && (
                  <p className="custom-warning">
                    That many photos don't fit at this size —
                    showing{" "}
                    {grid.columns}×
                    {grid.rows} instead of{" "}
                    {customColumns}×
                    {customRows} per page.
                  </p>
                )}

              </div>
            )}

            <p className="panel-hint mono">
              Photo prints at{" "}
              {pxToMm(
                grid.photoWidthPx
              )}
              ×
              {pxToMm(
                grid.photoHeightPx
              )}
              mm ·{" "}
              {grid.slotsPerPage}{" "}
              per sheet
            </p>

          </section>
  );
}

export default LayoutControls;
