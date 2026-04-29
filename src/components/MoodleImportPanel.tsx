import { useMemo, useRef, useState } from "react";
import { parseMoodleAnswerText } from "../utils/moodleAnswerParser";
import { extractPdfText } from "../utils/pdfTextExtractor";
import type { ImportedMoodleAnswer, MoodleAnswerImportResult } from "../types";

type Props = {
  onApplyImportedAnswers: (answers: ImportedMoodleAnswer[]) => void;
};

export function MoodleImportPanel({ onApplyImportedAnswers }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsImporting(true);
    setFileName(file.name);
    setImportResult(null);
    setImportError(null);
    setApplyMessage(null);

    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        throw new Error("Please choose a Moodle PDF export.");
      }

      const arrayBuffer = await file.arrayBuffer();
      const rawText = await extractPdfText(arrayBuffer);
      const nextResult = parseMoodleAnswerText(rawText);

      setImportResult(nextResult);

      if (!nextResult.answers.length) {
        setImportError("No Moodle answer blocks were found in the uploaded PDF.");
      }
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error
          ? error.message
          : "The Moodle PDF could not be imported.",
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
    setApplyMessage(`Applied ${matchedCount} imported answers.`);
  }

  return (
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
            Moodle PDF
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Import correct answers from Moodle PDF
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Upload a Moodle preview or results PDF with selectable text. The parser
            will map the correct answer text back to A-D.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isImporting}
          className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isImporting ? "Importing..." : "Choose PDF"}
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
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-400">Parsed blocks</p>
              <p className="mt-1 text-xl font-bold">{importResult.answers.length}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-400">Matched</p>
              <p className="mt-1 text-xl font-bold text-emerald-200">
                {matchedCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-400">Unresolved</p>
              <p className="mt-1 text-xl font-bold text-amber-200">
                {unresolvedCount}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950/90 text-slate-200 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Question</th>
                    <th className="px-3 py-2 font-semibold">Correct option</th>
                    <th className="px-3 py-2 font-semibold">Correct answer text</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
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
                        {answer.correctOption ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        <div>{answer.correctText || "—"}</div>
                        {answer.error ? (
                          <div className="mt-1 text-[11px] text-amber-200">
                            {answer.error}
                          </div>
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
                          {answer.status}
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
              <p className="font-semibold">Import notes</p>
              <ul className="mt-2 space-y-1">
                {importResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={matchedCount === 0}
              onClick={handleApply}
              className="rounded-xl border border-emerald-300/30 bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply imported answer key
            </button>

            {applyMessage ? (
              <p className="text-sm text-emerald-200">{applyMessage}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
