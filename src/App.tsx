import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import useImage from "use-image";
import { renderAsync } from "docx-preview";
import JSZip from "jszip";
import type Konva from "konva";

type AnswerOption = "A" | "B" | "C" | "D";

type Point = {
  x: number;
  y: number;
};

type ImageSize = {
  width: number;
  height: number;
};

type AnswerBubble = {
  question: number;
  option: AnswerOption;
  x: number;
  y: number;
};

type EditorMode = "empty" | "image" | "docx";

type CalibrationKey =
  | "q1A"
  | "q1B"
  | "q1C"
  | "q1D"
  | "q17A"
  | "q17B"
  | "q17C"
  | "q17D"
  | "q18A"
  | "q18B"
  | "q18C"
  | "q18D"
  | "q34A"
  | "q34B"
  | "q34C"
  | "q34D"
  | "q35A"
  | "q35B"
  | "q35C"
  | "q35D"
  | "q50A"
  | "q50B"
  | "q50C"
  | "q50D";

type CalibrationPoint = {
  key: CalibrationKey;
  label: string;
};

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const BUBBLE_RADIUS = 11;
const WHITE_PIXEL_THRESHOLD = 248;
const TRANSPARENT_PIXEL_THRESHOLD = 10;
const TALL_PAGE_RECOMPOSE_THRESHOLD = 2.4;
const EXPECTED_SPLIT_PAGE_COUNT = 3;
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A4_WIDTH_TWIPS = "11906";
const A4_HEIGHT_TWIPS = "16838";
const OMR_EMPTY_GLYPHS: Record<AnswerOption, string> = {
  A: "\uf041",
  B: "\uf042",
  C: "\uf043",
  D: "\uf044",
};
const OMR_ASCII_GLYPHS: Record<AnswerOption, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
};
const FILLED_ANSWER_GLYPH = "\u2b24";
const FILLED_ANSWER_FONT = "Segoe UI Symbol";
const LEGACY_FILLED_ANSWER_GLYPH = "\u25cf";
const LEGACY_OMR_PRIVATE_FILLED_GLYPH = "\uf025";
const LEGACY_OMR_ASCII_FILLED_GLYPH = "%";
const FILLED_ANSWER_GLYPHS = new Set([
  FILLED_ANSWER_GLYPH,
  LEGACY_FILLED_ANSWER_GLYPH,
  LEGACY_OMR_PRIVATE_FILLED_GLYPH,
  LEGACY_OMR_ASCII_FILLED_GLYPH,
]);

const CALIBRATION_STEPS: CalibrationPoint[] = [
  { key: "q1A", label: "Klikni na střed bubliny 1A" },
  { key: "q1B", label: "Klikni na střed bubliny 1B" },
  { key: "q1C", label: "Klikni na střed bubliny 1C" },
  { key: "q1D", label: "Klikni na střed bubliny 1D" },

  { key: "q17A", label: "Klikni na střed bubliny 17A" },
  { key: "q17B", label: "Klikni na střed bubliny 17B" },
  { key: "q17C", label: "Klikni na střed bubliny 17C" },
  { key: "q17D", label: "Klikni na střed bubliny 17D" },

  { key: "q18A", label: "Klikni na střed bubliny 18A" },
  { key: "q18B", label: "Klikni na střed bubliny 18B" },
  { key: "q18C", label: "Klikni na střed bubliny 18C" },
  { key: "q18D", label: "Klikni na střed bubliny 18D" },

  { key: "q34A", label: "Klikni na střed bubliny 34A" },
  { key: "q34B", label: "Klikni na střed bubliny 34B" },
  { key: "q34C", label: "Klikni na střed bubliny 34C" },
  { key: "q34D", label: "Klikni na střed bubliny 34D" },

  { key: "q35A", label: "Klikni na střed bubliny 35A" },
  { key: "q35B", label: "Klikni na střed bubliny 35B" },
  { key: "q35C", label: "Klikni na střed bubliny 35C" },
  { key: "q35D", label: "Klikni na střed bubliny 35D" },

  { key: "q50A", label: "Klikni na střed bubliny 50A" },
  { key: "q50B", label: "Klikni na střed bubliny 50B" },
  { key: "q50C", label: "Klikni na střed bubliny 50C" },
  { key: "q50D", label: "Klikni na střed bubliny 50D" },
];

type UploadedImageProps = {
  src: string;
  onLoaded: (size: ImageSize) => void;
};

function UploadedImage({ src, onLoaded }: UploadedImageProps) {
  const [image] = useImage(src);

  if (!image) return null;

  onLoaded({
    width: image.width,
    height: image.height,
  });

  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={image.width}
      height={image.height}
    />
  );
}

function interpolatePoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function generateColumnBubbles(
  startQuestion: number,
  endQuestion: number,
  topPoints: Record<AnswerOption, Point>,
  bottomPoints: Record<AnswerOption, Point>,
): AnswerBubble[] {
  const bubbles: AnswerBubble[] = [];
  const totalRows = endQuestion - startQuestion;

  for (let q = startQuestion; q <= endQuestion; q += 1) {
    const rowIndex = q - startQuestion;
    const t = totalRows === 0 ? 0 : rowIndex / totalRows;

    OPTIONS.forEach((option) => {
      const top = topPoints[option];
      const bottom = bottomPoints[option];
      const point = interpolatePoint(top, bottom, t);

      bubbles.push({
        question: q,
        option,
        x: point.x,
        y: point.y,
      });
    });
  }

  return bubbles;
}

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function isWhitePixel(data: Uint8ClampedArray, index: number) {
  const alpha = data[index + 3];

  if (alpha < TRANSPARENT_PIXEL_THRESHOLD) {
    return true;
  }

  return (
    data[index] >= WHITE_PIXEL_THRESHOLD &&
    data[index + 1] >= WHITE_PIXEL_THRESHOLD &&
    data[index + 2] >= WHITE_PIXEL_THRESHOLD
  );
}

function getContentBounds(canvas: HTMLCanvasElement): Bounds | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) return null;

  try {
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;

        if (!isWhitePixel(data, index)) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
    }

    if (right === -1 || bottom === -1) {
      return null;
    }

    return {
      left,
      top,
      right,
      bottom,
    };
  } catch {
    return null;
  }
}

function createWhiteCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Nepodarilo se vytvorit exportni canvas.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  return {
    canvas,
    ctx,
  };
}

function drawImageContained(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = (targetWidth - width) / 2;
  const y = (targetHeight - height) / 2;

  ctx.drawImage(image, x, y, width, height);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nepodarilo se nacist exportni obrazek."));
    image.src = src;
  });
}

function imageToWhiteCanvas(image: HTMLImageElement) {
  const { canvas, ctx } = createWhiteCanvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);

  return canvas;
}

function composeDocxPagesIntoSingleSheet(canvases: HTMLCanvasElement[]) {
  if (canvases.length === 0) {
    throw new Error("DOCX neobsahuje zadnou vykreslitelnou stranku.");
  }

  const targetWidth = canvases[0].width || A4_WIDTH;
  const targetHeight = canvases[0].height || A4_HEIGHT;
  const columnWidth = targetWidth / canvases.length;
  const finalCanvas = document.createElement("canvas");

  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;

  const finalCtx = finalCanvas.getContext("2d");

  if (!finalCtx) {
    throw new Error("Nepodarilo se vytvorit finalni canvas.");
  }

  finalCtx.fillStyle = "#ffffff";
  finalCtx.fillRect(0, 0, targetWidth, targetHeight);

  canvases.forEach((canvas, index) => {
    const bounds = getContentBounds(canvas) ?? {
      left: 0,
      top: 0,
      right: canvas.width,
      bottom: canvas.height,
    };
    const sourceWidth = bounds.right - bounds.left;
    const sourceHeight = bounds.bottom - bounds.top;
    const scale = Math.min(
      1,
      columnWidth / sourceWidth,
      targetHeight / sourceHeight,
    );
    const scaledWidth = sourceWidth * scale;
    const scaledHeight = sourceHeight * scale;
    const x = index * columnWidth + (columnWidth - scaledWidth) / 2;
    const y =
      bounds.top + scaledHeight <= targetHeight
        ? bounds.top
        : Math.max(0, (targetHeight - scaledHeight) / 2);

    finalCtx.drawImage(
      canvas,
      bounds.left,
      bounds.top,
      sourceWidth,
      sourceHeight,
      x,
      y,
      scaledWidth,
      scaledHeight,
    );
  });

  return finalCanvas;
}

function hasA4Aspect(width: number, height: number) {
  const aspect = height / width;
  const a4Aspect = A4_HEIGHT / A4_WIDTH;

  return Math.abs(aspect - a4Aspect) < 0.12;
}

function normalizeSinglePageForExport(sourceCanvas: HTMLCanvasElement) {
  if (!hasA4Aspect(sourceCanvas.width, sourceCanvas.height)) {
    return sourceCanvas;
  }

  const exportScale = Math.max(1, Math.round(sourceCanvas.width / A4_WIDTH));
  const targetWidth = A4_WIDTH * exportScale;
  const targetHeight = A4_HEIGHT * exportScale;
  const { canvas, ctx } = createWhiteCanvas(targetWidth, targetHeight);

  drawImageContained(
    ctx,
    sourceCanvas,
    sourceCanvas.width,
    sourceCanvas.height,
    targetWidth,
    targetHeight,
  );

  return canvas;
}

function recomposeTallStageForExport(sourceCanvas: HTMLCanvasElement) {
  const pageHeight = sourceCanvas.height / EXPECTED_SPLIT_PAGE_COUNT;
  const pageCanvases: HTMLCanvasElement[] = [];

  for (let index = 0; index < EXPECTED_SPLIT_PAGE_COUNT; index += 1) {
    const sliceHeight = Math.round(pageHeight);
    const { canvas, ctx } = createWhiteCanvas(sourceCanvas.width, sliceHeight);

    ctx.drawImage(
      sourceCanvas,
      0,
      index * pageHeight,
      sourceCanvas.width,
      pageHeight,
      0,
      0,
      sourceCanvas.width,
      sliceHeight,
    );

    pageCanvases.push(canvas);
  }

  return composeDocxPagesIntoSingleSheet(pageCanvases);
}

function prepareCanvasForExport(sourceCanvas: HTMLCanvasElement) {
  const aspect = sourceCanvas.height / sourceCanvas.width;

  if (aspect > TALL_PAGE_RECOMPOSE_THRESHOLD) {
    return recomposeTallStageForExport(sourceCanvas);
  }

  return normalizeSinglePageForExport(sourceCanvas);
}

function getDirectChildrenByLocalName(element: Element, localName: string) {
  return Array.from(element.children).filter(
    (child) => child.localName === localName,
  );
}

function getWordElements(element: Element | Document, localName: string) {
  return Array.from(element.getElementsByTagNameNS(WORD_NAMESPACE, localName));
}

function getCellText(cell: Element) {
  return getWordElements(cell, "t")
    .map((textNode) => textNode.textContent ?? "")
    .join("");
}

function getOptionFromGlyph(glyph: string, fallbackOption?: AnswerOption) {
  const option = OPTIONS.find(
    (candidate) =>
      glyph === OMR_EMPTY_GLYPHS[candidate] ||
      glyph === OMR_ASCII_GLYPHS[candidate],
  );

  if (option) {
    return option;
  }

  if (fallbackOption && FILLED_ANSWER_GLYPHS.has(glyph)) {
    return fallbackOption;
  }

  return null;
}

function getReplacementGlyph(originalGlyph: string, option: AnswerOption) {
  const usesPrivateArea = originalGlyph.codePointAt(0)! >= 0xf000;

  return usesPrivateArea ? OMR_EMPTY_GLYPHS[option] : OMR_ASCII_GLYPHS[option];
}

function getClosestWordAncestor(element: Element, localName: string) {
  let current = element.parentElement;

  while (current) {
    if (current.namespaceURI === WORD_NAMESPACE && current.localName === localName) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getOrCreateWordChild(element: Element, localName: string) {
  const existing = getDirectChildrenByLocalName(element, localName)[0];

  if (existing) {
    return existing;
  }

  const child = element.ownerDocument.createElementNS(
    WORD_NAMESPACE,
    `w:${localName}`,
  );

  element.insertBefore(child, element.firstChild);

  return child;
}

function setRunFontFamily(run: Element, fontName: string) {
  const runProperties = getOrCreateWordChild(run, "rPr");
  const runFonts = getOrCreateWordChild(runProperties, "rFonts");

  setWordAttribute(runFonts, "ascii", fontName);
  setWordAttribute(runFonts, "hAnsi", fontName);
  setWordAttribute(runFonts, "cs", fontName);
  setWordAttribute(runFonts, "eastAsia", fontName);
}

function applyFilledAnswerFont(textNode: Element) {
  const run = getClosestWordAncestor(textNode, "r");

  if (run) {
    setRunFontFamily(run, FILLED_ANSWER_FONT);
  }
}

function markOmrCell(cell: Element, selectedOption: AnswerOption) {
  const textNodes = getWordElements(cell, "t");
  let optionIndex = 0;

  textNodes.forEach((textNode) => {
    const originalText = textNode.textContent ?? "";
    let selectedGlyphCount = 0;
    const nextText = Array.from(originalText)
      .map((glyph) => {
        const fallbackOption = OPTIONS[optionIndex];
        const option = getOptionFromGlyph(glyph, fallbackOption);

        if (!option) {
          return glyph;
        }

        optionIndex += 1;

        if (option !== selectedOption) {
          return getReplacementGlyph(glyph, option);
        }

        selectedGlyphCount += 1;

        return FILLED_ANSWER_GLYPH;
      })
      .join("");

    textNode.textContent = nextText;

    if (selectedGlyphCount > 0 && nextText === FILLED_ANSWER_GLYPH) {
      applyFilledAnswerFont(textNode);
    }
  });
}

function setWordAttribute(element: Element, name: string, value: string) {
  element.setAttributeNS(WORD_NAMESPACE, `w:${name}`, value);
}

function enforceA4PageSize(xmlDocument: Document) {
  getWordElements(xmlDocument, "pgSz").forEach((pageSize) => {
    setWordAttribute(pageSize, "w", A4_WIDTH_TWIPS);
    setWordAttribute(pageSize, "h", A4_HEIGHT_TWIPS);
    pageSize.removeAttributeNS(WORD_NAMESPACE, "orient");
  });
}

function applyAnswersToDocxXml(
  xmlDocument: Document,
  selectedAnswers: Record<number, AnswerOption>,
) {
  enforceA4PageSize(xmlDocument);

  getWordElements(xmlDocument, "tbl").forEach((table) => {
    const rows = getDirectChildrenByLocalName(table, "tr");

    rows.forEach((row) => {
      const cells = getDirectChildrenByLocalName(row, "tc");

      for (let index = 0; index + 1 < cells.length; index += 2) {
        const questionMatch = getCellText(cells[index]).match(/\d+/);
        const question = questionMatch ? Number(questionMatch[0]) : null;
        const selectedOption = question ? selectedAnswers[question] : undefined;

        if (selectedOption) {
          markOmrCell(cells[index + 1], selectedOption);
        }
      }
    });
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [editorMode, setEditorMode] = useState<EditorMode>("empty");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({
    width: A4_WIDTH,
    height: A4_HEIGHT,
  });

  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationPoints, setCalibrationPoints] = useState<
    Partial<Record<CalibrationKey, Point>>
  >({});

  const [answers, setAnswers] = useState<Record<number, AnswerOption>>({});
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const docxPreviewRef = useRef<HTMLDivElement | null>(null);

  const answerBubbles = useMemo(() => {
    const {
      q1A,
      q1B,
      q1C,
      q1D,
      q17A,
      q17B,
      q17C,
      q17D,
      q18A,
      q18B,
      q18C,
      q18D,
      q34A,
      q34B,
      q34C,
      q34D,
      q35A,
      q35B,
      q35C,
      q35D,
      q50A,
      q50B,
      q50C,
      q50D,
    } = calibrationPoints;

    if (
      !q1A ||
      !q1B ||
      !q1C ||
      !q1D ||
      !q17A ||
      !q17B ||
      !q17C ||
      !q17D ||
      !q18A ||
      !q18B ||
      !q18C ||
      !q18D ||
      !q34A ||
      !q34B ||
      !q34C ||
      !q34D ||
      !q35A ||
      !q35B ||
      !q35C ||
      !q35D ||
      !q50A ||
      !q50B ||
      !q50C ||
      !q50D
    ) {
      return [];
    }

    return [
      ...generateColumnBubbles(
        1,
        17,
        { A: q1A, B: q1B, C: q1C, D: q1D },
        { A: q17A, B: q17B, C: q17C, D: q17D },
      ),
      ...generateColumnBubbles(
        18,
        34,
        { A: q18A, B: q18B, C: q18C, D: q18D },
        { A: q34A, B: q34B, C: q34C, D: q34D },
      ),
      ...generateColumnBubbles(
        35,
        50,
        { A: q35A, B: q35B, C: q35C, D: q35D },
        { A: q50A, B: q50B, C: q50C, D: q50D },
      ),
    ];
  }, [calibrationPoints]);

  const currentCalibrationStep = CALIBRATION_STEPS[calibrationIndex];
  const filledCount = Object.keys(answers).length;
  const hasSheet = editorMode !== "empty";
  const isDocxMode = editorMode === "docx";

  useEffect(() => {
    if (!docxBuffer || !docxPreviewRef.current || !isDocxMode) {
      return;
    }

    let isCancelled = false;
    const container = docxPreviewRef.current;
    const currentDocxBuffer = docxBuffer;

    async function renderDocxPreview() {
      container.innerHTML = "";

      try {
        await document.fonts.load('16px "OMR Bubbles"');
        await document.fonts.ready;

        await renderAsync(currentDocxBuffer.slice(0), container, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: false,
          ignoreLastRenderedPageBreak: false,
        });

        if (isCancelled) return;

        const wrapper =
          container.querySelector<HTMLElement>(".docx-preview-wrapper") ??
          container;

        setImageSize({
          width: Math.ceil(wrapper.scrollWidth || A4_WIDTH),
          height: Math.ceil(wrapper.scrollHeight || A4_HEIGHT),
        });
      } catch (error) {
        console.error(error);
        alert("DOCX se nepodarilo zobrazit.");
      }
    }

    void renderDocxPreview();

    return () => {
      isCancelled = true;
      container.innerHTML = "";
    };
  }, [docxBuffer, isDocxMode]);

  function getBubbleKey(bubble: AnswerBubble) {
    return `${bubble.question}-${bubble.option}`;
  }

  function selectAnswer(question: number, option: AnswerOption) {
    setAnswers((prev) => ({
      ...prev,
      [question]: option,
    }));
  }

  function resetCalibration() {
    setCalibrationPoints({});
    setCalibrationIndex(0);
    setAnswers({});
    setHoveredBubble(null);
  }

  function recordCalibrationPoint(point: Point) {
    if (!currentCalibrationStep) return;

    setCalibrationPoints((prev) => ({
      ...prev,
      [currentCalibrationStep.key]: point,
    }));

    const nextIndex = calibrationIndex + 1;

    if (nextIndex >= CALIBRATION_STEPS.length) {
      setCalibrationIndex(nextIndex);
      setIsCalibrationMode(false);
      return;
    }

    setCalibrationIndex(nextIndex);
  }

  async function exportPng() {
    const uri = stageRef.current?.toDataURL({
      pixelRatio: 2,
      mimeType: "image/png",
    });

    if (!uri) return;

    try {
      const stageImage = await loadImage(uri);
      const stageCanvas = imageToWhiteCanvas(stageImage);
      const exportCanvas = prepareCanvasForExport(stageCanvas);
      const link = document.createElement("a");

      link.download = "answer-sheet-filled.png";
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error(error);
      alert("Export PNG se nepodarilo vytvorit.");
    }
  }

  async function exportDocx() {
    if (!docxBuffer) return;

    try {
      const zip = await JSZip.loadAsync(docxBuffer.slice(0));
      const documentFile = zip.file("word/document.xml");

      if (!documentFile) {
        throw new Error("DOCX neobsahuje word/document.xml.");
      }

      const xmlText = await documentFile.async("string");
      const xmlDocument = new DOMParser().parseFromString(
        xmlText,
        "application/xml",
      );

      if (xmlDocument.querySelector("parsererror")) {
        throw new Error("DOCX XML se nepodarilo nacist.");
      }

      applyAnswersToDocxXml(xmlDocument, answers);
      zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));

      const blob = await zip.generateAsync({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const baseName = fileName?.replace(/\.docx$/i, "") || "answer-sheet";

      downloadBlob(blob, `${baseName}-filled.docx`);
    } catch (error) {
      console.error(error);
      alert("Export DOCX se nepodarilo vytvorit.");
    }
  }

  function exportSheet() {
    if (isDocxMode) {
      void exportDocx();
      return;
    }

    void exportPng();
  }

  function handleStageClick(event: Konva.KonvaEventObject<MouseEvent>) {
    if (!isCalibrationMode || !currentCalibrationStep) return;

    const stage = event.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    recordCalibrationPoint({
      x: pointer.x,
      y: pointer.y,
    });
  }

  function handleDocxOverlayPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!isCalibrationMode || !currentCalibrationStep) return;

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();

    recordCalibrationPoint({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setAnswers({});
    resetCalibration();

    if (file.type.startsWith("image/")) {
      const imageUrl = URL.createObjectURL(file);

      const img = new Image();

      img.onload = () => {
        setEditorMode("image");
        setDocxBuffer(null);
        setImageSize({
          width: img.width,
          height: img.height,
        });

        setImageSrc(imageUrl);
      };

      img.src = imageUrl;
      return;
    }

    const isDocx =
      file.name.toLowerCase().endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (isDocx) {
      try {
        const arrayBuffer = await file.arrayBuffer();

        setEditorMode("docx");
        setImageSrc(null);
        setDocxBuffer(arrayBuffer);

        if (!arrayBuffer.byteLength) {
          throw new Error("Nepodařilo se vytvořit finální canvas.");
        }

        setImageSize({
          width: A4_WIDTH,
          height: A4_HEIGHT,
        });

      } catch (error) {
        console.error(error);
        alert("DOCX se nepodařilo načíst.");
      }

      return;
    }

    alert("Podporovaný formát je PNG, JPG, JPEG nebo DOCX.");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">OMR Answer Sheet Editor</h1>

            <p className="mt-2 text-slate-300">
              Nahraj arch, zkalibruj bubliny a potom vyplň správné odpovědi.
            </p>

            {fileName && (
              <p className="mt-2 text-sm text-slate-400">
                Nahraný soubor:{" "}
                <span className="font-medium text-slate-200">{fileName}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400"
          >
            Nahrát arch
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="mb-4 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-5">
          <button
            type="button"
            disabled={!hasSheet}
            onClick={() => {
              resetCalibration();
              setIsCalibrationMode(true);
            }}
            className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Spustit kalibraci
          </button>

          <button
            type="button"
            disabled={!hasSheet}
            onClick={() => setIsCalibrationMode((prev) => !prev)}
            className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCalibrationMode ? "Vypnout kalibraci" : "Kalibrační režim"}
          </button>

          <button
            type="button"
            disabled={!hasSheet || answerBubbles.length === 0}
            onClick={exportSheet}
            className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDocxMode ? "Export DOCX" : "Export PNG"}
          </button>

          <button
            type="button"
            onClick={() => setAnswers({})}
            className="rounded-xl border border-red-500/60 px-4 py-2 font-semibold text-red-300 hover:bg-red-500/10"
          >
            Smazat odpovědi
          </button>

          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
            Vyplněno:{" "}
            <span className="font-bold text-white">{filledCount}</span> / 50
          </div>
        </div>

        {hasSheet && (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            {isCalibrationMode && currentCalibrationStep ? (
              <p className="text-amber-300">
                Kalibrace: {currentCalibrationStep.label}
              </p>
            ) : answerBubbles.length === 0 ? (
              <p className="text-slate-300">
                Nejprve spusť kalibraci. Klikni postupně na 1A, 1B, 1C, 1D,
                17A, 17B, 17C, 17D, 18A, 18B, 18C, 18D, 34A, 34B, 34C, 34D,
                35A, 35B, 35C, 35D, 50A, 50B, 50C, 50D.
              </p>
            ) : (
              <p className="text-emerald-300">
                {isDocxMode ? (
                  "Kalibrace hotova. Muzes klikat na odpovedi. Export vytvori DOCX vcetne vyplnenych bublin."
                ) : (
                  <>
                Kalibrace hotová. Můžeš klikat na odpovědi. Export vytvoří PNG
                včetně vyplněných bublin.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
          {!hasSheet ? (
            <div className="flex h-[650px] items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-400">
              Zatím není nahraný žádný arch.
            </div>
          ) : (
            <div className="max-h-[80vh] overflow-auto rounded-xl bg-neutral-300 p-4">
              {isDocxMode ? (
                <div
                  className="relative mx-auto bg-white shadow-2xl"
                  style={{
                    width: imageSize.width,
                    minHeight: imageSize.height,
                  }}
                >
                  <div
                    ref={docxPreviewRef}
                    className="pointer-events-none text-left text-black"
                    style={{
                      width: imageSize.width,
                      minHeight: imageSize.height,
                    }}
                  />
                  <div
                    className="absolute left-0 top-0 z-20"
                    style={{
                      width: imageSize.width,
                      height: imageSize.height,
                      cursor: isCalibrationMode ? "crosshair" : "default",
                      touchAction: isCalibrationMode ? "none" : "auto",
                    }}
                    onPointerDown={handleDocxOverlayPointerDown}
                  >
                    {isCalibrationMode &&
                      Object.entries(calibrationPoints).map(([key, point]) => (
                        <span
                          key={key}
                          className="absolute block h-[10px] w-[10px] rounded-full bg-red-600"
                          style={{
                            left: point.x - 5,
                            top: point.y - 5,
                            pointerEvents: "none",
                          }}
                        />
                      ))}

                    {!isCalibrationMode &&
                      answerBubbles.map((bubble) => {
                        const bubbleKey = getBubbleKey(bubble);
                        const isSelected =
                          answers[bubble.question] === bubble.option;
                        const isHovered = hoveredBubble === bubbleKey;
                        const radius =
                          isHovered && !isSelected
                            ? BUBBLE_RADIUS + 1
                            : BUBBLE_RADIUS;

                        return (
                          <button
                            key={bubbleKey}
                            type="button"
                            aria-label={`${bubble.question}${bubble.option}`}
                            className="absolute rounded-full"
                            style={{
                              left: bubble.x - radius,
                              top: bubble.y - radius,
                              width: radius * 2,
                              height: radius * 2,
                              background: isSelected
                                ? "black"
                                : isHovered
                                  ? "rgba(0,0,0,0.28)"
                                  : "rgba(255,255,255,0)",
                              border:
                                isHovered && !isSelected
                                  ? "2px solid black"
                                  : "1px solid transparent",
                              cursor: "pointer",
                              pointerEvents: "auto",
                              touchAction: "none",
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onMouseEnter={() => setHoveredBubble(bubbleKey)}
                            onMouseLeave={() => setHoveredBubble(null)}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectAnswer(bubble.question, bubble.option);
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
              ) : (
              <div className="mx-auto w-fit bg-white shadow-2xl">
                <Stage
                  ref={stageRef}
                  width={imageSize.width}
                  height={imageSize.height}
                  onClick={handleStageClick}
                >
                  <Layer>
                    <Rect
                      x={0}
                      y={0}
                      width={imageSize.width}
                      height={imageSize.height}
                      fill="#ffffff"
                      listening={false}
                    />

                    <UploadedImage
                      src={imageSrc ?? ""}
                      onLoaded={(size) => {
                        if (
                          size.width !== imageSize.width ||
                          size.height !== imageSize.height
                        ) {
                          setImageSize(size);
                        }
                      }}
                    />

                    {isCalibrationMode &&
                      Object.entries(calibrationPoints).map(([key, point]) => (
                        <Circle
                          key={key}
                          x={point.x}
                          y={point.y}
                          radius={5}
                          fill="red"
                          listening={false}
                        />
                      ))}

                    {!isCalibrationMode &&
                      answerBubbles.map((bubble) => {
                        const bubbleKey = getBubbleKey(bubble);
                        const isSelected =
                          answers[bubble.question] === bubble.option;
                        const isHovered = hoveredBubble === bubbleKey;

                        return (
                          <Circle
                            key={bubbleKey}
                            x={bubble.x}
                            y={bubble.y}
                            radius={
                              isHovered && !isSelected
                                ? BUBBLE_RADIUS + 1
                                : BUBBLE_RADIUS
                            }
                            stroke={
                              isSelected
                                ? undefined
                                : isHovered
                                  ? "black"
                                  : "rgba(0,0,0,0)"
                            }
                            strokeWidth={isHovered && !isSelected ? 2 : 1}
                            fill={
                              isSelected
                                ? "black"
                                : isHovered
                                  ? "rgba(0,0,0,0.28)"
                                  : "rgba(255,255,255,0)"
                            }
                            onMouseEnter={(event) => {
                              setHoveredBubble(bubbleKey);
                              const container = event.target
                                .getStage()
                                ?.container();

                              if (container) {
                                container.style.cursor = "pointer";
                              }
                            }}
                            onMouseLeave={(event) => {
                              setHoveredBubble(null);
                              const container = event.target
                                .getStage()
                                ?.container();

                              if (container) {
                                container.style.cursor = "default";
                              }
                            }}
                            onClick={(event) => {
                              event.cancelBubble = true;
                              selectAnswer(bubble.question, bubble.option);
                            }}
                            onTap={(event) => {
                              event.cancelBubble = true;
                              selectAnswer(bubble.question, bubble.option);
                            }}
                          />
                        );
                      })}
                  </Layer>
                </Stage>
              </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
