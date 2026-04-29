export type AnswerOption = "A" | "B" | "C" | "D";

export type Point = {
    x: number;
    y: number;
};

export type ImageSize = {
    width: number;
    height: number;
};

export type AnswerBubble = {
    question: number;
    option: AnswerOption;
    x: number;
    y: number;
};

export type EditorMode = "empty" | "image" | "docx";

export type CalibrationKey =
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

export type CalibrationPoint = {
    key: CalibrationKey;
    label: string;
};

export type CalibrationPoints = Partial<Record<CalibrationKey, Point>>;
export type Answers = Record<number, AnswerOption>;

export type ImportedMoodleAnswer = {
    question: number;
    correctOption: AnswerOption | null;
    correctText: string;
    options: Record<AnswerOption, string>;
    status: "matched" | "unresolved";
    error?: string;
    analysis?: string[];
};

export type MoodleAnswerImportResult = {
    answers: ImportedMoodleAnswer[];
    rawText: string;
    errors: string[];
};
