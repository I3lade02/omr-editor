import { OPTIONS } from "../constants";
import type { AnswerOption, Answers } from "../types";

type Props = {
  answers: Answers;
  activeQuestion: number;
  setActiveQuestion: React.Dispatch<React.SetStateAction<number>>;
  selectAnswer: (question: number, option: AnswerOption) => void;
};

export function AnswersPanel({
  answers,
  activeQuestion,
  setActiveQuestion,
  selectAnswer,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
        Odpovědi
      </p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 50 }, (_, i) => i + 1).map((question) => {
          const value = answers[question];

          return (
            <button
              key={question}
              type="button"
              onClick={() => {
                const next =
                  OPTIONS[
                    (OPTIONS.indexOf(value ?? "A") + 1) % OPTIONS.length
                  ];
                selectAnswer(question, next);
                setActiveQuestion(question);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                value
                  ? "bg-emerald-400 text-black"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              } ${question === activeQuestion ? "ring-2 ring-cyan-400" : ""}`}
            >
              {question}
              {value && `:${value}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}
