import ReactCrop from "react-image-crop";

function PhotoEditor({
  selectedIndex,
  images,
  closeEditor,
  cropMode,
  switchCropMode,
  editorImageUrl,
  crop,
  handleCropChange,
  handleCropComplete,
  imageRef,
  handleImageLoad,
  buildFilterString,
  brightness,
  contrast,
  grayscale,
  printEffects,
  printEffect,
  applyPrintEffect,
  pxToMm,
  grid,
  freeCropContainerRef,
  handleFreeCropContainerClick,
  POLYGON_MIN_POINTS,
  polygonPoints,
  freeCropContainerSize,
  isPolygonClosed,
  stretchToRectangle,
  undoLastPolygonPoint,
  clearPolygon,
  POLYGON_STRETCH_POINT_COUNT,
  setStretchToRectangle,
  rotation,
  rotateInEditor,
  zoom,
  setZoom,
  setBrightness,
  setContrast,
  processedPreview,
  resetChanges,
  applyChanges,
}) {
  return (
    <>
      {selectedIndex !==
        null &&
        images[
          selectedIndex
        ] && (
          <div className="edit-overlay">

            <div className="edit-frame">

              <div className="edit-frame-header">

                <strong>
                  Edit Photo{" "}
                  {selectedIndex +
                    1}
                </strong>

                <button
                  type="button"
                  className="edit-frame-close"
                  onClick={
                    closeEditor
                  }
                  title="Close"
                >
                  ×
                </button>

              </div>

              <div className="edit-frame-body">

                <div className="edit-frame-crop">

                  <div className="crop-mode-toggle">

                    <button
                      type="button"
                      className={
                        cropMode ===
                        "rectangle"
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        switchCropMode(
                          "rectangle"
                        )
                      }
                    >
                      Rectangle Crop
                    </button>

                    <button
                      type="button"
                      className={
                        cropMode ===
                        "freeform"
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        switchCropMode(
                          "freeform"
                        )
                      }
                    >
                      Free-Form Crop
                    </button>

                  </div>

                  {cropMode === "rectangle" ? (
                    <>

                      {editorImageUrl && (
                        <ReactCrop
                          crop={crop}
                          onChange={
                            handleCropChange
                          }
                          onComplete={
                            handleCropComplete
                          }
                          keepSelection={
                            true
                          }
                          ruleOfThirds={
                            true
                          }
                        >
                          <img
                            ref={
                              imageRef
                            }
                            src={
                              editorImageUrl
                            }
                            alt="Crop"
                            onLoad={
                              handleImageLoad
                            }
                            style={{
                              maxWidth:
                                "100%",
                              maxHeight:
                                "380px",
                              display:
                                "block",
                              filter:
                                buildFilterString(
                                  brightness,
                                  contrast,
                                  grayscale
                                ),
                            }}
                          />
                        </ReactCrop>
                      )}

                      <small className="crop-hint mono">
                        Drag any size or shape. It's fit
                        inside the{" "}
                        {pxToMm(
                          grid.photoWidthPx
                        )}
                        ×
                        {pxToMm(
                          grid.photoHeightPx
                        )}
                        mm frame without stretching.
                      </small>

                    </>
                  ) : (
                    <>

                      {editorImageUrl && (
                        <div
                          className="free-crop-container"
                          ref={
                            freeCropContainerRef
                          }
                          onClick={
                            handleFreeCropContainerClick
                          }
                          data-tooltip={
                            isPolygonClosed
                              ? "Shape closed — switch to a different tool to edit it further"
                              : polygonPoints.length <
                                POLYGON_MIN_POINTS
                              ? "Click to place a point and trace an outline"
                              : "Click again, or click the white start point to close the shape"
                          }
                        >

                          <img
                            src={
                              editorImageUrl
                            }
                            alt="Free-form crop"
                            draggable={
                              false
                            }
                            onLoad={() => {
                              // The container's size can
                              // change the instant the
                              // <img> finishes loading and
                              // takes up its natural space —
                              // re-measure right after so the
                              // SVG viewBox (and therefore
                              // point circles) line up from
                              // the very first frame.
                              const container =
                                freeCropContainerRef.current;

                              if (!container) return;

                              const rect =
                                container.getBoundingClientRect();

                              setFreeCropContainerSize({
                                width: rect.width,
                                height: rect.height,
                              });
                            }}
                            style={{
                              display:
                                "block",
                              maxWidth:
                                "100%",
                              maxHeight:
                                "380px",
                              filter:
                                buildFilterString(
                                  brightness,
                                  contrast,
                                  grayscale
                                ),
                            }}
                          />

                          <svg
                            className="free-crop-overlay"
                            viewBox={`0 0 ${
                              freeCropContainerSize.width || 1
                            } ${
                              freeCropContainerSize.height || 1
                            }`}
                            preserveAspectRatio="none"
                          >

                            {polygonPoints.length >
                              1 && (
                              <polyline
                                points={polygonPoints
                                  .map(
                                    (point) =>
                                      `${
                                        (point.xPct / 100) *
                                        freeCropContainerSize.width
                                      },${
                                        (point.yPct / 100) *
                                        freeCropContainerSize.height
                                      }`
                                  )
                                  .join(
                                    " "
                                  )}
                                fill={
                                  isPolygonClosed
                                    ? "rgba(34,197,94,0.25)"
                                    : "none"
                                }
                                stroke="#22c55e"
                                strokeWidth="2"
                              />
                            )}

                            {isPolygonClosed &&
                              polygonPoints.length >
                                0 && (
                                <line
                                  x1={
                                    (polygonPoints[
                                      polygonPoints.length -
                                        1
                                    ].xPct /
                                      100) *
                                    freeCropContainerSize.width
                                  }
                                  y1={
                                    (polygonPoints[
                                      polygonPoints.length -
                                        1
                                    ].yPct /
                                      100) *
                                    freeCropContainerSize.height
                                  }
                                  x2={
                                    (polygonPoints[0]
                                      .xPct /
                                      100) *
                                    freeCropContainerSize.width
                                  }
                                  y2={
                                    (polygonPoints[0]
                                      .yPct /
                                      100) *
                                    freeCropContainerSize.height
                                  }
                                  stroke="#22c55e"
                                  strokeWidth="2"
                                />
                              )}

                            {polygonPoints.map(
                              (point, index) => (
                                <circle
                                  key={
                                    index
                                  }
                                  cx={
                                    (point.xPct / 100) *
                                    freeCropContainerSize.width
                                  }
                                  cy={
                                    (point.yPct / 100) *
                                    freeCropContainerSize.height
                                  }
                                  r={
                                    index === 0
                                      ? 7
                                      : 4.5
                                  }
                                  fill={
                                    index === 0
                                      ? "#ffffff"
                                      : "#22c55e"
                                  }
                                  stroke="#22c55e"
                                  strokeWidth="1.5"
                                />
                              )
                            )}

                          </svg>

                        </div>
                      )}

                      <div className="free-crop-actions">

                        <button
                          type="button"
                          onClick={
                            undoLastPolygonPoint
                          }
                          disabled={
                            polygonPoints.length ===
                            0
                          }
                        >
                          {isPolygonClosed
                            ? "Reopen shape"
                            : "Undo point"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            clearPolygon
                          }
                          disabled={
                            polygonPoints.length ===
                            0
                          }
                        >
                          Clear
                        </button>

                      </div>

                      {polygonPoints.length ===
                        POLYGON_STRETCH_POINT_COUNT && (
                        <div className="toggle-row">

                          <div className="toggle-row-text">
                            <span className="toggle-row-title">
                              Stretch to rectangle
                            </span>
                            <span className="toggle-row-sub">
                              Straightens the 4 points into a
                              full rectangle instead of
                              leaving white space around them
                              — use this for a tilted photo of
                              a document or page.
                            </span>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={stretchToRectangle}
                            className={`switch ${
                              stretchToRectangle ? "on" : ""
                            }`}
                            onClick={() =>
                              setStretchToRectangle(
                                (previous) => !previous
                              )
                            }
                          >
                            <span className="switch-knob" />
                          </button>

                        </div>
                      )}

                      <small className="crop-hint mono">
                        {isPolygonClosed
                          ? stretchToRectangle &&
                            polygonPoints.length ===
                              POLYGON_STRETCH_POINT_COUNT
                            ? "Shape closed — the 4 points will be straightened and stretched to fill a rectangle."
                            : "Shape closed — it's fit inside the frame, cropped to that outline."
                          : polygonPoints.length <
                            POLYGON_MIN_POINTS
                          ? "Click around the photo to trace an outline."
                          : polygonPoints.length ===
                            POLYGON_STRETCH_POINT_COUNT
                          ? "Click the white starting point again to close the shape, or keep adding points for a non-rectangular outline."
                          : "Click the white starting point again to close the shape."}
                      </small>

                    </>
                  )}

                </div>

                <div className="edit-frame-controls">

                  <div className="inline-panel-title">
                    Rotate
                  </div>

                  <div className="inline-rotate-controls">

                    <button
                      type="button"
                      title="Rotate"
                      onClick={
                        rotateInEditor
                      }
                    >
                      ⟳
                    </button>

                    <span>
                      {rotation}°
                    </span>

                  </div>

                  <div className="inline-panel-title">
                    Adjust
                  </div>

                  <div className="print-effect-grid">
                    {Object.entries(printEffects).map(
                      ([effectName, effect]) => (
                        <button
                          key={effectName}
                          type="button"
                          className={`print-effect-card ${
                            printEffect === effectName
                              ? "active"
                              : ""
                          } print-effect-${effectName}`}
                          onClick={() =>
                            applyPrintEffect(effectName)
                          }
                        >
                          <span className="print-effect-swatch">
                            {effectName === "none"
                              ? "Aa"
                              : effectName === "blackAndWhite"
                              ? "B&W"
                              : effectName === "whitePaper"
                              ? "WP"
                              : "X"}
                          </span>
                          <span className="print-effect-copy">
                            <strong>{effect.label}</strong>
                            <small>{effect.description}</small>
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  <div className="toggle-row">

                    <div className="toggle-row-text">
                      <span className="toggle-row-title">
                        Black &amp; white
                      </span>
                      <span className="toggle-row-sub">
                        Converts this photo to grayscale
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={grayscale}
                      className={`switch ${
                        grayscale ? "on" : ""
                      }`}
                      onClick={() =>
                        setGrayscale(
                          (previous) => !previous
                        )
                      }
                    >
                      <span className="switch-knob" />
                    </button>

                  </div>

                  <div className="inline-control">

                    <label>
                      Zoom
                    </label>

                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={zoom}
                      onChange={(
                        event
                      ) =>
                        setZoom(
                          Number(
                            event.target
                              .value
                          )
                        )
                      }
                    />

                    <span>
                      {zoom.toFixed(
                        1
                      )}
                      x
                    </span>

                  </div>

                  <div className="inline-control">

                    <label>
                      Brightness
                    </label>

                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={
                        brightness
                      }
                      onChange={(
                        event
                      ) =>
                        setBrightness(
                          Number(
                            event.target
                              .value
                          )
                        )
                      }
                    />

                    <span>
                      {brightness}%
                    </span>

                  </div>

                  <div className="inline-control">

                    <label>
                      Contrast
                    </label>

                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={
                        contrast
                      }
                      onChange={(
                        event
                      ) =>
                        setContrast(
                          Number(
                            event.target
                              .value
                          )
                        )
                      }
                    />

                    <span>
                      {contrast}%
                    </span>

                  </div>

                  {processedPreview && (
                    <div className="edit-frame-preview">

                      <div className="inline-panel-title">
                        Fitted Preview (
                        {pxToMm(
                          grid.photoWidthPx
                        )}
                        ×
                        {pxToMm(
                          grid.photoHeightPx
                        )}
                        mm)
                      </div>

                      <img
                        src={
                          processedPreview
                        }
                        alt="Fitted preview"
                      />

                    </div>
                  )}

                </div>

              </div>

              <div className="inline-crop-actions">

                <button
                  type="button"
                  className="reset"
                  onClick={
                    resetChanges
                  }
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="cancel"
                  onClick={
                    closeEditor
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="apply"
                  onClick={
                    async () => {
                      await applyChanges();
                    }
                  }
                >
                  Apply
                </button>

              </div>

            </div>

          </div>
        )}
    </>
  );
}

export default PhotoEditor;
