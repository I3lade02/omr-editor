import type {
  AnswerOption,
  ImportedMoodleAnswer,
  MoodleAnswerImportResult,
} from "../types";

const OPTION_ORDER: AnswerOption[] = ["A", "B", "C", "D"];
const QUESTION_LINE_REGEX = /^úloha$/iu;
const QUESTION_WITH_NUMBER_REGEX = /^úloha\s*(\d+)$/iu;
const OPTION_LABEL_REGEX: Record<AnswerOption, RegExp> = {
  A: /^[aA]\.\s*/u,
  B: /^[bB]\.\s*/u,
  C: /^[cC]\.\s*/u,
  D: /^[dD]\.\s*/u,
};
const ANSWER_MARKER_REGEX = /^správná\s+odpověď\s+je\s*:\s*/iu;
const STRUCTURAL_STOP_REGEX =
  /^(úloha(?:\s+\d+)?|nezodpovězeno|zodpovězeno|počet bodů|správná odpověď je\s*:)/iu;

type ParsedLine = {
  raw: string;
  normalized: string;
};

function toDisplayText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u00A0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.,;:!?]+$/u, "")
    .trim();
}

export function normalizeMoodleComparisonText(value: string) {
  return toDisplayText(value).toLocaleLowerCase("cs-CZ");
}

function normalizeLooseComparisonText(value: string) {
  return normalizeMoodleComparisonText(value)
    .replace(/["'“”„‚’`]/gu, "")
    .replace(/[()[\]{}.,;:!?]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function toParsedLines(rawText: string): ParsedLine[] {
  return rawText
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/\u00A0/gu, " ").replace(/[ \t]+/gu, " ").trim())
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      normalized: line.normalize("NFC"),
    }));
}

function isOptionLabel(line: ParsedLine, option: AnswerOption) {
  return OPTION_LABEL_REGEX[option].test(line.normalized);
}

function isAnswerMarker(line: ParsedLine) {
  return ANSWER_MARKER_REGEX.test(line.normalized);
}

function findNextIndex(
  lines: ParsedLine[],
  startIndex: number,
  predicate: (line: ParsedLine) => boolean,
) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (predicate(lines[index])) {
      return index;
    }
  }

  return -1;
}

function extractSectionText(
  lines: ParsedLine[],
  startIndex: number,
  endIndex: number,
  option?: AnswerOption,
) {
  const parts = lines
    .slice(startIndex, endIndex)
    .map((line, index) =>
      index === 0 && option
        ? line.normalized.replace(OPTION_LABEL_REGEX[option], "")
        : line.normalized,
    )
    .filter(Boolean);

  return toDisplayText(parts.join(" "));
}

function extractCorrectText(lines: ParsedLine[], answerIndex: number) {
  const firstLine = lines[answerIndex].normalized.replace(ANSWER_MARKER_REGEX, "");
  const parts = firstLine ? [firstLine] : [];

  for (let index = answerIndex + 1; index < lines.length; index += 1) {
    const currentLine = lines[index];

    if (
      STRUCTURAL_STOP_REGEX.test(currentLine.normalized) ||
      OPTION_ORDER.some((option) => isOptionLabel(currentLine, option))
    ) {
      break;
    }

    parts.push(currentLine.normalized);
  }

  return toDisplayText(parts.join(" "));
}

function extractQuestionNumber(lines: ParsedLine[], blockStartIndex: number) {
  const searchStart = Math.max(0, blockStartIndex - 12);

  for (let index = blockStartIndex; index >= searchStart; index -= 1) {
    const currentLine = lines[index].normalized;
    const inlineMatch = currentLine.match(QUESTION_WITH_NUMBER_REGEX);

    if (inlineMatch) {
      return Number(inlineMatch[1]);
    }

    if (QUESTION_LINE_REGEX.test(currentLine)) {
      for (
        let lookaheadIndex = index + 1;
        lookaheadIndex <= Math.min(index + 3, blockStartIndex);
        lookaheadIndex += 1
      ) {
        const candidate = lines[lookaheadIndex].normalized.match(/^(\d+)$/u);

        if (candidate) {
          return Number(candidate[1]);
        }
      }
    }
  }

  return null;
}

function resolveCorrectOption(
  options: Record<AnswerOption, string>,
  correctText: string,
) {
  const exactMatches = OPTION_ORDER.filter(
    (option) =>
      normalizeMoodleComparisonText(options[option]) ===
      normalizeMoodleComparisonText(correctText),
  );

  if (exactMatches.length === 1) {
    return { correctOption: exactMatches[0], error: undefined };
  }

  if (exactMatches.length > 1) {
    return {
      correctOption: null,
      error: "Correct answer text matched multiple options.",
    };
  }

  const looseMatches = OPTION_ORDER.filter(
    (option) =>
      normalizeLooseComparisonText(options[option]) ===
      normalizeLooseComparisonText(correctText),
  );

  if (looseMatches.length === 1) {
    return { correctOption: looseMatches[0], error: undefined };
  }

  const correctLooseText = normalizeLooseComparisonText(correctText);
  const partialMatches = OPTION_ORDER.filter((option) => {
    const optionLooseText = normalizeLooseComparisonText(options[option]);

    return (
      optionLooseText.includes(correctLooseText) ||
      correctLooseText.includes(optionLooseText)
    );
  });

  if (partialMatches.length === 1) {
    return { correctOption: partialMatches[0], error: undefined };
  }

  return {
    correctOption: null,
    error: "Correct answer text could not be matched to options A-D.",
  };
}

function buildImportedAnswer(
  question: number,
  options: Record<AnswerOption, string>,
  correctText: string,
): ImportedMoodleAnswer {
  if (!correctText) {
    return {
      question,
      correctOption: null,
      correctText: "",
      options,
      status: "unresolved",
      error: "Missing correct answer text.",
    };
  }

  const { correctOption, error } = resolveCorrectOption(options, correctText);

  return {
    question,
    correctOption,
    correctText,
    options,
    status: correctOption ? "matched" : "unresolved",
    error,
  };
}

export function parseMoodleAnswerText(rawText: string): MoodleAnswerImportResult {
  const lines = toParsedLines(rawText);
  const answers: ImportedMoodleAnswer[] = [];
  const errors: string[] = [];
  const usedQuestions = new Set<number>();
  let sequentialQuestion = 1;
  let cursor = 0;

  while (cursor < lines.length) {
    const aIndex = findNextIndex(lines, cursor, (line) => isOptionLabel(line, "A"));

    if (aIndex === -1) {
      break;
    }

    const bIndex = findNextIndex(lines, aIndex + 1, (line) => isOptionLabel(line, "B"));
    const cIndex = findNextIndex(lines, bIndex + 1, (line) => isOptionLabel(line, "C"));
    const dIndex = findNextIndex(lines, cIndex + 1, (line) => isOptionLabel(line, "D"));
    const answerIndex = findNextIndex(lines, dIndex + 1, isAnswerMarker);

    if ([bIndex, cIndex, dIndex, answerIndex].some((index) => index === -1)) {
      errors.push(`Skipped a potential Moodle block near line ${aIndex + 1}.`);
      cursor = aIndex + 1;
      continue;
    }

    const extractedQuestion = extractQuestionNumber(lines, aIndex);
    const question =
      extractedQuestion !== null && !usedQuestions.has(extractedQuestion)
        ? extractedQuestion
        : sequentialQuestion;

    if (extractedQuestion !== null && usedQuestions.has(extractedQuestion)) {
      errors.push(
        `Duplicate question number ${extractedQuestion} detected. Falling back to sequential numbering for one block.`,
      );
    }

    usedQuestions.add(question);
    sequentialQuestion = Math.max(sequentialQuestion + 1, question + 1);

    const options: Record<AnswerOption, string> = {
      A: extractSectionText(lines, aIndex, bIndex, "A"),
      B: extractSectionText(lines, bIndex, cIndex, "B"),
      C: extractSectionText(lines, cIndex, dIndex, "C"),
      D: extractSectionText(lines, dIndex, answerIndex, "D"),
    };
    const correctText = extractCorrectText(lines, answerIndex);
    const importedAnswer = buildImportedAnswer(question, options, correctText);

    if (importedAnswer.error) {
      errors.push(`Question ${question}: ${importedAnswer.error}`);
    }

    answers.push(importedAnswer);
    cursor = answerIndex + 1;
  }

  if (answers.length === 0) {
    errors.push("No Moodle answer blocks were found in the extracted PDF text.");
  }

  return {
    answers,
    rawText,
    errors,
  };
}
