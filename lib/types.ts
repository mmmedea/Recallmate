export interface QAItem {
  question: string;
  answer: string;
}

export interface GeneratedContent {
  fileName: string;
  summary: string;
  notes: string[];
  questions: {
    easy: QAItem[];
    medium: QAItem[];
    hard: QAItem[];
  };
}

export type Difficulty = "easy" | "medium" | "hard";