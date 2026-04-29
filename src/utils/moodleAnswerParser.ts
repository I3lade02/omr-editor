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
  normalized: string;
};

type ResolveCorrectOptionResult = {
  correctOption: AnswerOption | null;
  error?: string;
  analysis?: string[];
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

function tokenizeForComparison(value: string) {
  return normalizeLooseComparisonText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function formatOptionList(options: AnswerOption[]) {
  if (options.length === 0) {
    return "";
  }

  if (options.length === 1) {
    return options[0];
  }

  if (options.length === 2) {
    return `${options[0]} a ${options[1]}`;
  }

  return `${options.slice(0, -1).join(", ")} a ${options[options.length - 1]}`;
}

function toParsedLines(rawText: string): ParsedLine[] {
  return rawText
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/\u00A0/gu, " ").replace(/[ \t]+/gu, " ").trim())
    .filter(Boolean)
    .map((line) => ({
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

function buildSimilarityAnalysis(
  options: Record<AnswerOption, string>,
  correctText: string,
) {
  const correctLooseText = normalizeLooseComparisonText(correctText);

  if (!correctLooseText) {
    return [
      "Po vyčištění textu nezůstala žádná použitelná slova pro porovnání.",
      "PDF pravděpodobně vrátilo jen interpunkci nebo neúplný úryvek odpovědi.",
    ];
  }

  const correctTokens = new Set(tokenizeForComparison(correctText));
  const rankedOptions = OPTION_ORDER.map((option) => {
    const optionLooseText = normalizeLooseComparisonText(options[option]);
    const optionTokens = Array.from(new Set(tokenizeForComparison(options[option])));
    const sharedTokens = optionTokens.filter((token) => correctTokens.has(token));
    const hasContainment =
      Boolean(optionLooseText) &&
      (optionLooseText.includes(correctLooseText) ||
        correctLooseText.includes(optionLooseText));

    return {
      option,
      optionLooseText,
      sharedTokens,
      score: sharedTokens.length + (hasContainment ? 0.5 : 0),
    };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const analysis: string[] = [];

  if (rankedOptions.length > 0) {
    const topCandidates = rankedOptions.slice(0, 2);

    analysis.push(
      `Nejblíže vychází možnosti ${formatOptionList(
        topCandidates.map((candidate) => candidate.option),
      )}.`,
    );

    topCandidates.forEach((candidate) => {
      if (candidate.sharedTokens.length > 0) {
        analysis.push(
          `Možnost ${candidate.option} sdílí slova: ${candidate.sharedTokens
            .slice(0, 5)
            .join(", ")}.`,
        );
      }
    });

    const bestCandidate = topCandidates[0];

    if (
      bestCandidate.optionLooseText &&
      correctLooseText.length < bestCandidate.optionLooseText.length * 0.55
    ) {
      analysis.push(
        "Text správné odpovědi je výrazně kratší než nejbližší možnost, z PDF se nejspíš načetl jen úryvek.",
      );
    } else if (
      bestCandidate.optionLooseText &&
      correctLooseText.length > bestCandidate.optionLooseText.length * 1.6
    ) {
      analysis.push(
        "Text správné odpovědi je výrazně delší než nejbližší možnost, mohl se k němu připojit i okolní text.",
      );
    }
  } else {
    analysis.push(
      "Text správné odpovědi nesdílí s žádnou možností dost společných slov.",
    );
  }

  analysis.push(
    "Zkontroluj, zda PDF obsahuje textovou vrstvu a zda nejsou možnosti nebo správná odpověď rozdělené přes více řádků.",
  );

  return analysis;
}

function describeIncompleteBlock(lines: ParsedLine[], blockStartIndex: number) {
  const directIndexes = {
    B: findNextIndex(lines, blockStartIndex + 1, (line) => isOptionLabel(line, "B")),
    C: findNextIndex(lines, blockStartIndex + 1, (line) => isOptionLabel(line, "C")),
    D: findNextIndex(lines, blockStartIndex + 1, (line) => isOptionLabel(line, "D")),
    answer: findNextIndex(lines, blockStartIndex + 1, isAnswerMarker),
  };
  const missingParts = [
    directIndexes.B === -1 ? "volba B" : null,
    directIndexes.C === -1 ? "volba C" : null,
    directIndexes.D === -1 ? "volba D" : null,
    directIndexes.answer === -1 ? 'řádek "správná odpověď je:"' : null,
  ].filter(Boolean);
  const orderIndexes = [
    directIndexes.B,
    directIndexes.C,
    directIndexes.D,
    directIndexes.answer,
  ].filter((index) => index !== -1);
  const outOfOrder = orderIndexes.some(
    (index, position) => position > 0 && index < orderIndexes[position - 1],
  );
  const reasons: string[] = [];

  if (missingParts.length > 0) {
    reasons.push(`chybí ${missingParts.join(", ")}`);
  }

  if (outOfOrder) {
    reasons.push("nalezené části nejsou v očekávaném pořadí A, B, C, D, správná odpověď");
  }

  if (reasons.length === 0) {
    reasons.push("blok neodpovídá očekávané struktuře Moodlu");
  }

  return `Byl přeskočen možný blok Moodlu poblíž řádku ${
    blockStartIndex + 1
  }: ${reasons.join("; ")}.`;
}

function resolveCorrectOption(
  options: Record<AnswerOption, string>,
  correctText: string,
): ResolveCorrectOptionResult {
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
      error: "Text správné odpovědi odpovídá více možnostem.",
      analysis: [
        `Stejný text mají možnosti ${formatOptionList(exactMatches)}.`,
        "Parser proto nedokáže určit jedinou správnou volbu.",
      ],
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

  if (looseMatches.length > 1) {
    return {
      correctOption: null,
      error: "Po zjednodušení textu odpovídá správná odpověď více možnostem.",
      analysis: [
        `Po odstranění interpunkce a uvozovek se shodují možnosti ${formatOptionList(
          looseMatches,
        )}.`,
        "Rozdíl mezi možnostmi byl v PDF pravděpodobně potlačen nebo ztracen.",
      ],
    };
  }

  const correctLooseText = normalizeLooseComparisonText(correctText);
  const partialMatches = correctLooseText
    ? OPTION_ORDER.filter((option) => {
        const optionLooseText = normalizeLooseComparisonText(options[option]);

        return (
          optionLooseText.includes(correctLooseText) ||
          correctLooseText.includes(optionLooseText)
        );
      })
    : [];

  if (partialMatches.length === 1) {
    return { correctOption: partialMatches[0], error: undefined };
  }

  if (partialMatches.length > 1) {
    return {
      correctOption: null,
      error: "Text správné odpovědi je příliš obecný a sedí na více možností.",
      analysis: [
        `Částečně odpovídají možnosti ${formatOptionList(partialMatches)}.`,
        "Parser našel jen kus textu, který nestačí na jednoznačné přiřazení.",
      ],
    };
  }

  return {
    correctOption: null,
    error: "Text správné odpovědi se nepodařilo spárovat s možnostmi A-D.",
    analysis: buildSimilarityAnalysis(options, correctText),
  };
}

function buildImportedAnswer(
  question: number,
  options: Record<AnswerOption, string>,
  correctText: string,
  analysis: string[] = [],
): ImportedMoodleAnswer {
  if (!correctText) {
    return {
      question,
      correctOption: null,
      correctText: "",
      options,
      status: "unresolved",
      error: "Chybí text správné odpovědi.",
      analysis: [
        ...analysis,
        "Řádek se správnou odpovědí byl prázdný nebo se z PDF nepodařilo vyčíst jeho obsah.",
        "Zkontroluj, zda PDF není jen obrázek bez textové vrstvy.",
      ],
    };
  }

  const { correctOption, error, analysis: resolveAnalysis } = resolveCorrectOption(
    options,
    correctText,
  );

  return {
    question,
    correctOption,
    correctText,
    options,
    status: correctOption ? "matched" : "unresolved",
    error,
    analysis:
      analysis.length > 0 || (resolveAnalysis?.length ?? 0) > 0
        ? [...analysis, ...(resolveAnalysis ?? [])]
        : undefined,
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
      errors.push(describeIncompleteBlock(lines, aIndex));
      cursor = aIndex + 1;
      continue;
    }

    const extractedQuestion = extractQuestionNumber(lines, aIndex);
    const hasDuplicateQuestion =
      extractedQuestion !== null && usedQuestions.has(extractedQuestion);
    const question =
      extractedQuestion !== null && !usedQuestions.has(extractedQuestion)
        ? extractedQuestion
        : sequentialQuestion;

    if (hasDuplicateQuestion) {
      errors.push(
        `Bylo zjištěno duplicitní číslo úlohy ${extractedQuestion}. Pro jeden blok bylo použito pořadové číslování.`,
      );
    }

    if (extractedQuestion === null) {
      errors.push(
        `Blok poblíž řádku ${aIndex + 1} neměl čitelné číslo úlohy. Bylo použito pořadové číslo ${question}.`,
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
    const answerAnalysis: string[] = [];

    if (extractedQuestion === null) {
      answerAnalysis.push(
        `Číslo úlohy nebylo v PDF čitelné, proto byl použit pořadový index ${question}.`,
      );
    }

    if (hasDuplicateQuestion) {
      answerAnalysis.push(
        `Původní číslo úlohy ${extractedQuestion} už parser použil dříve, proto tento blok dostal náhradní číslo ${question}.`,
      );
    }

    const importedAnswer = buildImportedAnswer(
      question,
      options,
      correctText,
      answerAnalysis,
    );

    if (importedAnswer.error) {
      errors.push(`Úloha ${question}: ${importedAnswer.error}`);
    }

    answers.push(importedAnswer);
    cursor = answerIndex + 1;
  }

  if (answers.length === 0) {
    errors.push("V extrahovaném textu z PDF nebyly nalezeny bloky odpovědí z Moodlu.");
  }

  return {
    answers,
    rawText,
    errors,
  };
}
