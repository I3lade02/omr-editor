import type Konva from "konva";
import type {
  AnswerBubble,
  AnswerOption,
  Answers,
  CalibrationPoints,
  ImageSize,
} from "../types";
import { DocxEditor } from "./DocxEditor";
import { ImageEditor } from "./ImageEditor";

type Props = {
  hasSheet: boolean;
  isDocxMode: boolean;
  activeQuestion: number;
  imageSrc: string | null;
  imageSize: ImageSize;
  setImageSize: React.Dispatch<React.SetStateAction<ImageSize>>;
  stageRef: React.RefObject<Konva.Stage | null>;
  docxPreviewRef: React.RefObject<HTMLDivElement | null>;
  isCalibrationMode: boolean;
  calibrationPoints: CalibrationPoints;
  answerBubbles: AnswerBubble[];
  answers: Answers;
  hoveredBubble: string | null;
  setHoveredBubble: React.Dispatch<React.SetStateAction<string | null>>;
  handleStageClick: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  handleDocxOverlayPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  selectAnswer: (question: number, option: AnswerOption) => void;
};

export function EditorCanvas({
  hasSheet,
  isDocxMode,
  activeQuestion,
  imageSrc,
  imageSize,
  setImageSize,
  stageRef,
  docxPreviewRef,
  isCalibrationMode,
  calibrationPoints,
  answerBubbles,
  answers,
  hoveredBubble,
  setHoveredBubble,
  handleStageClick,
  handleDocxOverlayPointerDown,
  selectAnswer,
}: Props) {
  return (
    <section className="min-h-0 rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-2xl">
      {!hasSheet ? (
        <div className="flex h-full min-h-162.5 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-black/20 text-slate-300">
          <div className="text-center">
            <p className="text-5xl">📜</p>
            <p className="mt-4 text-xl font-semibold pt-2">
              Zatím není nahraný žádný arch
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Začni tlačítkem "Nahrát arch"
            </p>
          </div>
        </div>
      ) : (
        <div className="h-full max-h-[calc(100vh-150px)] overflow-auto rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          {isDocxMode ? (
            <DocxEditor
              docxPreviewRef={docxPreviewRef}
              imageSize={imageSize}
              activeQuestion={activeQuestion}
              isCalibrationMode={isCalibrationMode}
              calibrationPoints={calibrationPoints}
              answerBubbles={answerBubbles}
              answers={answers}
              hoveredBubble={hoveredBubble}
              setHoveredBubble={setHoveredBubble}
              handleDocxOverlayPointerDown={handleDocxOverlayPointerDown}
              selectAnswer={selectAnswer}
            />
          ) : (
            <ImageEditor
              imageSrc={imageSrc}
              imageSize={imageSize}
              setImageSize={setImageSize}
              stageRef={stageRef}
              activeQuestion={activeQuestion}
              isCalibrationMode={isCalibrationMode}
              calibrationPoints={calibrationPoints}
              answerBubbles={answerBubbles}
              answers={answers}
              hoveredBubble={hoveredBubble}
              setHoveredBubble={setHoveredBubble}
              handleStageClick={handleStageClick}
              selectAnswer={selectAnswer}
            />
          )}
        </div>
      )}
    </section>
  );
}
