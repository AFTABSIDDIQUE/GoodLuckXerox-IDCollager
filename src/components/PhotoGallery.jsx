function PhotoGallery({
  images,
  selectedIndex,
  isDragging,
  setIsDragging,
  handleDrop,
  handleUpload,
  draggedIndex,
  dragOverIndex,
  handleThumbDragStart,
  handleThumbDragOver,
  handleThumbDragLeave,
  handleThumbDrop,
  handleThumbDragEnd,
  grid,
  handleInsertIntoPreviousPage,
  selectImage,
  moveImage,
  togglePageBreak,
  removeImage,
  clearAllImages,
}) {
  return (
          <section className="thumbs-section">

            <div className="section-heading section-heading-row">

              <div>
                <h2>
                  Your Photos
                </h2>

                <p>
                  Click a photo to crop and adjust it. Drag a
                  photo — or use the ‹ › buttons — to reorder
                  it. Rotate photos from the A4 preview below.
                  Use "Set page break" to force a photo to
                  start a brand-new sheet.
                </p>
              </div>

              {images.length > 0 && (
                <button
                  type="button"
                  className="clear-all-inline"
                  onClick={clearAllImages}
                >
                  Clear all {images.length} photos
                </button>
              )}

            </div>

            {images.length ===
            0 ? (
              <label
                className={`empty-upload ${
                  isDragging
                    ? "dragging"
                    : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();

                  setIsDragging(
                    true
                  );
                }}
                onDragLeave={() =>
                  setIsDragging(false)
                }
                onDrop={
                  handleDrop
                }
              >

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={
                    handleUpload
                  }
                />

                <span className="empty-upload-icon">
                  ＋
                </span>

                <p>
                  Upload photos to get started
                </p>

                <span className="empty-upload-sub">
                  JPG or PNG · drag and drop supported
                </span>

              </label>
            ) : (
              <div className="thumb-grid">

                {images.map(
                  (
                    image,
                    index
                  ) => {
                    const isSelected =
                      selectedIndex ===
                      index;

                    const isDraggedThumb =
                      draggedIndex === index;

                    const isDragOverThumb =
                      dragOverIndex === index &&
                      draggedIndex !== index;

                    return (
                      <>

                        {index > 0 &&
                          image.pageBreakBefore &&
                          (() => {
                            let pageStartIndex = 0;

                            for (
                              let previousIndex = index - 1;
                              previousIndex >= 0;
                              previousIndex--
                            ) {
                              if (
                                images[previousIndex]
                                  ?.pageBreakBefore
                              ) {
                                pageStartIndex =
                                  previousIndex;
                                break;
                              }
                            }

                            const photosOnPreviousPage =
                              index - pageStartIndex;

                            const hasPreviousPageSpace =
                              photosOnPreviousPage <
                              grid.slotsPerPage;

                            return (
                              <>
                                {hasPreviousPageSpace && (
                                  <label
                                    key={`${image.id}-previous-page-add`}
                                    className="thumb add-thumb"
                                    title="Add photos to the previous sheet"
                                  >
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onChange={handleInsertIntoPreviousPage(
                                        index
                                      )}
                                    />

                                    <span className="add-thumb-icon">
                                      ＋
                                    </span>

                                    <span className="add-thumb-label">
                                      Add more
                                    </span>
                                  </label>
                                )}

                                <div
                                  key={`${image.id}-break-label`}
                                  style={{
                                    gridColumn: "1 / -1",
                                    borderTop:
                                      "2px dashed #f97316",
                                    margin: "10px 0 2px",
                                    position: "relative",
                                    height: 1,
                                  }}
                                >
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: -9,
                                      left: 6,
                                      background: "#fff",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: "#f97316",
                                      padding: "0 4px",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    ✂ new sheet starts here
                                  </span>
                                </div>
                              </>
                            );
                          })()}

                        <div
                          key={
                            image.id
                          }
                          className={`thumb ${
                            isSelected
                              ? "selected"
                              : ""
                          } ${
                            isDraggedThumb
                              ? "dragging"
                              : ""
                          } ${
                            isDragOverThumb
                              ? "drag-over"
                              : ""
                          }`}
                          draggable
                          onDragStart={handleThumbDragStart(
                            index
                          )}
                          onDragOver={handleThumbDragOver(
                            index
                          )}
                          onDragLeave={handleThumbDragLeave(
                            index
                          )}
                          onDrop={handleThumbDrop(
                            index
                          )}
                          onDragEnd={
                            handleThumbDragEnd
                          }
                          onClick={() =>
                            selectImage(
                              index
                            )
                          }
                        >

                          <div className="thumb-image">

                            <img
                              src={
                                image.processedUrl ||
                                image.url
                              }
                              alt={
                                image.name
                              }
                            />

                          </div>

                          <div className="thumb-number">
                            {index + 1}
                          </div>

                          <div className="thumb-reorder">

                            <button
                              type="button"
                              className="thumb-move-btn"
                              title="Move earlier"
                              disabled={index === 0}
                              onClick={(event) => {
                                event.stopPropagation();

                                moveImage(
                                  index,
                                  index - 1
                                );
                              }}
                            >
                              ‹
                            </button>

                            <button
                              type="button"
                              className="thumb-move-btn"
                              title="Move later"
                              disabled={
                                index ===
                                images.length - 1
                              }
                              onClick={(event) => {
                                event.stopPropagation();

                                moveImage(
                                  index,
                                  index + 1
                                );
                              }}
                            >
                              ›
                            </button>

                          </div>

                          <button
                            type="button"
                            className={`thumb-page-break-btn ${
                              image.pageBreakBefore
                                ? "active"
                                : ""
                            }`}
                            title={
                              image.pageBreakBefore
                                ? "Remove page break (currently starts a new sheet here)"
                                : "Start a new sheet before this photo"
                            }
                            onClick={(event) => {
                              event.stopPropagation();

                              togglePageBreak(index);
                            }}
                            style={{
                              position: "absolute",
                              left: 4,
                              bottom: 4,
                              fontSize: 10,
                              lineHeight: 1,
                              padding: "3px 6px",
                              borderRadius: 4,
                              border: "1px solid #f97316",
                              background: image.pageBreakBefore
                                ? "#f97316"
                                : "#fff",
                              color: image.pageBreakBefore
                                ? "#fff"
                                : "#f97316",
                              cursor: "pointer",
                            }}
                          >
                            {image.pageBreakBefore
                              ? "✂ Break set"
                              : "Set break"}
                          </button>

                          <button
                            className="thumb-remove"
                            type="button"
                            title="Remove"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();

                              removeImage(
                                index
                              );
                            }}
                          >
                            ×
                          </button>

                        </div>

                      </>
                    );
                  }
                )}

                <label
                  className="thumb add-thumb"
                  title="Add more photos"
                >

                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={
                      handleUpload
                    }
                  />

                  <span className="add-thumb-icon">
                    ＋
                  </span>

                  <span className="add-thumb-label">
                    Add more
                  </span>

                </label>

              </div>
            )}

          </section>
  );
}

export default PhotoGallery;
