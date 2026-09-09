function PrintControls({
  pageOrientation,
  rotatePage,
  copies,
  setCopies,
  setA4Pages,
  images,
  totalPrints,
  a4Pages,
}) {
  return (
          <section className="panel-section">

            <div className="panel-section-title">
              <span className="eyebrow">
                02
              </span>
              Sheet
            </div>

            <button
              type="button"
              className="orientation-toggle"
              onClick={
                rotatePage
              }
            >
              <span
                className={`orientation-icon ${
                  pageOrientation ===
                  "landscape"
                    ? "landscape"
                    : ""
                }`}
              >
                ⟳
              </span>

              <span>
                {pageOrientation ===
                "portrait"
                  ? "Portrait"
                  : "Landscape"}{" "}
                A4
              </span>
            </button>

            <div className="copies-row">

              <label htmlFor="copies">
                Copies of each photo
              </label>

              <input
                id="copies"
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(event) => {
                  const value =
                    Number(
                      event.target
                        .value
                    );

                  if (
                    !Number.isFinite(
                      value
                    ) ||
                    value < 1
                  ) {
                    setCopies(1);
                  } else {
                    setCopies(
                      Math.min(
                        value,
                        100
                      )
                    );
                  }

                  setA4Pages([]);
                }}
              />

            </div>

            {images.length >
              0 && (
              <p className="panel-hint">
                <strong>
                  {totalPrints}
                </strong>{" "}
                total print
                {totalPrints !== 1
                  ? "s"
                  : ""}{" "}
                across{" "}
                <strong>
                  {a4Pages.length ||
                    "…"}
                </strong>{" "}
                A4{" "}
                {a4Pages.length ===
                1
                  ? "page"
                  : "pages"}
              </p>
            )}

          </section>
  );
}

export default PrintControls;
