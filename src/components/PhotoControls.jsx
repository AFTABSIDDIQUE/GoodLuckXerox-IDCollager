function PhotoControls({
  isDragging,
  setIsDragging,
  handleDrop,
  handleUpload,
  images,
  clearAllImages,
  generatePDF,
  isDownloading,
}) {
  return (
    <>
          <section className="panel-section">

            <div className="panel-section-title">
              <span className="eyebrow">
                04
              </span>
              Photos
            </div>

            <label
              className={`dropzone ${
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
                id="file"
                type="file"
                multiple
                accept="image/*"
                onChange={
                  handleUpload
                }
              />

              <span className="dropzone-icon">
                ↑
              </span>

              <span className="dropzone-title">
                Drop images or click to upload
              </span>

              <span className="dropzone-sub">
                Upload as many as you like at once
              </span>

            </label>

            {images.length >
              0 && (
              <button
                type="button"
                className="clear-all"
                onClick={
                  clearAllImages
                }
              >
                Clear all{" "}
                {images.length}{" "}
                photos
              </button>
            )}

          </section>
          <button
            type="button"
            className="download"
            onClick={
              generatePDF
            }
            disabled={
              images.length ===
                0 ||
              isDownloading
            }
          >
            {isDownloading
              ? "Preparing PDF…"
              : "Generate & Download PDF"}
          </button>
    </>
  );
}

export default PhotoControls;
