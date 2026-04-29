import { useMemo } from "react";
import type { CalibrationPoints } from "../types";
import { buildAnswerBubbles } from "../utils/calibration";

export function useAnswerBubbles(calibrationPoints: CalibrationPoints) {
    return useMemo(
        () => buildAnswerBubbles(calibrationPoints),
        [calibrationPoints],
    );
}