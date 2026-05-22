import type { QuestionType } from "@prisma/client";

export type SliderConfig = {
  min: number;
  max: number;
  step?: number;
  correctValue: number;
  tolerance?: number;
};

export type MatchingPair = { left: string; right: string };

export type MatchingConfig = {
  pairs: MatchingPair[];
};

export type FreeResponseConfig = {
  maxLength?: number;
  rubric?: string;
};

export type QuestionInput = {
  type: QuestionType;
  text: string;
  sortOrder: number;
  config?: SliderConfig | MatchingConfig | FreeResponseConfig | null;
  options?: { text: string; isCorrect: boolean }[];
};

export type AnswerValue =
  | { kind: "option"; optionId: string }
  | { kind: "options"; optionIds: string[] }
  | { kind: "text"; text: string }
  | { kind: "slider"; value: number }
  | { kind: "matching"; pairs: Record<string, string> };
