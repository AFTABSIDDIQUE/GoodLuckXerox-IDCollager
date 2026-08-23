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
  are user-controlled.
  -------------------------------------------------------
  */

  const [borderEnabled, setBorderEnabled] =
    useState(false);

  const BORDER_COLOR = "#000000";

  const [borderWidthMm, setBorderWidthMm] =
    useState(1);

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

  const addFiles = (fileList) => {
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

    const newImages = files.map((file) => ({
      id: crypto.randomUUID(),

      url: URL.createObjectURL(file),

      name: file.name,

      crop: null,

      completedCrop: null,

      cropRotation: null,

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

    setImages((previous) => [
      ...previous,
      ...newImages,
    ]);

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
    imageContrast = 100
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

    ctx.filter =
      `brightness(${imageBrightness}%) contrast(${imageContrast}%)`;

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
    imageContrast = 100
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

    setProcessedPreview(
      image.processedUrl || null
    );
  };

  const closeEditor = () => {
    setSelectedIndex(null);
    setProcessedPreview(null);
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
    imageContrast = 100
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

    ctx.filter =
      `brightness(${imageBrightness}%) contrast(${imageContrast}%)`;

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
        contrast
      );
    }

    // No manual crop drawn — contain-fit the whole photo so
    // nothing is cropped, stretched, or force-zoomed.
    return fitImageContain(
      source,
      grid.photoWidthPx,
      grid.photoHeightPx,
      brightness,
      contrast
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
        contrast
      );
    }

    // No manual crop drawn — whole rotated source at its
    // native size, brightness/contrast baked in.
    const canvas =
      document.createElement("canvas");

    canvas.width =
      source.width;

    canvas.height =
      source.height;

    const ctx =
      canvas.getContext("2d");

    ctx.filter =
      `brightness(${brightness}%) contrast(${contrast}%)`;

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
    selectedLayout,
  ]);

  /*
  ========================================================
  GET NATIVE-RESOLUTION CONTENT FOR A PHOTO — NOT fit to
  the frame. This is either the stored `contentUrl` (the
  cropped photo at its own natural size), or — if the user
  never opened the editor — the original upload with its
  brightness/contrast baked in. Frame rotation is applied
  to THIS (see getPrintableImage), never to something
  already padded/fit to the frame, so rotating repeatedly
  never shrinks the photo or compounds letterboxing.
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

    ctx.filter =
      `brightness(${image.brightness ?? 100}%) contrast(${image.contrast ?? 100}%)`;

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

    setCrop(null);

    setCompletedCrop(null);

    setProcessedPreview(null);

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

    const updatedImages =
      images.map(
        (image, index) =>
          index === selectedIndex
            ? {
                ...image,

                crop,

                completedCrop,

                cropRotation:
                  rotation,

                rotation,

                brightness,

                contrast,

                zoom,

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
            result.push(image);
          }
        }
      );

      return result;
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

        ctx.drawImage(
          img,
          cell.x,
          cell.y,
          cell.width,
          cell.height
        );

        /*
        Draw the frame border, if enabled, right on top of
        the photo so it sits exactly at the photo's edges
        for the size the user picked. Border is always
        black.
        */

        if (borderEnabled && borderWidthMm > 0) {
          const borderWidthPx =
            mmToPx(borderWidthMm);

          ctx.strokeStyle =
            BORDER_COLOR;

          ctx.lineWidth =
            borderWidthPx;

          ctx.strokeRect(
            cell.x + borderWidthPx / 2,
            cell.y + borderWidthPx / 2,
            cell.width - borderWidthPx,
            cell.height - borderWidthPx
          );
        }
      }

      return canvas.toDataURL(
        "image/png"
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

      const pages = [];

      for (
        let start = 0;
        start <
        repeatedImages.length;
        start +=
          activeGrid.slotsPerPage
      ) {
        const pageImages =
          repeatedImages.slice(
            start,
            start +
              activeGrid.slotsPerPage
          );

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
  ]);

  /*
  ========================================================
  GET A4 PAGE IMAGES
  ========================================================
  */

  const getA4PageImages =
    (pageIndex) => {
      const repeatedImages =
        getImagesWithCopies();

      return repeatedImages.slice(
        pageIndex *
          grid.slotsPerPage,

        (pageIndex + 1) *
          grid.slotsPerPage
      );
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
            "PNG",
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
                  Click a photo to crop and adjust it. Rotate
                  photos from the A4 preview below.
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

                    return (
                      <div
                        key={
                          image.id
                        }
                        className={`thumb ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
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

                {a4Pages.length > 1 && (
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
                            `brightness(${brightness}%) contrast(${contrast}%)`,
                        }}
                      />
                    </ReactCrop>
                  )}

                  <small className="crop-hint mono">
                    Free-form crop — drag any size or shape.
                    It's fit inside the{" "}
                    {pxToMm(
                      grid.photoWidthPx
                    )}
                    ×
                    {pxToMm(
                      grid.photoHeightPx
                    )}
                    mm frame without stretching.
                  </small>

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