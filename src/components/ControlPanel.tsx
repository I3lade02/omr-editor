type Props = {
  hasSheet: boolean;
  isCalibrationMode: boolean;
  startCalibration: () => void;
  toggleCalibration: () => void;
  clearAnswers: () => void;
  saveCalibration: () => void;
  loadCalibration: () => void;
};

export function ControlPanel({
  hasSheet,
  isCalibrationMode,
  startCalibration,
  toggleCalibration,
  clearAnswers,
  saveCalibration,
  loadCalibration,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
          Ovládání
        </p>
        <h2 className="mt-1 text-lg font-semibold">Pracovní panel</h2>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={!hasSheet}
          onClick={startCalibration}
          className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Spustit kalibraci
        </button>

        <button
          type="button"
          disabled={!hasSheet}
          onClick={toggleCalibration}
          className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isCalibrationMode ? "Vypnout kalibraci" : "Kalibrační režim"}
        </button>

        <button
          type="button"
          onClick={saveCalibration}
          className="w-full rounded-2xl border border-blue-300/30 bg-blue-500/70 px-4 py-3 font-semibold text-white transition hover:bg-blue-400"
        >
          Uložit kalibraci
        </button>

        <button
          type="button"
          onClick={loadCalibration}
          className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-500/70 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Načíst kalibraci
        </button>

        <button
          type="button"
          onClick={clearAnswers}
          className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 font-semibold text-red-200 transition hover:bg-red-500/20"
        >
          Smazat odpovědi
        </button>
      </div>
    </section>
  );
}