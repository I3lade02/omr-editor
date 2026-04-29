import { BUBBLE_RADIUS } from "../constants";
import type {
  AnswerBubble,
  AnswerOption,
  Answers,
  CalibrationPoints,
  ImageSize,
} from "../types";

type Props = {
  docxPreviewRef: React.RefObject<HTMLDivElement | null>;
  imageSize: ImageSize;
  activeQuestion: number;
  isCalibrationMode: boolean;
  calibrationPoints: CalibrationPoints;
  answerBubbles: AnswerBubble[];
  answers: Answers;
  hoveredBubble: string | null;
  setHoveredBubble: React.Dispatch<React.SetStateAction<string | null>>;
  handleDocxOverlayPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  selectAnswer: (question: number, option: AnswerOption) => void;
};

export function DocxEditor({
  docxPreviewRef,
  imageSize,
  activeQuestion,
  isCalibrationMode,
  calibrationPoints,
  answerBubbles,
  answers,
  hoveredBubble,
  setHoveredBubble,
  handleDocxOverlayPointerDown,
  selectAnswer,
}: Props) {
  function getBubbleKey(bubble: AnswerBubble) {
    return `${bubble.question}-${bubble.option}`;
  }

  const activeQuestionBubbles = answerBubbles.filter(
    (bubble) => bubble.question === activeQuestion,
  );
  const activeQuestionBounds =
    !isCalibrationMode && activeQuestionBubbles.length > 0
      ? {
          left:
            Math.min(...activeQuestionBubbles.map((bubble) => bubble.x)) -
            BUBBLE_RADIUS -
            16,
          top:
            Math.min(...activeQuestionBubbles.map((bubble) => bubble.y)) -
            BUBBLE_RADIUS -
            10,
          width:
            Math.max(...activeQuestionBubbles.map((bubble) => bubble.x)) -
            Math.min(...activeQuestionBubbles.map((bubble) => bubble.x)) +
            (BUBBLE_RADIUS + 16) * 2,
          height:
            Math.max(...activeQuestionBubbles.map((bubble) => bubble.y)) -
            Math.min(...activeQuestionBubbles.map((bubble) => bubble.y)) +
            (BUBBLE_RADIUS + 10) * 2,
        }
      : null;

  return (
    <div
      className="relative mx-auto overflow-hidden bg-white shadow-[0_30px_120px_rgba(0,0,0,0.75)]"
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
        {activeQuestionBounds ? (
          <div
            className="absolute rounded-[18px] border-2 border-cyan-400/90 bg-cyan-300/10"
            style={{
              left: activeQuestionBounds.left,
              top: activeQuestionBounds.top,
              width: activeQuestionBounds.width,
              height: activeQuestionBounds.height,
              boxShadow: "0 0 0 1px rgba(34, 211, 238, 0.3)",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {isCalibrationMode &&
          Object.entries(calibrationPoints).map(([key, point]) => (
            <span
              key={key}
              className="absolute block h-2.5 w-2.5 rounded-full bg-red-600 shadow-lg shadow-red-500/70"
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
            const isSelected = answers[bubble.question] === bubble.option;
            const isHovered = hoveredBubble === bubbleKey;
            const isActiveQuestion = bubble.question === activeQuestion;
            const radius =
              isHovered && !isSelected
                ? BUBBLE_RADIUS + 1
                : isActiveQuestion
                  ? BUBBLE_RADIUS + 0.5
                  : BUBBLE_RADIUS;

            return (
              <button
                key={bubbleKey}
                type="button"
                aria-label={`${bubble.question}${bubble.option}`}
                className="absolute rounded-full transition"
                style={{
                  left: bubble.x - radius,
                  top: bubble.y - radius,
                  width: radius * 2,
                  height: radius * 2,
                  background: isSelected
                    ? "black"
                    : isHovered
                      ? "rgba(0,0,0,0.28)"
                      : isActiveQuestion
                        ? "rgba(34,211,238,0.16)"
                        : "rgba(255,255,255,0)",
                  border:
                    isHovered && !isSelected
                      ? "2px solid black"
                      : isActiveQuestion && !isSelected
                        ? "2px solid rgba(34,211,238,0.95)"
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
  );
}
