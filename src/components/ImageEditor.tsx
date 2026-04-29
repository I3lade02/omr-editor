import { Circle, Layer, Rect, Stage } from "react-konva";
import type Konva from "konva";
import { BUBBLE_RADIUS } from "../constants";
import type {
  AnswerBubble,
  AnswerOption,
  Answers,
  CalibrationPoints,
  ImageSize,
} from "../types";
import { UploadedImage } from "./UploadedImage";

type Props = {
  imageSrc: string | null;
  imageSize: ImageSize;
  setImageSize: React.Dispatch<React.SetStateAction<ImageSize>>;
  stageRef: React.RefObject<Konva.Stage | null>;
  activeQuestion: number;
  isCalibrationMode: boolean;
  calibrationPoints: CalibrationPoints;
  answerBubbles: AnswerBubble[];
  answers: Answers;
  hoveredBubble: string | null;
  setHoveredBubble: React.Dispatch<React.SetStateAction<string | null>>;
  handleStageClick: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  selectAnswer: (question: number, option: AnswerOption) => void;
};

export function ImageEditor({
  imageSrc,
  imageSize,
  setImageSize,
  stageRef,
  activeQuestion,
  isCalibrationMode,
  calibrationPoints,
  answerBubbles,
  answers,
  hoveredBubble,
  setHoveredBubble,
  handleStageClick,
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
          x:
            Math.min(...activeQuestionBubbles.map((bubble) => bubble.x)) -
            BUBBLE_RADIUS -
            16,
          y:
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
    <div className="mx-auto w-fit overflow-hidden bg-white shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
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

          {activeQuestionBounds ? (
            <Rect
              x={activeQuestionBounds.x}
              y={activeQuestionBounds.y}
              width={activeQuestionBounds.width}
              height={activeQuestionBounds.height}
              cornerRadius={18}
              fill="rgba(34,211,238,0.10)"
              stroke="rgba(34,211,238,0.95)"
              strokeWidth={2}
              dash={[10, 6]}
              listening={false}
            />
          ) : null}

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
              const isSelected = answers[bubble.question] === bubble.option;
              const isHovered = hoveredBubble === bubbleKey;
              const isActiveQuestion = bubble.question === activeQuestion;

              return (
                <Circle
                  key={bubbleKey}
                  x={bubble.x}
                  y={bubble.y}
                  radius={
                    isHovered && !isSelected
                      ? BUBBLE_RADIUS + 1
                      : isActiveQuestion
                        ? BUBBLE_RADIUS + 0.5
                        : BUBBLE_RADIUS
                  }
                  stroke={
                    isSelected
                      ? undefined
                      : isHovered
                        ? "black"
                        : isActiveQuestion
                          ? "rgba(34,211,238,0.95)"
                          : "rgba(0,0,0,0)"
                  }
                  strokeWidth={
                    isHovered && !isSelected
                      ? 2
                      : isActiveQuestion && !isSelected
                        ? 2
                        : 1
                  }
                  fill={
                    isSelected
                      ? "black"
                      : isHovered
                        ? "rgba(0,0,0,0.28)"
                        : isActiveQuestion
                          ? "rgba(34,211,238,0.16)"
                          : "rgba(255,255,255,0)"
                  }
                  onMouseEnter={(event) => {
                    setHoveredBubble(bubbleKey);

                    const container = event.target.getStage()?.container();
                    if (container) container.style.cursor = "pointer";
                  }}
                  onMouseLeave={(event) => {
                    setHoveredBubble(null);

                    const container = event.target.getStage()?.container();
                    if (container) container.style.cursor = "default";
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
  );
}
