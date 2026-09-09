function Header({ images, a4Pages }) {
  return (
      <header className="topbar">
        <div className="topbar-inner">

          <div className="brand">

            <span
              className="brand-mark"
              aria-hidden="true"
            >
              <span className="crop-corner tl" />
              <span className="crop-corner tr" />
              <span className="crop-corner bl" />
              <span className="crop-corner br" />
            </span>

            <div>
              <h1>
                GoodLuck Image Collager
              </h1>

              <p className="brand-sub">
                Lay out, crop, and print ID &amp; photos
              </p>
            </div>

          </div>

          {images.length > 0 && (
            <div className="topbar-stats">

              <div className="stat">
                <span className="stat-value">
                  {images.length}
                </span>

                <span className="stat-label">
                  photos
                </span>
              </div>

              <div className="stat">
                <span className="stat-value">
                  {a4Pages.length || 0}
                </span>

                <span className="stat-label">
                  {a4Pages.length === 1
                    ? "page"
                    : "pages"}
                </span>
              </div>

            </div>
          )}

        </div>
      </header>
  );
}

export default Header;
