import { useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import JSZip from "jszip";
import type Konva from "konva";
import { AnswersPanel } from "./components/AnswerPanel";
import { ControlPanel } from "./components/ControlPanel";
import { EditorCanvas } from "./components/EditorCanvas";
import { MoodleImportPanel } from "./components/MoodleImportPanel";
import { StatusPanel } from "./components/StatusPanel";
import {
  A4_HEIGHT,
  A4_WIDTH,
  CALIBRATION_STEPS,
  OPTIONS,
  STORAGE_KEY,
} from "./constants";
import { useAnswerBubbles } from "./hooks/useAnswerBubbles";
import { useKeyboardAnswers } from "./hooks/useKeyboardAnswers";
import type {
  AnswerOption,
  Answers,
  CalibrationPoints,
  EditorMode,
  ImageSize,
  ImportedMoodleAnswer,
  Point,
} from "./types";

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
    throw new Error("Nepodařilo se vytvořit exportní plátno.");
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
    image.onerror = () => reject(new Error("Nepodařilo se načíst exportní obrázek."));
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
    throw new Error("DOCX neobsahuje žádnou vykreslitelnou stránku.");
  }

  const targetWidth = canvases[0].width || A4_WIDTH;
  const targetHeight = canvases[0].height || A4_HEIGHT;
  const columnWidth = targetWidth / canvases.length;
  const finalCanvas = document.createElement("canvas");

  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;

  const finalCtx = finalCanvas.getContext("2d");

  if (!finalCtx) {
    throw new Error("Nepodařilo se vytvořit finální plátno.");
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

function setWordAttribute(element: Element, name: string, value: string) {
  element.setAttributeNS(WORD_NAMESPACE, `w:${name}`, value);
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

function enforceA4PageSize(xmlDocument: Document) {
  getWordElements(xmlDocument, "pgSz").forEach((pageSize) => {
    setWordAttribute(pageSize, "w", A4_WIDTH_TWIPS);
    setWordAttribute(pageSize, "h", A4_HEIGHT_TWIPS);
    pageSize.removeAttributeNS(WORD_NAMESPACE, "orient");
  });
}

function applyAnswersToDocxXml(
  xmlDocument: Document,
  selectedAnswers: Answers,
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
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoints>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState(1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const docxPreviewRef = useRef<HTMLDivElement | null>(null);

  const answerBubbles = useAnswerBubbles(calibrationPoints);
  const currentCalibrationStep = CALIBRATION_STEPS[calibrationIndex];
  const filledCount = Object.keys(answers).length;
  const hasSheet = editorMode !== "empty";
  const isDocxMode = editorMode === "docx";
  const hasCalibration = answerBubbles.length > 0;
  const missingQuestions = useMemo(
    () =>
      Array.from({ length: 50 }, (_, index) => index + 1).filter(
        (question) => !answers[question],
      ),
    [answers],
  );

  useKeyboardAnswers({
    enabled: hasSheet && hasCalibration && !isCalibrationMode,
    activeQuestion,
    answers,
    setActiveQuestion,
    setAnswers,
    selectAnswer,
  });

  function applyImportedAnswerKey(importedAnswers: ImportedMoodleAnswer[]) {
    const matchedAnswers = importedAnswers.filter(
      (answer) => answer.status === "matched" && answer.correctOption,
    );

    if (matchedAnswers.length === 0) {
      return;
    }

    const nextAnswers = matchedAnswers.reduce<Answers>((result, answer) => {
      result[answer.question] = answer.correctOption!;
      return result;
    }, {});
    const nextActiveQuestion =
      importedAnswers.find((answer) => answer.status === "unresolved")?.question ??
      matchedAnswers[0].question;

    setAnswers((prev) => ({
      ...prev,
      ...nextAnswers,
    }));
    setActiveQuestion(nextActiveQuestion);
    setHoveredBubble(null);
  }

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
        alert("DOCX se nepodařilo zobrazit.");
      }
    }

    void renderDocxPreview();

    return () => {
      isCancelled = true;
      container.innerHTML = "";
    };
  }, [docxBuffer, isDocxMode]);

  function selectAnswer(question: number, option: AnswerOption) {
    setActiveQuestion(question);
    setAnswers((prev) => ({
      ...prev,
      [question]: option,
    }));
  }

  function clearAnswers() {
    setAnswers({});
    setActiveQuestion(1);
    setHoveredBubble(null);
  }

  function resetCalibration() {
    setCalibrationPoints({});
    setCalibrationIndex(0);
    clearAnswers();
  }

  function startCalibration() {
    resetCalibration();
    setIsCalibrationMode(true);
  }

  function toggleCalibration() {
    setIsCalibrationMode((prev) => !prev);
  }

  function saveCalibration() {
    if (!hasCalibration) {
      alert("Nejprve dokončete kalibraci.");
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(calibrationPoints));
      alert("Kalibrace byla uložena.");
    } catch (error) {
      console.error(error);
      alert("Kalibraci se nepodařilo uložit.");
    }
  }

  function loadCalibration() {
    try {
      const savedCalibration = localStorage.getItem(STORAGE_KEY);

      if (!savedCalibration) {
        alert("Nebyla nalezena uložená kalibrace.");
        return;
      }

      const parsedCalibration = JSON.parse(savedCalibration);

      if (!parsedCalibration || typeof parsedCalibration !== "object") {
        throw new Error("Uložená kalibrace má neplatný formát.");
      }

      setCalibrationPoints(parsedCalibration as CalibrationPoints);
      setCalibrationIndex(CALIBRATION_STEPS.length);
      setIsCalibrationMode(false);
      clearAnswers();
    } catch (error) {
      console.error(error);
      alert("Kalibraci se nepodařilo načíst.");
    }
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
      const baseName = fileName?.replace(/\.[^.]+$/u, "") || "odpovedni-arch";

      link.download = `${baseName}-vyplneny.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error(error);
      alert("Soubor PNG se nepodařilo vytvořit.");
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
        throw new Error("DOCX XML se nepodařilo načíst.");
      }

      applyAnswersToDocxXml(xmlDocument, answers);
      zip.file(
        "word/document.xml",
        new XMLSerializer().serializeToString(xmlDocument),
      );

      const blob = await zip.generateAsync({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const baseName = fileName?.replace(/\.docx$/i, "") || "odpovedni-arch";

      downloadBlob(blob, `${baseName}-vyplneny.docx`);
    } catch (error) {
      console.error(error);
      alert("Soubor DOCX se nepodařilo vytvořit.");
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
    event.target.value = "";

    if (!file) return;

    setFileName(file.name);
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

        if (!arrayBuffer.byteLength) {
          throw new Error("DOCX soubor je prázdný.");
        }

        setEditorMode("docx");
        setImageSrc(null);
        setDocxBuffer(arrayBuffer);
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
    <main className="min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#1e3a8a_0,#0f172a_38%,#020617_100%)] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute right-20 top-40 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative z-10 flex h-screen flex-col">
        <header className="border-b border-white/10 bg-white/6 px-6 py-4 shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto flex max-w-400 items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                OMR editor záznamových archů
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Kalibrace, vyplňování a export odpovědních archů
              </p>
            </div>

            <div className="flex items-center gap-3">
              {fileName && (
                <div className="hidden max-w-xs truncate rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 md:block">
                  {fileName}
                </div>
              )}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-blue-300/30 bg-blue-500/80 px-4 py-2 font-semibold text-white shadow-lg shadow-blue-500/20 backdrop-blur transition hover:bg-blue-400"
              >
                Nahrát arch
              </button>

              <button
                type="button"
                disabled={!hasSheet || !hasCalibration}
                onClick={exportSheet}
                className="rounded-xl border border-emerald-300/30 bg-emerald-400/90 px-4 py-2 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDocxMode ? "Exportovat DOCX" : "Exportovat PNG"}
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid min-h-0 w-full max-w-400 flex-1 grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-[320px_1fr]">
          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <ControlPanel
              hasSheet={hasSheet}
              isCalibrationMode={isCalibrationMode}
              startCalibration={startCalibration}
              toggleCalibration={toggleCalibration}
              clearAnswers={clearAnswers}
              saveCalibration={saveCalibration}
              loadCalibration={loadCalibration}
            />

            <MoodleImportPanel
              onApplyImportedAnswers={applyImportedAnswerKey}
            />

            <StatusPanel
              filledCount={filledCount}
              activeQuestion={activeQuestion}
              editorMode={editorMode}
              hasSheet={hasSheet}
              isDocxMode={isDocxMode}
              isCalibrationMode={isCalibrationMode}
              currentCalibrationStep={currentCalibrationStep}
              hasCalibration={hasCalibration}
              missingQuestions={missingQuestions}
            />

            {hasCalibration && !isCalibrationMode ? (
              <AnswersPanel
                answers={answers}
                activeQuestion={activeQuestion}
                setActiveQuestion={setActiveQuestion}
                selectAnswer={selectAnswer}
              />
            ) : null}
          </aside>

          <EditorCanvas
            hasSheet={hasSheet}
            isDocxMode={isDocxMode}
            activeQuestion={activeQuestion}
            imageSrc={imageSrc}
            imageSize={imageSize}
            setImageSize={setImageSize}
            stageRef={stageRef}
            docxPreviewRef={docxPreviewRef}
            isCalibrationMode={isCalibrationMode}
            calibrationPoints={calibrationPoints}
            answerBubbles={answerBubbles}
            answers={answers}
            hoveredBubble={hoveredBubble}
            setHoveredBubble={setHoveredBubble}
            handleStageClick={handleStageClick}
            handleDocxOverlayPointerDown={handleDocxOverlayPointerDown}
            selectAnswer={selectAnswer}
          />
        </div>
      </div>
    </main>
  );
}

export default App;
