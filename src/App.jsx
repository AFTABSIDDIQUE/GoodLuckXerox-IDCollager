import { useEffect, useRef, useState } from "react";
import ReactCrop from "react-image-crop";

import { jsPDF } from "jspdf";

import "react-image-crop/dist/ReactCrop.css";
import "./App.css";

/*
=========================================================
PRINT MATH
=========================================================
*/

const PRINT_DPI = 300;
const MM_TO_PX = PRINT_DPI / 25.4;

const mmToPx = (mm) => Math.round(mm * MM_TO_PX);
const pxToMm = (px) => Math.round((px / MM_TO_PX) * 10) / 10;

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const GAP_MIN_MM = 0;
const GAP_MAX_MM = 30;

const BORDER_MIN_MM = 0.5;
const BORDER_MAX_MM = 10;
const BORDER_STEP_MM = 0.5;

/*
=========================================================
PDF FILE SIZE

Each A4 page used to be embedded as a PNG — lossless, and
several MB per page at 300 DPI. Switching the final page
render (and the PDF embed) to JPEG cuts that down hugely
for photographic content, at a quality level high enough
that the difference isn't visible in print. Lower this
value for smaller files, raise it (closer to 1) for higher
fidelity/bigger files.
=========================================================
*/

const PDF_IMAGE_QUALITY = 0.82;

/*
=========================================================
FREE-FORM (POLYGON) CROP CONSTANTS
=========================================================
*/

// Minimum points needed before the shape can be closed.
const POLYGON_MIN_POINTS = 3;

// Exact point count required to offer the "stretch to
// rectangle" perspective warp — a homography needs exactly
// 4 correspondences (the 4 corners of the tilted subject)
// to map onto the 4 corners of a straight rectangle.
const POLYGON_STRETCH_POINT_COUNT = 4;

// Clicking within this % distance (of the image's own
// width/height) of the starting point closes the shape.
const POLYGON_CLOSE_THRESHOLD_PCT = 4;

/*
=========================================================
LAYOUTS
=========================================================
*/

const baseLayouts = {
  idCard: {
    name: "ID Card",
    tag: "90×60mm · 2 per page",
    mode: "fixed",
    photoWidthMm: 90,
    photoHeightMm: 60,
    columns: 1,
    rows: 2,
    gapMm: 50,
  },

  fourPhoto: {
    name: "4 Photos",
    tag: "Fills the A4 sheet",
    mode: "fill",
    columns: 2,
    rows: 2,
    gapMm: 6,
    marginMm: 10,
  },

  sixPhoto: {
    name: "6 Photos",
    tag: "Fills the A4 sheet",
    mode: "fill",
    columns: 3,
    rows: 2,
    gapMm: 6,
    marginMm: 10,
  },

  ninePhoto: {
    name: "9 Photos",
    tag: "Fills the A4 sheet",
    mode: "fill",
    columns: 3,
    rows: 3,
    gapMm: 5,
    marginMm: 10,
  },

  tenByFifteen: {
    name: "13×18 Photo",
    tag: "130×180mm · 2 per page",
    mode: "fixed",
    photoWidthMm: 130,
    photoHeightMm: 180,
    columns: 2,
    rows: 1,
    gapMm: 10,
  },

    aadharPrint: {
    name: "Aadhar Photo",
    tag: "210×85mm · 1 per page",
    mode: "fixed",
    photoWidthMm: 85,
    photoHeightMm: 210,
    columns: 1,
    rows: 1,
    gapMm: 10,
  },
};

/*
=========================================================
GRID / PIXEL HELPERS
=========================================================
*/

const getPhotoPixelSize = (layout) => ({
  width: mmToPx(layout.photoWidthMm),
  height: mmToPx(layout.photoHeightMm),
});

const computeGrid = (layout, orientation) => {
  const a4WidthPx =
    orientation === "portrait"
      ? mmToPx(A4_WIDTH_MM)
      : mmToPx(A4_HEIGHT_MM);

  const a4HeightPx =
    orientation === "portrait"
      ? mmToPx(A4_HEIGHT_MM)
      : mmToPx(A4_WIDTH_MM);

  const gapPx = mmToPx(layout.gapMm);

  let photoWidthPx;
  let photoHeightPx;
  let columns;
  let rows;
  let clamped = false;

  if (layout.mode === "fill") {
    const marginPx = mmToPx(layout.marginMm ?? 10);

    columns = layout.columns;
    rows = layout.rows;

    const availableWidthPx =
      a4WidthPx -
      marginPx * 2 -
      gapPx * (columns - 1);

    const availableHeightPx =
      a4HeightPx -
      marginPx * 2 -
      gapPx * (rows - 1);

    photoWidthPx = Math.max(
      1,
      Math.floor(availableWidthPx / columns)
    );

    photoHeightPx = Math.max(
      1,
      Math.floor(availableHeightPx / rows)
    );
  } else {
    const size = getPhotoPixelSize(layout);

    photoWidthPx = size.width;
    photoHeightPx = size.height;

    const maxColumns = Math.max(
      1,
      Math.floor(
        (a4WidthPx + gapPx) /
          (photoWidthPx + gapPx)
      )
    );

    const maxRows = Math.max(
      1,
      Math.floor(
        (a4HeightPx + gapPx) /
          (photoHeightPx + gapPx)
      )
    );

    columns = Math.min(
      layout.columns,
      maxColumns
    );

    rows = Math.min(
      layout.rows,
      maxRows
    );

    clamped =
      columns < layout.columns ||
      rows < layout.rows;
  }

  const layoutWidthPx =
    columns * photoWidthPx +
    (columns - 1) * gapPx;

  const layoutHeightPx =
    rows * photoHeightPx +
    (rows - 1) * gapPx;

  const startX =
    (a4WidthPx - layoutWidthPx) / 2;

  const startY =
    (a4HeightPx - layoutHeightPx) / 2;

  const cells = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells.push({
        x:
          startX +
          col *
            (photoWidthPx + gapPx),

        y:
          startY +
          row *
            (photoHeightPx + gapPx),

        width: photoWidthPx,
        height: photoHeightPx,
      });
    }
  }

  return {
    a4WidthPx,
    a4HeightPx,
    photoWidthPx,
    photoHeightPx,
    columns,
    rows,
    slotsPerPage:
      columns * rows,
    cells,
    clamped,
  };
};

/*
=========================================================
APP
=========================================================
*/

function App() {
  /*
  -------------------------------------------------------
  LAYOUT
  -------------------------------------------------------
  */

  const [selectedLayout, setSelectedLayout] =
    useState("idCard");

  const [customWidthMm, setCustomWidthMm] =
    useState(40);

  const [customHeightMm, setCustomHeightMm] =
    useState(50);

  const [customColumns, setCustomColumns] =
    useState(2);

  const [customRows, setCustomRows] =
    useState(2);

  const [customGapMm, setCustomGapMm] =
    useState(5);

  const getActiveLayout = () => {
    if (selectedLayout === "custom") {
      return {
        name: "Custom Size",
        tag: "Your dimensions",
        mode: "fixed",
        photoWidthMm: customWidthMm,
        photoHeightMm: customHeightMm,
        columns: customColumns,
        rows: customRows,
        gapMm: customGapMm,
      };
    }

    return baseLayouts[selectedLayout];
  };

  /*
  -------------------------------------------------------
  PAGE ORIENTATION
  -------------------------------------------------------
  */

  const [pageOrientation, setPageOrientation] =
    useState("portrait");

  /*
  -------------------------------------------------------
  IMAGES
  -------------------------------------------------------
  */

  const [images, setImages] = useState([]);

  const [isDragging, setIsDragging] =
    useState(false);

  /*
  -------------------------------------------------------
  THUMBNAIL REORDERING (drag-and-drop + move buttons)
  -------------------------------------------------------
  */

  const [draggedIndex, setDraggedIndex] =
    useState(null);

  const [dragOverIndex, setDragOverIndex] =
    useState(null);

  /*
  -------------------------------------------------------
  SELECTED IMAGE
  -------------------------------------------------------
  */

  const [selectedIndex, setSelectedIndex] =
    useState(null);

  /*
  -------------------------------------------------------
  CROP
  -------------------------------------------------------
  */

  const [crop, setCrop] =
    useState(null);

  const [completedCrop, setCompletedCrop] =
    useState(null);

  /*
  -------------------------------------------------------
  FREE-FORM (POLYGON) CROP

  An alternative to the rectangle ReactCrop above. The user
  clicks points around the image to trace any shape; clicking
  back near the first point closes it. `cropMode` decides
  which of the two crop tools is active in the editor.
  -------------------------------------------------------
  */

  const [cropMode, setCropMode] =
    useState("rectangle"); // "rectangle" | "freeform"

  const [polygonPoints, setPolygonPoints] =
    useState([]); // [{ xPct, yPct }, ...]

  const [isPolygonClosed, setIsPolygonClosed] =
    useState(false);

  /*
  -------------------------------------------------------
  FREE-FORM CROP — STRETCH TO RECTANGLE

  When the traced shape has exactly 4 points, the user can
  opt into a perspective ("stretch") warp instead of a plain
  polygon clip. Rather than cutting out the quad and padding
  the rest with white, this maps the 4 clicked corners onto
  a straight rectangle and resamples the image into it — so
  a document or photo shot at an angle gets straightened and
  stretched to fill the frame edge-to-edge. Only meaningful
  for a 4-point shape, so it's force-reset whenever the point
  count isn't exactly 4 (see the effect below).
  -------------------------------------------------------
  */

  const [stretchToRectangle, setStretchToRectangle] =
    useState(false);

  useEffect(() => {
    if (
      polygonPoints.length !==
        POLYGON_STRETCH_POINT_COUNT &&
      stretchToRectangle
    ) {
      setStretchToRectangle(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonPoints]);

  const freeCropContainerRef = useRef(null);

  /*
  -------------------------------------------------------
  FREE-FORM CROP — CONTAINER PIXEL SIZE

  The SVG overlay used to use a fixed 0–100 viewBox with
  preserveAspectRatio="none" stretched over a container
  that usually ISN'T square (most photos are 4:3, 3:2,
  portrait, etc). That non-uniform stretch scaled x and y
  by different factors, so a <circle> — which only has one
  radius for both axes — rendered as an oval.

  Fix: track the container's actual rendered pixel size and
  make the SVG's viewBox match those pixel dimensions
  exactly. Then the SVG's internal scale factor is 1:1 on
  both axes (no distortion), so circles stay circles no
  matter the image's aspect ratio. `polygonPoints` still
  stores percentages (so crop math elsewhere is untouched);
  only the rendering below converts percent -> pixels.
  -------------------------------------------------------
  */

  const [freeCropContainerSize, setFreeCropContainerSize] =
    useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = freeCropContainerRef.current;

    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();

      setFreeCropContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);

    observer.observe(container);

    return () => observer.disconnect();
    // Runs once — the ResizeObserver itself keeps
    // `freeCropContainerSize` in sync with the container's
    // actual rendered size for as long as it exists in the
    // DOM (including when the editor image swaps in/out or
    // the window resizes). A second effect further below
    // re-measures on crop-mode switches and image loads,
    // which is when the container is freshly mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
  -------------------------------------------------------
  EDITING
  -------------------------------------------------------
  */

  const [rotation, setRotation] =
    useState(0);

  const [brightness, setBrightness] =
    useState(100);

  const [contrast, setContrast] =
    useState(100);

  const [zoom, setZoom] =
    useState(1);

  const [grayscale, setGrayscale] =
    useState(false);

  /*
  -------------------------------------------------------
  PREVIEW
  -------------------------------------------------------
  */

  const [processedPreview, setProcessedPreview] =
    useState(null);

  /*
  -------------------------------------------------------
  A4 PREVIEW
  -------------------------------------------------------
  */

  const [a4Pages, setA4Pages] =
    useState([]);

  const [currentPageIndex, setCurrentPageIndex] =
    useState(0);

  const [isGeneratingPreview, setIsGeneratingPreview] =
    useState(false);

  const [isDownloading, setIsDownloading] =
    useState(false);

  /*
  -------------------------------------------------------
  BORDER
  Border is always black — only "on/off" and thickness
  are user-controlled. Corners can also be rounded.
  -------------------------------------------------------
  */

  const [borderEnabled, setBorderEnabled] =
    useState(false);

  const BORDER_COLOR = "#000000";

  const [borderWidthMm, setBorderWidthMm] =
    useState(0.5);

  const [borderRounded, setBorderRounded] =
    useState(false);

  const [borderRadiusMm, setBorderRadiusMm] =
    useState(3);

  /*
  -------------------------------------------------------
  EDITOR IMAGE
  -------------------------------------------------------
  */

  const imageRef = useRef(null);

  const [editorImageUrl, setEditorImageUrl] =
    useState(null);

  /*
  -------------------------------------------------------
  CURRENT LAYOUT + GRID
  -------------------------------------------------------
  */

  const layout = getActiveLayout();

  const grid = computeGrid(
    layout,
    pageOrientation
  );

  /*
  ========================================================
  KEEP PAGE INDEX IN RANGE
  Whenever the number of generated pages changes (new
  photo, layout switch, etc.) make sure the page the user
  is currently viewing still exists.
  ========================================================
  */

  useEffect(() => {
    if (a4Pages.length === 0) {
      if (currentPageIndex !== 0) {
        setCurrentPageIndex(0);
      }
      return;
    }

    if (currentPageIndex > a4Pages.length - 1) {
      setCurrentPageIndex(a4Pages.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a4Pages]);

  /*
  ========================================================
  LAYOUT CHANGE — DO NOT RESET CROPS

  Switching layouts (e.g. ID Card → 9 Photos) used to wipe
  every photo's crop, since it reset `crop`/`completedCrop`/
  `contentUrl`. That's no longer necessary: `contentUrl` is
  stored at the photo's own native resolution, not padded
  to any particular frame size, so a saved crop is valid at
  ANY frame size. All that actually needs to change is the
  frame-fitted `processedUrl` thumbnail, which we regenerate
  here from the existing `contentUrl` at the new frame
  dimensions. The crop itself, rotation, brightness,
  contrast, zoom, and frame rotation are all left untouched.
  ========================================================
  */

  useEffect(() => {
    setSelectedIndex(null);
    setCrop(null);
    setCompletedCrop(null);
    setProcessedPreview(null);
    setEditorImageUrl(null);
    setA4Pages([]);

    if (images.length === 0) {
      return;
    }

    let cancelled = false;

    const regenerateThumbnails = async () => {
      try {
        const updated = await Promise.all(
          images.map(async (image) => {
            // Nothing cropped yet — thumbnail just falls
            // back to the original upload, nothing to
            // regenerate.
            if (!image.contentUrl) {
              return image;
            }

            const source = await loadImage(
              image.contentUrl
            );

            const processedUrl = fitImageContain(
              source,
              grid.photoWidthPx,
              grid.photoHeightPx
            );

            return { ...image, processedUrl };
          })
        );

        if (!cancelled) {
          setImages(updated);
        }
      } catch (error) {
        console.error(
          "Thumbnail regeneration error:",
          error
        );
      }
    };

    regenerateThumbnails();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedLayout,
    customWidthMm,
    customHeightMm,
    customColumns,
    customRows,
    customGapMm,
  ]);

  /*
  ========================================================
  UPLOAD
  ========================================================
  */

  /*
  Natural filename sort — "2.png" comes before "10.jpg", and
  files are ordered purely by their numeric/alphabetic name,
  never by extension. { numeric: true } tells the collator to
  compare digit runs as numbers instead of character-by-
  character, which is what makes "10" sort after "2" instead
  of before it.
  */

  const filenameCollator = new Intl.Collator(
    undefined,
    { numeric: true, sensitivity: "base" }
  );

  const sortFilesByName = (files) =>
    [...files].sort((a, b) =>
      filenameCollator.compare(a.name, b.name)
    );

  const addFiles = (fileList, insertAt = null) => {
    const files = sortFilesByName(
      Array.from(
        fileList || []
      ).filter((file) =>
        file.type.startsWith("image/")
      )
    );

    if (files.length === 0) {
      return;
    }

    let newImages = files.map((file) => ({
      id: crypto.randomUUID(),

      url: URL.createObjectURL(file),

      name: file.name,

      // Manual page-break: when true, this photo always
      // starts a fresh A4 sheet, even if the previous sheet
      // still has empty slots. Lets you (for example) keep
      // an Aadhar card's two sides together on one sheet,
      // then force the PAN card onto its own sheet so the
      // next Aadhar starts clean on the sheet after that.
      pageBreakBefore: false,

      crop: null,

      completedCrop: null,

      cropRotation: null,

      // Free-form (polygon) crop, saved as points relative
      // to the image at `freeCropRotation`. Only one of the
      // rectangle crop above or this is ever "active" for a
      // photo — `cropType` says which.
      freeCropPoints: null,

      freeCropRotation: null,

      // Whether the free-form crop above should be resolved
      // as a perspective "stretch to rectangle" warp rather
      // than a plain polygon clip. Only meaningful when
      // `freeCropPoints` has exactly 4 points.
      freeCropStretch: false,

      cropType: null,

      rotation: 0,

      // Rotation applied from the A4 preview (frame rotate
      // icon). Kept separate from the in-editor `rotation`
      // above and always applied to the native-resolution
      // content (see `contentUrl`) BEFORE that content is
      // fit to the frame — never to an already frame-fitted
      // image — so repeated rotates never shrink the photo
      // or compound letterboxing.
      frameRotation: 0,

      brightness: 100,

      contrast: 100,

      zoom: 1,

      grayscale: false,

      // Frame-fitted preview, used for the thumbnail grid
      // and the editor's "Fitted Preview". Always sized to
      // the current frame dimensions.
      processedUrl: null,

      // Native-resolution cropped content (NOT fit/padded to
      // the frame). This is what frame rotation is applied
      // to, so rotating never re-fits an already-letterboxed
      // image.
      contentUrl: null,
    }));

    setImages((previous) => {
      if (
        insertAt === null ||
        insertAt < 0 ||
        insertAt > previous.length
      ) {
        return [...previous, ...newImages];
      }

      const updated = [...previous];

      // Inserting right at a page break: the new photos
      // should become the START of that new sheet, not get
      // tacked onto the sheet before it. So the break flag
      // moves from the photo that was there onto the first
      // new photo, and is cleared from the old one (which is
      // now pushed later in the same sheet as the new photos).
      const targetImage = updated[insertAt];

      if (targetImage?.pageBreakBefore) {
        newImages = newImages.map((image, index) =>
          index === 0
            ? { ...image, pageBreakBefore: true }
            : image
        );

        updated[insertAt] = {
          ...targetImage,
          pageBreakBefore: false,
        };
      }

      updated.splice(insertAt, 0, ...newImages);

      return updated;
    });

    setA4Pages([]);
  };

  const handleUpload = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setIsDragging(false);

    addFiles(event.dataTransfer.files);
  };

  /*
  ========================================================
  INSERT UPLOAD AT A PAGE BREAK

  Lets the user add photos directly at a page-break divider
  in the thumbnail grid, so a new page-break point isn't just
  "append to the very end" — new photos land right where the
  new sheet starts.
  ========================================================
  */

  const handleInsertUpload =
    (index) => (event) => {
      addFiles(event.target.files, index);
      event.target.value = "";
    };

  /*
  ========================================================
  INSERT UPLOAD INTO THE PREVIOUS PAGE
  ========================================================

  When a manual page break exists before `index`, this handler
  inserts new photos immediately before that break. The existing
  break remains attached to the original photo, so the newly
  added photos fill any unused slots on the page above the
  divider instead of incorrectly starting the new sheet.
  ========================================================
  */

  const handleInsertIntoPreviousPage =
    (index) => (event) => {
      const files = sortFilesByName(
        Array.from(
          event.target.files || []
        ).filter((file) =>
          file.type.startsWith("image/")
        )
      );

      if (files.length === 0) {
        event.target.value = "";
        return;
      }

      const newImages = files.map((file) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        name: file.name,
        pageBreakBefore: false,
        crop: null,
        completedCrop: null,
        cropRotation: null,
        freeCropPoints: null,
        freeCropRotation: null,
        freeCropStretch: false,
        cropType: null,
        rotation: 0,
        frameRotation: 0,
        brightness: 100,
        contrast: 100,
        zoom: 1,
        grayscale: false,
        processedUrl: null,
        contentUrl: null,
      }));

      setImages((previous) => {
        const updated = [...previous];
        updated.splice(index, 0, ...newImages);
        return updated;
      });

      setA4Pages([]);
      event.target.value = "";
    };

  /*
  ========================================================
  REORDER PHOTOS

  Moves the photo at `fromIndex` to sit at `toIndex` within
  the `images` array. Everything downstream — thumbnails,
  the editor's `selectedIndex`, and the A4 preview — is
  derived from this array's order, so a single splice here
  is all that's needed to move a photo (and everything about
  it: its crop, content, rotation, etc.) to a new position.
  Works for both drag-and-drop and the ‹ › move buttons.
  ========================================================
  */

  const moveImage = (fromIndex, toIndex) => {
    if (
      fromIndex === null ||
      toIndex === null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= images.length ||
      toIndex >= images.length
    ) {
      return;
    }

    setImages((previous) => {
      const updated = [...previous];

      const [moved] = updated.splice(
        fromIndex,
        1
      );

      updated.splice(
        toIndex,
        0,
        moved
      );

      return updated;
    });

    // If the photo that moved is the one currently open in
    // the editor, keep the editor pointed at it in its new
    // position rather than whatever photo now occupies its
    // old slot.
    setSelectedIndex((previous) => {
      if (previous === null) return previous;

      if (previous === fromIndex) return toIndex;

      if (
        fromIndex < previous &&
        toIndex >= previous
      ) {
        return previous - 1;
      }

      if (
        fromIndex > previous &&
        toIndex <= previous
      ) {
        return previous + 1;
      }

      return previous;
    });

    // Order changed — the A4 preview will regenerate via
    // the existing `images`-watching effect, but clear the
    // stale pages immediately so the UI doesn't show an
    // out-of-date layout while that regenerates.
    setA4Pages([]);
  };

  const handleThumbDragStart =
    (index) => (event) => {
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = "move";
    };

  const handleThumbDragOver =
    (index) => (event) => {
      event.preventDefault();

      event.dataTransfer.dropEffect = "move";

      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    };

  const handleThumbDragLeave =
    (index) => () => {
      setDragOverIndex((previous) =>
        previous === index ? null : previous
      );
    };

  const handleThumbDrop =
    (index) => (event) => {
      event.preventDefault();

      moveImage(draggedIndex, index);

      setDraggedIndex(null);
      setDragOverIndex(null);
    };

  const handleThumbDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /*
  ========================================================
  PAGE BREAK TOGGLE

  Flips `pageBreakBefore` for the photo at `index`. When
  true, this photo always begins a brand-new A4 sheet in
  `buildPageGroups` below, even if the previous sheet has
  free slots left.
  ========================================================
  */

  const togglePageBreak = (index) => {
    setImages((previous) =>
      previous.map((image, i) =>
        i === index
          ? {
              ...image,
              pageBreakBefore: !image.pageBreakBefore,
            }
          : image
      )
    );

    setA4Pages([]);
  };

  /*
  ========================================================
  FILTER STRING HELPER

  Central place that turns brightness/contrast/grayscale
  into a CSS/canvas filter string, so every draw call and
  every live CSS preview stays in sync.
  ========================================================
  */

  const buildFilterString = (
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) =>
    `brightness(${imageBrightness}%) contrast(${imageContrast}%)${
      imageGrayscale ? " grayscale(100%)" : ""
    }`;

  /*
  ========================================================
  CREATE ROTATED CANVAS
  ========================================================
  */

  const createRotatedCanvas = async (
    imageUrl,
    currentRotation
  ) => {
    const source =
      await loadImage(imageUrl);

    const normalizedRotation =
      ((currentRotation % 360) + 360) % 360;

    if (normalizedRotation === 0) {
      const canvas =
        document.createElement("canvas");

      canvas.width = source.width;
      canvas.height = source.height;

      const ctx =
        canvas.getContext("2d");

      ctx.drawImage(
        source,
        0,
        0
      );

      return canvas;
    }

    const radians =
      (normalizedRotation * Math.PI) /
      180;

    const sin =
      Math.abs(Math.sin(radians));

    const cos =
      Math.abs(Math.cos(radians));

    const width = Math.ceil(
      source.width * cos +
        source.height * sin
    );

    const height = Math.ceil(
      source.width * sin +
        source.height * cos
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx =
      canvas.getContext("2d");

    ctx.translate(
      width / 2,
      height / 2
    );

    ctx.rotate(radians);

    ctx.drawImage(
      source,
      -source.width / 2,
      -source.height / 2
    );

    return canvas;
  };

  /*
  ========================================================
  ROUNDED RECT PATH HELPER

  Traces a rounded-rectangle path on the given context so it
  can be used for both clipping (photo corners) and stroking
  (border corners). Radius is clamped so it never exceeds
  half the shortest side.
  ========================================================
  */

  const drawRoundedRectPath = (
    ctx,
    x,
    y,
    width,
    height,
    radius
  ) => {
    const r = Math.max(
      0,
      Math.min(radius, width / 2, height / 2)
    );

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  /*
  ========================================================
  FIT IMAGE — CONTAIN (never crops, never stretches, never
  zooms). Scales the whole source down (or up) so it fits
  entirely inside the target box, centered, with white
  letterboxing if the aspect ratio doesn't match. This is
  the default for any photo that hasn't been manually
  cropped yet, so a fresh upload always shows the whole
  image inside its frame.
  ========================================================
  */

  const fitImageContain = (
    source,
    targetWidth,
    targetHeight,
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) => {
    const canvas =
      document.createElement("canvas");

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      targetWidth,
      targetHeight
    );

    const scale = Math.min(
      targetWidth / source.width,
      targetHeight / source.height
    );

    const drawWidth =
      source.width * scale;

    const drawHeight =
      source.height * scale;

    const offsetX =
      (targetWidth - drawWidth) / 2;

    const offsetY =
      (targetHeight - drawHeight) / 2;

    ctx.filter = buildFilterString(
      imageBrightness,
      imageContrast,
      imageGrayscale
    );

    ctx.drawImage(
      source,
      0,
      0,
      source.width,
      source.height,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    ctx.filter = "none";

    return canvas.toDataURL(
      "image/png"
    );
  };

  /*
  ========================================================
  CROP TO A CANVAS AT NATIVE (crop) RESOLUTION — NOT fit
  or padded to the frame. This is the raw cropped content,
  used as the basis for frame rotation so that rotating
  never re-fits an already frame-fitted/letterboxed image
  (which is what caused repeated rotates to shrink the
  photo).
  ========================================================
  */

  const createCroppedContentImage = (
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) => {
    const canvas =
      document.createElement("canvas");

    canvas.width = Math.max(
      1,
      Math.round(cropWidth)
    );

    canvas.height = Math.max(
      1,
      Math.round(cropHeight)
    );

    const ctx =
      canvas.getContext("2d");

    ctx.filter = buildFilterString(
      imageBrightness,
      imageContrast,
      imageGrayscale
    );

    ctx.drawImage(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.filter = "none";

    return canvas.toDataURL(
      "image/png"
    );
  };

  /*
  ========================================================
  CREATE POLYGON-CLIPPED CANVAS (free-form crop)

  Takes the user's clicked points (percentages relative to
  the displayed, rotated editor image) and clips the source
  image to that shape. Returns a canvas sized to the
  polygon's bounding box: the polygon area shows the image,
  everything else in the box is filled white — matching the
  white "letterbox" convention used everywhere else in this
  app for content that doesn't fill its frame. This output
  slots into the exact same pipeline as the rectangle crop's
  `contentUrl` / `processedUrl`, so free-form crops get
  frame-fitting, printing, and rotation for free.
  ========================================================
  */

  const createPolygonClippedCanvas = (
    source,
    pointsPct,
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) => {
    const sourcePoints = pointsPct.map(
      (point) => ({
        x: (point.xPct / 100) * source.width,
        y: (point.yPct / 100) * source.height,
      })
    );

    const xs = sourcePoints.map((point) => point.x);
    const ys = sourcePoints.map((point) => point.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = Math.max(
      1,
      Math.round(maxX - minX)
    );

    const height = Math.max(
      1,
      Math.round(maxY - minY)
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx =
      canvas.getContext("2d");

    // White fill first — the clip() below only restricts
    // what gets drawn AFTER it's applied, so this base fill
    // stays visible outside the polygon but inside the box.
    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.save();

    ctx.beginPath();

    sourcePoints.forEach(
      (point, index) => {
        const x = point.x - minX;
        const y = point.y - minY;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    );

    ctx.closePath();
    ctx.clip();

    ctx.filter = buildFilterString(
      imageBrightness,
      imageContrast,
      imageGrayscale
    );

    ctx.drawImage(
      source,
      -minX,
      -minY
    );

    ctx.filter = "none";

    ctx.restore();

    return canvas;
  };

  /*
  ========================================================
  PERSPECTIVE "STRETCH TO RECTANGLE" WARP (free-form crop)

  Alternative to the polygon clip above, used only when the
  traced shape has exactly 4 points. Rather than cutting out
  the quad and padding the rest with white, this computes a
  projective transform (a "homography") that maps the 4
  clicked corners onto a straight rectangle, then resamples
  the source image into that rectangle — bilinearly, pixel
  by pixel. The classic use case is exactly a tilted photo
  of a document: click the 4 corners of the page and it gets
  straightened + stretched to fill the frame edge-to-edge,
  with no perspective skew and no white space.

  The math (computeUnitSquareToQuadMatrix) is the standard
  "unit square → quadrilateral" projective mapping (Paul
  Heckbert, "Fundamentals of Texture Mapping and Image
  Warping", 1989). Because the *destination* here is always
  an axis-aligned rectangle, mapping a destination pixel back
  to its source pixel is just: normalize the destination
  pixel to the unit square (x/W, y/H), then run it through
  that one matrix — no separate matrix inversion needed.
  ========================================================
  */

  // Reorders 4 arbitrary quad corners into a canonical
  // top-left, top-right, bottom-right, bottom-left sequence,
  // based on their actual geometry rather than the order the
  // user happened to click them in. Without this, tracing the
  // corners starting from a different corner, or in the
  // opposite direction (counter-clockwise instead of
  // clockwise), made the warped result come out mirrored or
  // rotated relative to the real photo. Uses the standard
  // "sum/difference" trick: the top-left corner has the
  // smallest (x + y), the bottom-right has the largest; the
  // top-right corner has the largest (x - y), the bottom-left
  // has the smallest.
  const orderQuadCorners = (points) => {
    const sums = points.map(
      (point) => point.x + point.y
    );

    const diffs = points.map(
      (point) => point.x - point.y
    );

    const topLeftIndex = sums.indexOf(Math.min(...sums));
    const bottomRightIndex = sums.indexOf(Math.max(...sums));
    const topRightIndex = diffs.indexOf(Math.max(...diffs));
    const bottomLeftIndex = diffs.indexOf(Math.min(...diffs));

    return [
      points[topLeftIndex],
      points[topRightIndex],
      points[bottomRightIndex],
      points[bottomLeftIndex],
    ];
  };

  // Given 4 quad corners already in top-left, top-right,
  // bottom-right, bottom-left order, returns the 3x3-ish
  // coefficients {a..i} of the matrix that maps the unit
  // square (0,0)-(1,1) onto that quad.
  const computeUnitSquareToQuadMatrix = (points) => {
    const [p0, p1, p2, p3] = points;

    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;

    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;

    let a13 = 0;
    let a23 = 0;

    const isAffine =
      Math.abs(dx3) < 1e-9 &&
      Math.abs(dy3) < 1e-9;

    if (!isAffine) {
      const denom = dx1 * dy2 - dx2 * dy1;

      if (Math.abs(denom) > 1e-9) {
        a13 = (dx3 * dy2 - dx2 * dy3) / denom;
        a23 = (dx1 * dy3 - dx3 * dy1) / denom;
      }
    }

    const a = p1.x - p0.x + a13 * p1.x;
    const b = p3.x - p0.x + a23 * p3.x;
    const c = p0.x;

    const d = p1.y - p0.y + a13 * p1.y;
    const e = p3.y - p0.y + a23 * p3.y;
    const f = p0.y;

    return { a, b, c, d, e, f, g: a13, h: a23, i: 1 };
  };

  // Maps a point (u, v) in the unit square through the matrix
  // above to get the corresponding point in the quad.
  const mapUnitSquareToQuad = (matrix, u, v) => {
    const { a, b, c, d, e, f, g, h, i } = matrix;

    const w = g * u + h * v + i;
    const safeW = Math.abs(w) > 1e-9 ? w : 1e-9;

    return {
      x: (a * u + b * v + c) / safeW,
      y: (d * u + e * v + f) / safeW,
    };
  };

  // Bilinear sample of an ImageData at a (possibly
  // fractional) source pixel coordinate. Coordinates are
  // clamped to stay on the source canvas.
  const sampleBilinear = (imageData, x, y) => {
    const { data, width, height } = imageData;

    const clampedX = Math.min(
      Math.max(x, 0),
      width - 1
    );

    const clampedY = Math.min(
      Math.max(y, 0),
      height - 1
    );

    const x0 = Math.floor(clampedX);
    const y0 = Math.floor(clampedY);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);

    const tx = clampedX - x0;
    const ty = clampedY - y0;

    const readPixel = (px, py) => {
      const idx = (py * width + px) * 4;

      return [
        data[idx],
        data[idx + 1],
        data[idx + 2],
        data[idx + 3],
      ];
    };

    const p00 = readPixel(x0, y0);
    const p10 = readPixel(x1, y0);
    const p01 = readPixel(x0, y1);
    const p11 = readPixel(x1, y1);

    const lerp = (start, end, t) =>
      start + (end - start) * t;

    const result = [0, 0, 0, 0];

    for (let channel = 0; channel < 4; channel++) {
      const top = lerp(
        p00[channel],
        p10[channel],
        tx
      );

      const bottom = lerp(
        p01[channel],
        p11[channel],
        tx
      );

      result[channel] = lerp(top, bottom, ty);
    }

    return result;
  };

  // Straightened output size: the longer of the quad's two
  // "horizontal" edges becomes the output width, the longer
  // of its two "vertical" edges becomes the output height —
  // the usual approach for document-style perspective
  // correction, so the result isn't arbitrarily stretched
  // beyond what the source actually contained.
  const computeStretchOutputSize = (points) => {
    const [p0, p1, p2, p3] = points;

    const distance = (a, b) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const topWidth = distance(p0, p1);
    const bottomWidth = distance(p3, p2);
    const leftHeight = distance(p0, p3);
    const rightHeight = distance(p1, p2);

    const width = Math.max(topWidth, bottomWidth);
    const height = Math.max(leftHeight, rightHeight);

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  };

  // Returns a canvas holding the straightened, stretched
  // result, or null if the shape isn't a 4-point quad.
  const createPerspectiveStretchedCanvas = (
    source,
    pointsPct,
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) => {
    if (
      pointsPct.length !==
      POLYGON_STRETCH_POINT_COUNT
    ) {
      return null;
    }

    const rawSourcePoints = pointsPct.map(
      (point) => ({
        x: (point.xPct / 100) * source.width,
        y: (point.yPct / 100) * source.height,
      })
    );

    // Reorder into top-left/top-right/bottom-right/bottom-left
    // by actual position — see orderQuadCorners above for why.
    const sourcePoints = orderQuadCorners(
      rawSourcePoints
    );

    const { width: outWidth, height: outHeight } =
      computeStretchOutputSize(sourcePoints);

    // Bake brightness/contrast/grayscale in once, up front,
    // by drawing the source through the filter onto an
    // offscreen canvas we can then read raw pixels from.
    const sourceCanvas =
      document.createElement("canvas");

    sourceCanvas.width = source.width;
    sourceCanvas.height = source.height;

    const sourceCtx =
      sourceCanvas.getContext("2d");

    sourceCtx.filter = buildFilterString(
      imageBrightness,
      imageContrast,
      imageGrayscale
    );

    sourceCtx.drawImage(source, 0, 0);

    sourceCtx.filter = "none";

    const sourceImageData = sourceCtx.getImageData(
      0,
      0,
      source.width,
      source.height
    );

    const matrix = computeUnitSquareToQuadMatrix(
      sourcePoints
    );

    const outputCanvas =
      document.createElement("canvas");

    outputCanvas.width = outWidth;
    outputCanvas.height = outHeight;

    const outputCtx =
      outputCanvas.getContext("2d");

    const outputImageData = outputCtx.createImageData(
      outWidth,
      outHeight
    );

    for (let y = 0; y < outHeight; y++) {
      const v = (y + 0.5) / outHeight;

      for (let x = 0; x < outWidth; x++) {
        const u = (x + 0.5) / outWidth;

        const { x: srcX, y: srcY } =
          mapUnitSquareToQuad(matrix, u, v);

        const pixel = sampleBilinear(
          sourceImageData,
          srcX,
          srcY
        );

        const idx = (y * outWidth + x) * 4;

        outputImageData.data[idx] = pixel[0];
        outputImageData.data[idx + 1] = pixel[1];
        outputImageData.data[idx + 2] = pixel[2];
        outputImageData.data[idx + 3] = pixel[3];
      }
    }

    outputCtx.putImageData(outputImageData, 0, 0);

    return outputCanvas;
  };

  /*
  ========================================================
  CREATE EDITOR IMAGE
  ========================================================
  */

  useEffect(() => {
    if (
      selectedIndex === null ||
      !images[selectedIndex]
    ) {
      setEditorImageUrl(null);
      return;
    }

    let cancelled = false;

    const createEditorImage = async () => {
      try {
        const canvas =
          await createRotatedCanvas(
            images[selectedIndex].url,
            rotation
          );

        if (cancelled) return;

        setEditorImageUrl(
          canvas.toDataURL("image/png")
        );
      } catch (error) {
        console.error(
          "Editor image error:",
          error
        );
      }
    };

    createEditorImage();

    return () => {
      cancelled = true;
    };
  }, [
    selectedIndex,
    rotation,
    images,
  ]);

  /*
  ========================================================
  RE-MEASURE FREE-CROP CONTAINER WHEN THE EDITOR IMAGE
  (RE)LOADS OR THE CROP MODE CHANGES

  The ResizeObserver above catches window/layout resizes,
  but the container doesn't exist in the DOM at all until
  the edit overlay + freeform mode are showing, and its
  size can also change the moment a new (rotated) editor
  image is swapped in. Re-measuring here keeps the SVG
  viewBox in sync with those moments too.
  ========================================================
  */

  useEffect(() => {
    if (cropMode !== "freeform") return;

    const container = freeCropContainerRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();

    setFreeCropContainerSize({
      width: rect.width,
      height: rect.height,
    });
  }, [cropMode, editorImageUrl]);

  /*
  ========================================================
  SELECT IMAGE
  ========================================================
  */

  const selectImage = (index) => {
    const image = images[index];

    if (!image) return;

    setSelectedIndex(index);

    /*
    A saved crop is only valid for the rotation it was
    made at. If the photo has since been rotated (from the
    thumbnail or the A4 preview) the old crop percentages
    no longer line up with the new orientation, so fall
    back to a fresh default crop instead of misapplying it.
    */

    const cropIsStillValid =
      image.crop &&
      (image.cropRotation ?? 0) ===
        (image.rotation || 0);

    setCrop(
      cropIsStillValid ? image.crop : null
    );

    setCompletedCrop(
      cropIsStillValid
        ? image.completedCrop
        : null
    );

    /*
    Same idea for the free-form crop: the saved points are
    only valid for the rotation they were traced at.
    */

    const freeCropIsStillValid =
      image.freeCropPoints &&
      image.freeCropPoints.length >=
        POLYGON_MIN_POINTS &&
      (image.freeCropRotation ?? 0) ===
        (image.rotation || 0);

    setPolygonPoints(
      freeCropIsStillValid
        ? image.freeCropPoints
        : []
    );

    setIsPolygonClosed(
      Boolean(freeCropIsStillValid)
    );

    setStretchToRectangle(
      freeCropIsStillValid
        ? Boolean(image.freeCropStretch)
        : false
    );

    setCropMode(
      image.cropType === "freeform"
        ? "freeform"
        : "rectangle"
    );

    setRotation(
      image.rotation || 0
    );

    setBrightness(
      image.brightness ?? 100
    );

    setContrast(
      image.contrast ?? 100
    );

    setZoom(
      image.zoom ?? 1
    );

    setGrayscale(
      image.grayscale ?? false
    );

    setProcessedPreview(
      image.processedUrl || null
    );
  };

  const closeEditor = () => {
    setSelectedIndex(null);
    setProcessedPreview(null);
    setPolygonPoints([]);
    setIsPolygonClosed(false);
    setStretchToRectangle(false);
  };

  /*
  ========================================================
  FREE-FORM CROP — POINT PLACEMENT

  Every click on the free-crop image adds a point, unless
  the shape is already closed, or the click landed close
  enough to the first point — in which case it closes the
  shape instead of adding a new one. Coordinates are stored
  as percentages of the displayed image so they stay valid
  regardless of how large the editor renders it.
  ========================================================
  */

  const handleFreeCropContainerClick = (
    event
  ) => {
    if (isPolygonClosed) return;

    const container =
      freeCropContainerRef.current;

    if (!container) return;

    const rect =
      container.getBoundingClientRect();

    if (
      rect.width === 0 ||
      rect.height === 0
    ) {
      return;
    }

    const xPct = Math.min(
      100,
      Math.max(
        0,
        ((event.clientX - rect.left) /
          rect.width) *
          100
      )
    );

    const yPct = Math.min(
      100,
      Math.max(
        0,
        ((event.clientY - rect.top) /
          rect.height) *
          100
      )
    );

    if (
      polygonPoints.length >=
      POLYGON_MIN_POINTS
    ) {
      const first =
        polygonPoints[0];

      const dx =
        xPct - first.xPct;

      const dy =
        yPct - first.yPct;

      const distance =
        Math.sqrt(
          dx * dx + dy * dy
        );

      if (
        distance <=
        POLYGON_CLOSE_THRESHOLD_PCT
      ) {
        setIsPolygonClosed(true);
        return;
      }
    }

    setPolygonPoints(
      (previous) => [
        ...previous,
        { xPct, yPct },
      ]
    );
  };

  const undoLastPolygonPoint = () => {
    if (isPolygonClosed) {
      setIsPolygonClosed(false);
      return;
    }

    setPolygonPoints(
      (previous) =>
        previous.slice(0, -1)
    );
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
    setIsPolygonClosed(false);
    setStretchToRectangle(false);
  };

  const switchCropMode = (mode) => {
    if (mode === cropMode) return;
    setCropMode(mode);
  };

  /*
  ========================================================
  CREATE FITTED IMAGE (cover — used only when the user is
  actively zooming/cropping in the editor)
  ========================================================
  */

  const createFittedImage = async (
    source,
    targetWidth,
    targetHeight,
    imageBrightness = 100,
    imageContrast = 100,
    imageZoom = 1
  ) => {
    const sourceWidth =
      source.width;

    const sourceHeight =
      source.height;

    const targetRatio =
      targetWidth / targetHeight;

    const sourceRatio =
      sourceWidth / sourceHeight;

    let cropWidth;
    let cropHeight;
    let cropX;
    let cropY;

    if (
      sourceRatio > targetRatio
    ) {
      cropHeight = sourceHeight;

      cropWidth =
        sourceHeight *
        targetRatio;

      cropX =
        (sourceWidth -
          cropWidth) /
        2;

      cropY = 0;
    } else {
      cropWidth = sourceWidth;

      cropHeight =
        sourceWidth /
        targetRatio;

      cropX = 0;

      cropY =
        (sourceHeight -
          cropHeight) /
        2;
    }

    if (imageZoom > 1) {
      const zoomWidth =
        cropWidth /
        imageZoom;

      const zoomHeight =
        cropHeight /
        imageZoom;

      cropX +=
        (cropWidth -
          zoomWidth) /
        2;

      cropY +=
        (cropHeight -
          zoomHeight) /
        2;

      cropWidth =
        zoomWidth;

      cropHeight =
        zoomHeight;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width =
      targetWidth;

    canvas.height =
      targetHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.filter =
      `brightness(${imageBrightness}%) contrast(${imageContrast}%)`;

    ctx.drawImage(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    ctx.filter = "none";

    return canvas.toDataURL(
      "image/png"
    );
  };

  /*
  ========================================================
  CREATE CONTAINED IMAGE
  ========================================================
  */

  const createContainedImage = (
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    targetWidth,
    targetHeight,
    imageBrightness = 100,
    imageContrast = 100,
    imageGrayscale = false
  ) => {
    const canvas =
      document.createElement("canvas");

    canvas.width =
      targetWidth;

    canvas.height =
      targetHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      targetWidth,
      targetHeight
    );

    const scale =
      Math.min(
        targetWidth /
          cropWidth,
        targetHeight /
          cropHeight
      );

    const drawWidth =
      cropWidth * scale;

    const drawHeight =
      cropHeight * scale;

    const offsetX =
      (targetWidth -
        drawWidth) /
      2;

    const offsetY =
      (targetHeight -
        drawHeight) /
      2;

    ctx.filter = buildFilterString(
      imageBrightness,
      imageContrast,
      imageGrayscale
    );

    ctx.drawImage(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    ctx.filter = "none";

    return canvas.toDataURL(
      "image/png"
    );
  };

  /*
  ========================================================
  IMAGE LOAD
  ========================================================
  */

  const handleImageLoad = (event) => {
    imageRef.current =
      event.currentTarget;

    const currentImage =
      selectedIndex !== null
        ? images[selectedIndex]
        : null;

    const existingCrop =
      currentImage &&
      currentImage.crop &&
      (currentImage.cropRotation ?? 0) ===
        (currentImage.rotation || 0)
        ? currentImage.crop
        : null;

    if (existingCrop) {
      setCrop(existingCrop);
      return;
    }

    const initialCrop = {
      unit: "%",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };

    setCrop(initialCrop);

    setCompletedCrop(
      initialCrop
    );
  };

  /*
  ========================================================
  CROP CHANGE
  ========================================================
  */

  const handleCropChange = (
    _pixelCrop,
    percentCrop
  ) => {
    setCrop(percentCrop);
  };

  const handleCropComplete = (
    _pixelCrop,
    percentCrop
  ) => {
    if (
      !percentCrop ||
      percentCrop.width <= 0 ||
      percentCrop.height <= 0
    ) {
      return;
    }

    setCompletedCrop(
      percentCrop
    );
  };

  /*
  ========================================================
  CREATE PROCESSED IMAGE
  ========================================================
  */

  const createProcessedImage = async () => {
    if (
      selectedIndex === null ||
      !images[selectedIndex] ||
      !editorImageUrl
    ) {
      return null;
    }

    const source =
      await loadImage(
        editorImageUrl
      );

    if (
      cropMode === "freeform" &&
      isPolygonClosed &&
      polygonPoints.length >=
        POLYGON_MIN_POINTS
    ) {
      if (
        stretchToRectangle &&
        polygonPoints.length ===
          POLYGON_STRETCH_POINT_COUNT
      ) {
        const stretched =
          createPerspectiveStretchedCanvas(
            source,
            polygonPoints,
            brightness,
            contrast,
            grayscale
          );

        if (stretched) {
          // Brightness/contrast/grayscale are already baked
          // into the stretched canvas.
          return fitImageContain(
            stretched,
            grid.photoWidthPx,
            grid.photoHeightPx
          );
        }
      }

      const clipped =
        createPolygonClippedCanvas(
          source,
          polygonPoints,
          brightness,
          contrast,
          grayscale
        );

      // Brightness/contrast/grayscale are already baked
      // into the clipped canvas, so no need to pass them
      // again here.
      return fitImageContain(
        clipped,
        grid.photoWidthPx,
        grid.photoHeightPx
      );
    }

    if (
      completedCrop &&
      completedCrop.width > 0 &&
      completedCrop.height > 0
    ) {
      const sourceWidth =
        source.width;

      const sourceHeight =
        source.height;

      let cropX = 0;
      let cropY = 0;

      let cropWidth =
        sourceWidth;

      let cropHeight =
        sourceHeight;

      if (
        completedCrop.unit === "%"
      ) {
        cropX =
          (completedCrop.x / 100) *
          sourceWidth;

        cropY =
          (completedCrop.y / 100) *
          sourceHeight;

        cropWidth =
          (completedCrop.width / 100) *
          sourceWidth;

        cropHeight =
          (completedCrop.height / 100) *
          sourceHeight;
      } else {
        cropX =
          completedCrop.x;

        cropY =
          completedCrop.y;

        cropWidth =
          completedCrop.width;

        cropHeight =
          completedCrop.height;
      }

      if (zoom > 1) {
        const zoomWidth =
          cropWidth / zoom;

        const zoomHeight =
          cropHeight / zoom;

        cropX +=
          (cropWidth -
            zoomWidth) /
          2;

        cropY +=
          (cropHeight -
            zoomHeight) /
          2;

        cropWidth =
          zoomWidth;

        cropHeight =
          zoomHeight;
      }

      return createContainedImage(
        source,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        grid.photoWidthPx,
        grid.photoHeightPx,
        brightness,
        contrast,
        grayscale
      );
    }

    // No manual crop drawn — contain-fit the whole photo so
    // nothing is cropped, stretched, or force-zoomed.
    return fitImageContain(
      source,
      grid.photoWidthPx,
      grid.photoHeightPx,
      brightness,
      contrast,
      grayscale
    );
  };

  /*
  ========================================================
  CREATE CONTENT IMAGE (native resolution, NOT fit to the
  frame)

  Mirrors createProcessedImage's crop/zoom math, but
  outputs the cropped photo at its own natural size instead
  of stretching/padding it to the frame dimensions. This is
  what gets stored as `contentUrl` and is the basis for
  frame rotation, so rotating a photo never re-fits an
  already frame-fitted (padded) image.
  ========================================================
  */

  const createContentImage = async () => {
    if (
      selectedIndex === null ||
      !images[selectedIndex] ||
      !editorImageUrl
    ) {
      return null;
    }

    const source =
      await loadImage(
        editorImageUrl
      );

    if (
      cropMode === "freeform" &&
      isPolygonClosed &&
      polygonPoints.length >=
        POLYGON_MIN_POINTS
    ) {
      if (
        stretchToRectangle &&
        polygonPoints.length ===
          POLYGON_STRETCH_POINT_COUNT
      ) {
        const stretched =
          createPerspectiveStretchedCanvas(
            source,
            polygonPoints,
            brightness,
            contrast,
            grayscale
          );

        if (stretched) {
          return stretched.toDataURL(
            "image/png"
          );
        }
      }

      const clipped =
        createPolygonClippedCanvas(
          source,
          polygonPoints,
          brightness,
          contrast,
          grayscale
        );

      return clipped.toDataURL(
        "image/png"
      );
    }

    if (
      completedCrop &&
      completedCrop.width > 0 &&
      completedCrop.height > 0
    ) {
      const sourceWidth =
        source.width;

      const sourceHeight =
        source.height;

      let cropX = 0;
      let cropY = 0;

      let cropWidth =
        sourceWidth;

      let cropHeight =
        sourceHeight;

      if (
        completedCrop.unit === "%"
      ) {
        cropX =
          (completedCrop.x / 100) *
          sourceWidth;

        cropY =
          (completedCrop.y / 100) *
          sourceHeight;

        cropWidth =
          (completedCrop.width / 100) *
          sourceWidth;

        cropHeight =
          (completedCrop.height / 100) *
          sourceHeight;
      } else {
        cropX =
          completedCrop.x;

        cropY =
          completedCrop.y;

        cropWidth =
          completedCrop.width;

        cropHeight =
          completedCrop.height;
      }

      if (zoom > 1) {
        const zoomWidth =
          cropWidth / zoom;

        const zoomHeight =
          cropHeight / zoom;

        cropX +=
          (cropWidth -
            zoomWidth) /
          2;

        cropY +=
          (cropHeight -
            zoomHeight) /
          2;

        cropWidth =
          zoomWidth;

        cropHeight =
          zoomHeight;
      }

      return createCroppedContentImage(
        source,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        brightness,
        contrast,
        grayscale
      );
    }

    // No manual crop drawn — whole rotated source at its
    // native size, brightness/contrast/grayscale baked in.
    const canvas =
      document.createElement("canvas");

    canvas.width =
      source.width;

    canvas.height =
      source.height;

    const ctx =
      canvas.getContext("2d");

    ctx.filter = buildFilterString(
      brightness,
      contrast,
      grayscale
    );

    ctx.drawImage(
      source,
      0,
      0
    );

    ctx.filter = "none";

    return canvas.toDataURL(
      "image/png"
    );
  };

  /*
  ========================================================
  LIVE EDITOR PREVIEW
  ========================================================
  */

  useEffect(() => {
    if (
      selectedIndex === null ||
      !images[selectedIndex] ||
      !editorImageUrl
    ) {
      return;
    }

    let cancelled = false;

    const updatePreview = async () => {
      try {
        const result =
          await createProcessedImage();

        if (!cancelled) {
          setProcessedPreview(
            result
          );
        }
      } catch (error) {
        console.error(
          "Preview error:",
          error
        );
      }
    };

    updatePreview();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedIndex,
    editorImageUrl,
    completedCrop,
    rotation,
    brightness,
    contrast,
    zoom,
    grayscale,
    selectedLayout,
    cropMode,
    polygonPoints,
    isPolygonClosed,
    stretchToRectangle,
  ]);

  /*
  ========================================================
  GET NATIVE-RESOLUTION CONTENT FOR A PHOTO — NOT fit to
  the frame. This is either the stored `contentUrl` (the
  cropped photo at its own natural size), or — if the user
  never opened the editor — the original upload with its
  brightness/contrast/grayscale baked in. Frame rotation is
  applied to THIS (see getPrintableImage), never to
  something already padded/fit to the frame, so rotating
  repeatedly never shrinks the photo or compounds
  letterboxing.
  ========================================================
  */

  const getContentForPrint = async (image) => {
    if (image.contentUrl) {
      return image.contentUrl;
    }

    const source = await loadImage(image.url);

    const canvas = document.createElement("canvas");

    canvas.width = source.width;
    canvas.height = source.height;

    const ctx = canvas.getContext("2d");

    ctx.filter = buildFilterString(
      image.brightness ?? 100,
      image.contrast ?? 100,
      image.grayscale ?? false
    );

    ctx.drawImage(source, 0, 0);

    ctx.filter = "none";

    return canvas.toDataURL("image/png");
  };

  /*
  ========================================================
  ROTATE DIRECTLY FROM THE A4 PAGE PREVIEW

  Rotation is only ever triggered from here now — not from
  the upload thumbnails. `frameRotation` is stored as an
  ABSOLUTE angle and is always re-applied fresh from the
  native-resolution content (see getContentForPrint /
  getPrintableImage) rather than compounding rotation on
  top of a previous rotation, so the photo never shrinks
  the more you rotate.
  ========================================================
  */

  const rotateImageDirectly = async (
    index
  ) => {
    const image =
      images[index];

    if (!image) return;

    const newFrameRotation =
      ((image.frameRotation || 0) +
        90) %
      360;

    const updatedImages =
      images.map(
        (item, i) =>
          i === index
            ? {
                ...item,
                frameRotation:
                  newFrameRotation,
              }
            : item
      );

    setImages(
      updatedImages
    );

    if (
      selectedIndex === null
    ) {
      try {
        setIsGeneratingPreview(
          true
        );

        const pages =
          await generateAllA4Pages(
            updatedImages
          );

        setA4Pages(
          pages
        );
      } catch (error) {
        console.error(
          "Rotation error:",
          error
        );
      } finally {
        setIsGeneratingPreview(
          false
        );
      }
    }
  };

  /*
  ========================================================
  ROTATE IN EDITOR

  Single rotate control — always turns the photo 90°
  clockwise. Click it again to keep turning.
  ========================================================
  */

  const rotateInEditor = () => {
    setRotation(
      (previous) =>
        (previous + 90) %
        360
    );

    // Points were traced against the previous orientation —
    // they'd land on the wrong part of the image now.
    setPolygonPoints([]);
    setIsPolygonClosed(false);
    setStretchToRectangle(false);
  };

  /*
  ========================================================
  ROTATE WHOLE A4 PAGE
  ========================================================
  */

  const rotatePage = () => {
    setPageOrientation(
      (previous) =>
        previous === "portrait"
          ? "landscape"
          : "portrait"
    );

    setA4Pages([]);
  };

  /*
  ========================================================
  RESET
  ========================================================
  */

  const resetChanges = async () => {
    setRotation(0);

    setBrightness(100);

    setContrast(100);

    setZoom(1);

    setGrayscale(false);

    setCrop(null);

    setCompletedCrop(null);

    setProcessedPreview(null);

    setPolygonPoints([]);

    setIsPolygonClosed(false);

    setStretchToRectangle(false);

    setCropMode("rectangle");

    if (!editorImageUrl) return;

    const initialCrop = {
      unit: "%",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };

    setCrop(initialCrop);

    setCompletedCrop(
      initialCrop
    );
  };

  /*
  ========================================================
  APPLY CHANGES
  ========================================================
  */

  const applyChanges = async () => {
    if (
      selectedIndex === null
    ) {
      return;
    }

    const processed =
      await createProcessedImage();

    const content =
      await createContentImage();

    const usedFreeCrop =
      cropMode === "freeform" &&
      isPolygonClosed &&
      polygonPoints.length >=
        POLYGON_MIN_POINTS;

    const usedStretch =
      usedFreeCrop &&
      stretchToRectangle &&
      polygonPoints.length ===
        POLYGON_STRETCH_POINT_COUNT;

    const updatedImages =
      images.map(
        (image, index) =>
          index === selectedIndex
            ? {
                ...image,

                // Only one crop tool is "active" per photo —
                // whichever was used, clear the other so a
                // stale rectangle/polygon never gets restored
                // by mistake next time this photo is opened.
                crop:
                  usedFreeCrop
                    ? null
                    : crop,

                completedCrop:
                  usedFreeCrop
                    ? null
                    : completedCrop,

                cropRotation:
                  usedFreeCrop
                    ? null
                    : rotation,

                freeCropPoints:
                  usedFreeCrop
                    ? polygonPoints
                    : null,

                freeCropRotation:
                  usedFreeCrop
                    ? rotation
                    : null,

                freeCropStretch:
                  usedFreeCrop
                    ? usedStretch
                    : false,

                cropType:
                  usedFreeCrop
                    ? "freeform"
                    : completedCrop
                    ? "rectangle"
                    : null,

                rotation,

                brightness,

                contrast,

                zoom,

                grayscale,

                // Frame-fitted, for the thumbnail preview.
                processedUrl:
                  processed,

                // Native resolution, for frame rotation.
                contentUrl:
                  content,

                // A fresh manual edit replaces whatever
                // frame rotation was applied before, since
                // the crop/rotation is now baked into
                // `content`.
                frameRotation: 0,
              }
            : image
      );

    setImages(
      updatedImages
    );

    setSelectedIndex(null);

    setProcessedPreview(null);

    setPolygonPoints([]);

    setIsPolygonClosed(false);

    setStretchToRectangle(false);

    try {
      setIsGeneratingPreview(
        true
      );

      const pages =
        await generateAllA4Pages(
          updatedImages
        );

      setA4Pages(
        pages
      );
    } catch (error) {
      console.error(
        "A4 preview error:",
        error
      );
    } finally {
      setIsGeneratingPreview(
        false
      );
    }
  };

  /*
  ========================================================
  REMOVE IMAGE
  ========================================================
  */

  const removeImage = (
    index
  ) => {
    const image =
      images[index];

    if (image?.url) {
      URL.revokeObjectURL(
        image.url
      );
    }

    setImages(
      (previous) =>
        previous.filter(
          (_, i) =>
            i !== index
        )
    );

    if (
      selectedIndex === index
    ) {
      setSelectedIndex(null);

      setProcessedPreview(
        null
      );
    } else if (
      selectedIndex !== null &&
      index < selectedIndex
    ) {
      setSelectedIndex(
        selectedIndex - 1
      );
    }

    setA4Pages([]);
  };

  /*
  ========================================================
  CLEAR ALL
  ========================================================
  */

  const clearAllImages = () => {
    images.forEach(
      (image) => {
        if (image.url) {
          URL.revokeObjectURL(
            image.url
          );
        }
      }
    );

    setImages([]);

    setSelectedIndex(null);

    setProcessedPreview(
      null
    );

    setA4Pages([]);
  };

  /*
  ========================================================
  GET PRINTABLE IMAGE

  Rotates the NATIVE-RESOLUTION content (never something
  already fit/padded to the frame), then fits the result to
  the frame exactly once. Because the source for rotation is
  always the same native content — not a previously-rotated,
  previously-letterboxed result — rotating the same photo
  repeatedly never shrinks it or compounds whitespace.
  Everything is scaled to fit, never stretched or cropped.
  ========================================================
  */

  const getPrintableImage =
    async (image) => {
      const contentUrl =
        await getContentForPrint(image);

      const frameRotation =
        image.frameRotation || 0;

      if (frameRotation === 0) {
        const source =
          await loadImage(contentUrl);

        return fitImageContain(
          source,
          grid.photoWidthPx,
          grid.photoHeightPx
        );
      }

      const rotatedCanvas =
        await createRotatedCanvas(
          contentUrl,
          frameRotation
        );

      return fitImageContain(
        rotatedCanvas,
        grid.photoWidthPx,
        grid.photoHeightPx
      );
    };

  /*
  ========================================================
  COPIES
  ========================================================
  */

  const [copies, setCopies] =
    useState(1);

  const getImagesWithCopies =
    (imagesList = images) => {
      const result = [];

      imagesList.forEach(
        (image) => {
          for (
            let i = 0;
            i < copies;
            i++
          ) {
            // A page break should fire once per photo, not
            // once per copy of it — only the first copy of
            // each photo keeps the original `pageBreakBefore`
            // flag; subsequent copies never force a break.
            result.push(
              i === 0
                ? image
                : { ...image, pageBreakBefore: false }
            );
          }
        }
      );

      return result;
    };

  /*
  ========================================================
  BUILD PAGE GROUPS (respects manual page breaks)

  Splits a flat list of (possibly repeated) images into
  per-sheet groups. Normally a sheet fills up to
  `slotsPerPage` images before starting the next one, but
  any image flagged `pageBreakBefore` forces the CURRENT
  sheet to close early (if it already has photos on it) so
  that image starts a brand-new sheet — even if the current
  sheet still has empty slots.
  ========================================================
  */

  const buildPageGroups = (
    imagesList,
    activeGrid
  ) => {
    const groups = [];

    let current = [];

    imagesList.forEach((image) => {
      if (
        image.pageBreakBefore &&
        current.length > 0
      ) {
        groups.push(current);
        current = [];
      }

      current.push(image);

      if (
        current.length ===
        activeGrid.slotsPerPage
      ) {
        groups.push(current);
        current = [];
      }
    });

    if (current.length > 0) {
      groups.push(current);
    }

    return groups;
  };

  /*
  ========================================================
  GENERATE SINGLE A4 PAGE
  ========================================================
  */

  const generateSingleA4 =
    async (
      pageImages,
      activeGrid
    ) => {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        activeGrid.a4WidthPx;

      canvas.height =
        activeGrid.a4HeightPx;

      const ctx =
        canvas.getContext("2d");

      ctx.fillStyle =
        "#ffffff";

      ctx.fillRect(
        0,
        0,
        activeGrid.a4WidthPx,
        activeGrid.a4HeightPx
      );

      const radiusPx =
        borderRounded
          ? mmToPx(borderRadiusMm)
          : 0;

      for (
        let i = 0;
        i < pageImages.length;
        i++
      ) {
        const cell =
          activeGrid.cells[i];

        if (!cell) break;

        const image =
          pageImages[i];

        const imageUrl =
          await getPrintableImage(
            image
          );

        const img =
          await loadImage(
            imageUrl
          );

        if (radiusPx > 0) {
          ctx.save();

          drawRoundedRectPath(
            ctx,
            cell.x,
            cell.y,
            cell.width,
            cell.height,
            radiusPx
          );

          ctx.clip();

          ctx.drawImage(
            img,
            cell.x,
            cell.y,
            cell.width,
            cell.height
          );

          ctx.restore();
        } else {
          ctx.drawImage(
            img,
            cell.x,
            cell.y,
            cell.width,
            cell.height
          );
        }

        /*
        Draw the frame border, if enabled, right on top of
        the photo so it sits exactly at the photo's edges
        for the size the user picked. Border is always
        black, and follows the same rounded corners as the
        photo above when "Rounded corners" is on.
        */

        if (borderEnabled && borderWidthMm > 0) {
          const borderWidthPx =
            mmToPx(borderWidthMm);

          ctx.strokeStyle =
            BORDER_COLOR;

          ctx.lineWidth =
            borderWidthPx;

          if (radiusPx > 0) {
            drawRoundedRectPath(
              ctx,
              cell.x + borderWidthPx / 2,
              cell.y + borderWidthPx / 2,
              cell.width - borderWidthPx,
              cell.height - borderWidthPx,
              Math.max(0, radiusPx - borderWidthPx / 2)
            );

            ctx.stroke();
          } else {
            ctx.strokeRect(
              cell.x + borderWidthPx / 2,
              cell.y + borderWidthPx / 2,
              cell.width - borderWidthPx,
              cell.height - borderWidthPx
            );
          }
        }
      }

      return canvas.toDataURL(
        "image/jpeg",
        PDF_IMAGE_QUALITY
      );
    };

  /*
  ========================================================
  GENERATE ALL A4 PAGES
  ========================================================
  */

  const generateAllA4Pages =
    async (
      imagesList = images,
      gridOverride = null
    ) => {
      const activeGrid =
        gridOverride ||
        computeGrid(
          getActiveLayout(),
          pageOrientation
        );

      const repeatedImages =
        getImagesWithCopies(
          imagesList
        );

      if (
        repeatedImages.length ===
        0
      ) {
        return [];
      }

      const pageGroups =
        buildPageGroups(
          repeatedImages,
          activeGrid
        );

      const pages = [];

      for (
        const pageImages of pageGroups
      ) {
        const page =
          await generateSingleA4(
            pageImages,
            activeGrid
          );

        pages.push(page);
      }

      return pages;
    };

  /*
  ========================================================
  AUTOMATIC A4 PREVIEW
  ========================================================
  */

  useEffect(() => {
    if (
      images.length === 0
    ) {
      setA4Pages([]);
      return;
    }

    if (
      selectedIndex !== null
    ) {
      return;
    }

    let cancelled = false;

    const generatePreview =
      async () => {
        try {
          setIsGeneratingPreview(
            true
          );

          const pages =
            await generateAllA4Pages();

          if (!cancelled) {
            setA4Pages(
              pages
            );
          }
        } catch (error) {
          console.error(
            "A4 preview error:",
            error
          );
        } finally {
          if (!cancelled) {
            setIsGeneratingPreview(
              false
            );
          }
        }
      };

    generatePreview();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    images,
    copies,
    selectedLayout,
    selectedIndex,
    pageOrientation,
    customWidthMm,
    customHeightMm,
    customColumns,
    customRows,
    customGapMm,
    borderEnabled,
    borderWidthMm,
    borderRounded,
    borderRadiusMm,
  ]);

  /*
  ========================================================
  GET A4 PAGE IMAGES

  Uses the same `buildPageGroups` grouping as the actual PDF
  generation, so the overlay's rotate/remove icons always
  line up with the correct photo on the correct page — even
  when manual page breaks mean a page doesn't hold a full
  `slotsPerPage` set of photos.
  ========================================================
  */

  const getA4PageImages =
    (pageIndex) => {
      const repeatedImages =
        getImagesWithCopies();

      const groups = buildPageGroups(
        repeatedImages,
        grid
      );

      return groups[pageIndex] || [];
    };

  /*
  ========================================================
  GENERATE PDF
  ========================================================
  */

  const generatePDF =
    async () => {
      if (
        images.length === 0
      ) {
        alert(
          "Please upload at least one image."
        );

        return;
      }

      try {
        setIsDownloading(
          true
        );

        const pages =
          await generateAllA4Pages();

        if (
          pages.length === 0
        ) {
          return;
        }

        setA4Pages(
          pages
        );

        const pdf =
          new jsPDF({
            orientation:
              pageOrientation,

            unit: "mm",

            format: "a4",

            compress: true,
          });

        const pageWidthMm =
          pageOrientation ===
          "portrait"
            ? 210
            : 297;

        const pageHeightMm =
          pageOrientation ===
          "portrait"
            ? 297
            : 210;

        for (
          let i = 0;
          i < pages.length;
          i++
        ) {
          if (i > 0) {
            pdf.addPage(
              "a4",
              pageOrientation
            );
          }

          pdf.addImage(
            pages[i],
            "JPEG",
            0,
            0,
            pageWidthMm,
            pageHeightMm,
            undefined,
            "FAST"
          );
        }

        const filename =
          `${layout.name
            .toLowerCase()
            .replaceAll(
              " ",
              "-"
            )}-photos.pdf`;

        pdf.save(filename);
      } finally {
        setIsDownloading(
          false
        );
      }
    };

  /*
  ========================================================
  RENDER
  ========================================================
  */

  const totalPrints =
    images.length *
    copies;

  const borderSliderFillPct =
    ((borderWidthMm - BORDER_MIN_MM) /
      (BORDER_MAX_MM - BORDER_MIN_MM)) *
    100;

  const borderRadiusSliderFillPct =
    (borderRadiusMm / 10) * 100;

  return (
    <div className="app">

      {/* =================================================
          TOP BAR
      ================================================= */}

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

      <div className="workspace">

        {/* =================================================
            CONTROL PANEL
        ================================================= */}

        <aside className="panel">

          {/* LAYOUT */}

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

          {/* SHEET */}

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

          {/* BORDER */}

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

          {/* PHOTOS */}

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

          {/* DOWNLOAD */}

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

        </aside>

        {/* =================================================
            MAIN
        ================================================= */}

        <main className="main">

          {/* THUMBNAILS */}

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

          {/* =================================================
              A4 PREVIEW — single-page "PDF viewer" style.
              Only the current page is rendered; Prev/Next
              (and a page-dot strip) switch between pages
              instead of stacking every page in a long list.
          ================================================= */}

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

          {isGeneratingPreview && (
            <div className="preview-generating">
              <span className="spinner" />
              Updating A4 preview…
            </div>
          )}

        </main>
      </div>

      {/* =================================================
          UNIFIED EDIT FRAME
      ================================================= */}

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

    </div>
  );
}

/*
=========================================================
LOAD IMAGE
=========================================================
*/

function loadImage(url) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () =>
        resolve(image);

      image.onerror =
        reject;

      image.src = url;
    }
  );
}

export default App;