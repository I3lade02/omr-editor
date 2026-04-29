import { useEffect } from "react";
import { OPTIONS } from "../constants";
import type { AnswerOption, Answers } from "../types";

type Params = {
  enabled: boolean;
  activeQuestion: number;
  answers: Answers;
  setActiveQuestion: React.Dispatch<React.SetStateAction<number>>;
  setAnswers: React.Dispatch<React.SetStateAction<Answers>>;
  selectAnswer: (question: number, option: AnswerOption) => void;
};

export function useKeyboardAnswers({
  enabled,
  activeQuestion,
  answers,
  setActiveQuestion,
  setAnswers,
  selectAnswer,
}: Params) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!enabled) return;

      const key = event.key.toUpperCase();

      if (OPTIONS.includes(key as AnswerOption)) {
        event.preventDefault();
        selectAnswer(activeQuestion, key as AnswerOption);
        setActiveQuestion((prev) => Math.min(prev + 1, 50));
      }

      if (key === "BACKSPACE") {
        event.preventDefault();

        const targetQuestion =
          answers[activeQuestion] !== undefined
            ? activeQuestion
            : Math.max(1, activeQuestion - 1);

        setAnswers((prev) => {
          const copy = { ...prev };
          delete copy[targetQuestion];
          return copy;
        });

        setActiveQuestion(targetQuestion);
      }

      if (key === "ARROWUP") {
        event.preventDefault();
        setActiveQuestion((prev) => Math.max(1, prev - 1));
      }

      if (key === "ARROWDOWN") {
        event.preventDefault();
        setActiveQuestion((prev) => Math.min(50, prev + 1));
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    answers,
    enabled,
    activeQuestion,
    selectAnswer,
    setActiveQuestion,
    setAnswers,
  ]);
}
