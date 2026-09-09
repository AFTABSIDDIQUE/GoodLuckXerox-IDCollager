function A4Preview({
  a4Pages,
  currentPageIndex,
  setCurrentPageIndex,
  getA4PageImages,
  pageOrientation,
  pxToMm,
  grid,
  images,
  rotateImageDirectly,
  removeImage,
  generatePDF,
  isDownloading,
}) {
  return (
    <>
          {a4Pages.length > 0 && (() => {
            const pageDataUrl = a4Pages[currentPageIndex];
            const pageImages = getA4PageImages(currentPageIndex);

            const goPrev = () =>
              setCurrentPageIndex((previous) =>
                Math.max(0, previous - 1)
              );

            const goNext = () =>
              setCurrentPageIndex((previous) =>
                Math.min(a4Pages.length - 1, previous + 1)
              );

            return (
              <section className="preview-section">

                <div className="section-heading">

                  <h2>A4 Preview</h2>

                  <p>
                    Exactly what prints —{" "}
                    {pageOrientation === "portrait"
                      ? "portrait"
                      : "landscape"}{" "}
                    A4,{" "}
                    {pxToMm(grid.photoWidthPx)}×
                    {pxToMm(grid.photoHeightPx)}
                    mm photos. Use the rotate icon on a photo
                    to turn it.
                  </p>

                </div>

                {a4Pages.length > 0 && (
                  <div className="a4-pager">

                    <button
                      type="button"
                      className="a4-pager-btn"
                      onClick={goPrev}
                      disabled={currentPageIndex === 0}
                    >
                      ‹ Prev
                    </button>

                    <div className="a4-pager-dots">
                      {a4Pages.map((_, dotIndex) => (
                        <button
                          key={dotIndex}
                          type="button"
                          className={`a4-pager-dot ${
                            dotIndex === currentPageIndex
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setCurrentPageIndex(dotIndex)
                          }
                          aria-label={`Go to page ${dotIndex + 1}`}
                        />
                      ))}
                    </div>

                    <span className="a4-pager-status mono">
                      Page {currentPageIndex + 1} of{" "}
                      {a4Pages.length}
                    </span>

                    <button
                      type="button"
                      className="a4-pager-btn"
                      onClick={goNext}
                      disabled={
                        currentPageIndex ===
                        a4Pages.length - 1
                      }
                    >
                      Next ›
                    </button>

                    <button
                      type="button"
                      className="download a4-pager-download"
                      onClick={generatePDF}
                      disabled={
                        images.length === 0 ||
                        isDownloading
                      }
                      style={{
                        marginLeft: "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isDownloading
                        ? "Preparing PDF…"
                        : "Generate & Download"}
                    </button>

                  </div>
                )}

                <div className="a4-wrapper">

                  <div className="a4-page-label">

                    <strong>
                      Page {currentPageIndex + 1}
                    </strong>

                    <span>
                      {pageImages.length} photo
                      {pageImages.length !== 1 ? "s" : ""}
                    </span>

                  </div>

                  <div
                    className={`a4-sheet ${
                      pageOrientation === "landscape"
                        ? "landscape"
                        : ""
                    }`}
                  >

                    <span className="crop-corner tl" />
                    <span className="crop-corner tr" />
                    <span className="crop-corner bl" />
                    <span className="crop-corner br" />

                    <img
                      className="a4-sheet-image"
                      src={pageDataUrl}
                      alt={`A4 page ${currentPageIndex + 1}`}
                    />

                    <div className="a4-overlay">

                      {pageImages.map((image, slotIndex) => {
                        const cell = grid.cells[slotIndex];

                        if (!cell) {
                          return null;
                        }

                        const actualIndex = images.findIndex(
                          (item) => item.id === image.id
                        );

                        const leftPct =
                          (cell.x / grid.a4WidthPx) * 100;

                        const topPct =
                          (cell.y / grid.a4HeightPx) * 100;

                        const widthPct =
                          (cell.width / grid.a4WidthPx) * 100;

                        const heightPct =
                          (cell.height / grid.a4HeightPx) *
                          100;

                        return (
                          <div
                            className="a4-cell"
                            key={`${image.id}-${slotIndex}`}
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                            }}
                          >

                            <div className="a4-cell-toolbar">

                              <button
                                type="button"
                                title="Rotate"
                                onClick={() =>
                                  rotateImageDirectly(
                                    actualIndex
                                  )
                                }
                              >
                                ⟳
                              </button>

                              <button
                                type="button"
                                className="a4-cell-remove"
                                title="Remove"
                                onClick={() =>
                                  removeImage(actualIndex)
                                }
                              >
                                ×
                              </button>

                            </div>

                            <div className="a4-cell-number">
                              {actualIndex + 1}
                            </div>

                          </div>
                        );
                      })}

                    </div>

                  </div>

                </div>

              </section>
            );
          })()}
    </>
  );
}

export default A4Preview;
