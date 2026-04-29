import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const LINE_Y_TOLERANCE = 2;
const WORD_GAP_THRESHOLD = 1.5;

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item;
}

function appendFragment(
  fragments: string[],
  previousItem: TextItem | null,
  nextItem: TextItem,
) {
  const text = nextItem.str;

  if (!text) {
    return;
  }

  if (!previousItem) {
    fragments.push(text);
    return;
  }

  const previousText = fragments[fragments.length - 1] ?? "";
  const previousRightEdge = previousItem.transform[4] + previousItem.width;
  const gap = nextItem.transform[4] - previousRightEdge;
  const needsSpace =
    gap > WORD_GAP_THRESHOLD &&
    !previousText.endsWith(" ") &&
    !text.startsWith(" ") &&
    !/^[,.;:!?)]/u.test(text);

  fragments.push(needsSpace ? ` ${text}` : text);
}

function buildPageText(items: Array<TextItem | TextMarkedContent>) {
  const lines: string[] = [];
  let currentLineY: number | null = null;
  let currentFragments: string[] = [];
  let previousItem: TextItem | null = null;

  const flushLine = () => {
    if (currentFragments.length === 0) {
      return;
    }

    lines.push(currentFragments.join("").replace(/\s+/gu, " ").trim());
    currentFragments = [];
    currentLineY = null;
    previousItem = null;
  };

  for (const item of items) {
    if (!isTextItem(item)) {
      continue;
    }

    const itemY = item.transform[5];
    const startsNewLine =
      currentLineY !== null && Math.abs(itemY - currentLineY) > LINE_Y_TOLERANCE;

    if (startsNewLine) {
      flushLine();
    }

    currentLineY ??= itemY;
    appendFragment(currentFragments, previousItem, item);
    previousItem = item;

    if (item.hasEOL) {
      flushLine();
    }
  }

  flushLine();

  return lines.filter(Boolean).join("\n");
}

export async function extractPdfText(arrayBuffer: ArrayBuffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      pageTexts.push(buildPageText(textContent.items));
    }

    await pdf.destroy();

    return pageTexts.filter(Boolean).join("\n\n");
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
