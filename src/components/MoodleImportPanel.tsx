import { useEffect, useMemo, useRef, useState } from "react";
import { parseMoodleAnswerText } from "../utils/moodleAnswerParser";
import { extractPdfText } from "../utils/pdfTextExtractor";
import type { ImportedMoodleAnswer, MoodleAnswerImportResult } from "../types";

type Props = {
  onApplyImportedAnswers: (answers: ImportedMoodleAnswer[]) => void;
};

function getStatusLabel(status: ImportedMoodleAnswer["status"]) {
  return status === "matched" ? "Spárováno" : "Nevyřešeno";
}

export function MoodleImportPanel({ onApplyImportedAnswers }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<MoodleAnswerImportResult | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const matchedCount = useMemo(
    () =>
      importResult?.answers.filter((answer) => answer.status === "matched").length ??
      0,
    [importResult],
  );
  const unresolvedCount = useMemo(
    () =>
      importResult?.answers.filter((answer) => answer.status === "unresolved")
        .length ?? 0,
    [importResult],
  );

  useEffect(() => {
    if (!isDetailsOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDetailsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailsOpen]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsImporting(true);
    setIsDetailsOpen(false);
    setFileName(file.name);
    setImportResult(null);
    setImportError(null);
    setApplyMessage(null);

    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        throw new Error("Vyber export PDF z Moodlu.");
      }

      const arrayBuffer = await file.arrayBuffer();
      const rawText = await extractPdfText(arrayBuffer);
      const nextResult = parseMoodleAnswerText(rawText);

      setImportResult(nextResult);

      if (!nextResult.answers.length) {
        setImportError("V nahraném PDF nebyly nalezeny bloky odpovědí z Moodlu.");
      }
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error
          ? error.message
          : "PDF z Moodlu se nepodařilo importovat.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleApply() {
    if (!importResult || matchedCount === 0) {
      return;
    }

    onApplyImportedAnswers(importResult.answers);
    setApplyMessage(`Bylo použito ${matchedCount} importovaných odpovědí.`);
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
              PDF z Moodlu
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Import správných odpovědí
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Nahraj náhled nebo výsledkové PDF z Moodlu se strojově čitelným
              textem. Parser převede text správné odpovědi zpět na volbu A-D.
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isImporting}
            className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isImporting ? "Importuji..." : "Vybrat PDF"}
          </button>
        </div>

        {fileName ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
            {fileName}
          </div>
        ) : null}

        {importError ? (
          <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {importError}
          </div>
        ) : null}

        {importResult ? (
          <>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-slate-100">Import dokončen</p>
              <p className="mt-1 text-sm text-slate-300">
                Rozpoznáno {importResult.answers.length} úloh, spárováno{" "}
                {matchedCount}, nevyřešeno {unresolvedCount}.
              </p>

              {unresolvedCount > 0 ? (
                <p className="mt-2 text-sm text-amber-200">
                  U nevyřešených položek je v detailu rozepsaný konkrétní důvod.
                </p>
              ) : null}

              {importResult.errors.length > 0 ? (
                <p className="mt-2 text-sm text-amber-200">
                  Import obsahuje upozornění. Detail je v okně s výsledky.
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(true)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
              >
                Zobrazit detail importu
              </button>

              <button
                type="button"
                disabled={matchedCount === 0}
                onClick={handleApply}
                className="rounded-xl border border-emerald-300/30 bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Použít importované odpovědi
              </button>
            </div>

            {applyMessage ? (
              <p className="mt-3 text-sm text-emerald-200">{applyMessage}</p>
            ) : null}
          </>
        ) : null}
      </section>

      {isDetailsOpen && importResult ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setIsDetailsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="moodle-import-title"
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
                  Detail importu
                </p>
                <h3
                  id="moodle-import-title"
                  className="mt-1 text-xl font-semibold text-white"
                >
                  Výsledek parsování Moodle PDF
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {fileName ?? "Vybraný soubor"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
              >
                Zavřít
              </button>
            </div>

            <div className="overflow-auto px-5 py-5 sm:px-6">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Rozpoznané bloky</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {importResult.answers.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Spárované</p>
                  <p className="mt-1 text-xl font-bold text-emerald-200">
                    {matchedCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Nevyřešené</p>
                  <p className="mt-1 text-xl font-bold text-amber-200">
                    {unresolvedCount}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-950/90 text-slate-200 backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Úloha</th>
                        <th className="px-3 py-2 font-semibold">Správná volba</th>
                        <th className="px-3 py-2 font-semibold">
                          Text správné odpovědi
                        </th>
                        <th className="px-3 py-2 font-semibold">Stav</th>
                      </tr>
                    </thead>

                    <tbody>
                      {importResult.answers.map((answer) => (
                        <tr
                          key={`${answer.question}-${answer.correctText}`}
                          className="border-t border-white/5 align-top"
                        >
                          <td className="px-3 py-2 font-semibold text-slate-100">
                            {answer.question}
                          </td>
                          <td className="px-3 py-2 text-slate-200">
                            {answer.correctOption ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            <div>{answer.correctText || "-"}</div>
                            {answer.error ? (
                              <div className="mt-1 text-[11px] font-semibold text-amber-200">
                                {answer.error}
                              </div>
                            ) : null}
                            {answer.analysis?.length ? (
                              <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                                {answer.analysis.map((item) => (
                                  <li key={`${answer.question}-${item}`}>- {item}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 font-semibold ${
                                answer.status === "matched"
                                  ? "bg-emerald-400/20 text-emerald-100"
                                  : "bg-amber-400/20 text-amber-100"
                              }`}
                            >
                              {getStatusLabel(answer.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importResult.errors.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="font-semibold">Poznámky k importu</p>
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <details className="mt-4 rounded-2xl border border-white/10 bg-black/20">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-100">
                  Zobrazit extrahovaný text z PDF
                </summary>
                <div className="border-t border-white/10 px-4 py-3">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                    {importResult.rawText || "Z PDF nebyl získán žádný text."}
                  </pre>
                </div>
              </details>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
              <div>
                {applyMessage ? (
                  <p className="text-sm text-emerald-200">{applyMessage}</p>
                ) : (
                  <p className="text-sm text-slate-400">
                    Výsledky importu můžeš zkontrolovat před použitím.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={matchedCount === 0}
                  onClick={handleApply}
                  className="rounded-xl border border-emerald-300/30 bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Použít importované odpovědi
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
