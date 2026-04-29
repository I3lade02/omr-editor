import { OPTIONS } from "../constants";
import type {
  AnswerBubble,
  AnswerOption,
  CalibrationPoints,
  Point,
} from "../types";

export function interpolatePoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

export function generateColumnBubbles(
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
      const point = interpolatePoint(topPoints[option], bottomPoints[option], t);

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

export function buildAnswerBubbles(points: CalibrationPoints): AnswerBubble[] {
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
  } = points;

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
}