import type { CalibrationPoint, EditorMode } from "../types";

type Props = {
  filledCount: number;
  activeQuestion: number;
  editorMode: EditorMode;
  hasSheet: boolean;
  isDocxMode: boolean;
  isCalibrationMode: boolean;
  currentCalibrationStep?: CalibrationPoint;
  hasCalibration: boolean;
  missingQuestions: number[];
};

export function StatusPanel({
  filledCount,
  activeQuestion,
  editorMode,
  hasSheet,
  isDocxMode,
  isCalibrationMode,
  currentCalibrationStep,
  hasCalibration,
  missingQuestions,
}: Props) {
  const showActiveQuestion = hasSheet && hasCalibration && !isCalibrationMode;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
        Stav
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Vyplněno</p>
          <p className="mt-1 text-2xl font-bold">{filledCount}/50</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Režim</p>
          <p className="mt-1 text-lg font-bold">
            {editorMode === "empty" ? "Prázdný" : isDocxMode ? "DOCX" : "Obrázek"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
        {showActiveQuestion ? (
          <p className="mb-2 font-semibold text-cyan-200">
            Aktivní otázka: {activeQuestion}
          </p>
        ) : null}

        {hasSheet ? (
          isCalibrationMode && currentCalibrationStep ? (
            <p className="text-amber-200">{currentCalibrationStep.label}</p>
          ) : !hasCalibration ? (
            <p className="text-slate-300">
              Nejprve spusť kalibraci a klikej na požadované bubliny
            </p>
          ) : missingQuestions.length > 0 ? (
            <p className="text-amber-200">
              Chybějící odpovědi: {missingQuestions.slice(0, 8).join(", ")}
              {missingQuestions.length > 8 ? "..." : ""}
            </p>
          ) : (
            <p className="text-emerald-200">Všech 50 odpovědí je vyplněno</p>
          )
        ) : (
          <p className="text-slate-300">
            Nahraj DOCX nebo obrázek odpovědního archu
          </p>
        )}
      </div>
    </section>
  );
}
