import type { AnswerOption, CalibrationPoint } from "./types";

export const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;
export const BUBBLE_RADIUS = 11;

export const STORAGE_KEY = "omr-calibration";

export const CALIBRATION_STEPS: CalibrationPoint[] = [
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
