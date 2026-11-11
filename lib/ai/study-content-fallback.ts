import { normalizeQuizDifficulty, type QuizDifficulty } from '@/lib/ai/quiz-policy';
import { applyQuizEngineV2, type StudyQuizQuestion } from '@/lib/ai/quiz-engine-v2';
import { isStudyInstruction, notesFromSource, sourceFromText, sourceAcademicText } from '@/lib/source/academic-source';

// Local fallback cannot manufacture reasoning scenarios or arbitrary distractors.
export function buildStudyContentFallback(text: string, fileName = 'Uploaded lesson', difficulty: QuizDifficulty | string = 'easy', requestedCount = 10) {
  const level = normalizeQuizDifficulty(difficulty);
  const source = sourceFromText(text, fileName);
  const academic = sourceAcademicText(source, true);
  const seen = new Set<string>();
  const pairs = academic.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).flatMap(line => {
    const match = /^([A-Za-z][A-Za-z /'-]{2,55}?)\s+(?:is|means|refers to)\s+(.{20,240})[.!?]?$/.exec(line.trim());
    if (!match || isStudyInstruction(line)) return [];
    const term = match[1].trim();
    const definition = match[2].replace(/[.!?]$/, '').trim();
    if (seen.has(term.toLowerCase()) || seen.has(definition.toLowerCase())) return [];
    seen.add(term.toLowerCase()); seen.add(definition.toLowerCase());
    return [{ term, definition, citation: line.trim() }];
  });
  const candidates: StudyQuizQuestion[] = level === 'easy' && pairs.length >= 4 ? pairs.map((pair, i) => ({
    question: `Which concept is defined as "${pair.definition}"?`,
    options: { A: pair.term, B: pairs[(i + 1) % pairs.length].term, C: pairs[(i + 2) % pairs.length].term, D: pairs[(i + 3) % pairs.length].term },
    correctAnswer: 'A', sourceCitation: pair.citation,
    explanation: pair.citation, pageNumber: 'source',
  })) : [];
  const quiz = applyQuizEngineV2({ questions: candidates, sourceText: academic, difficulty: level, requestedCount });
  return { ...notesFromSource(source), difficulty: level, questions: quiz.questions, quizEngine: quiz.report,
    generatedBy: 'local-study-content-fallback',
    availability: quiz.questions.length ? 'limited_fallback' : 'generation_unavailable',
    summary: '',
    notice: quiz.questions.length
      ? `AI generation is temporarily unavailable. ${quiz.questions.length} source-linked definition questions are available. We will not pad the quiz.`
      : `AI generation is temporarily unavailable. No local questions passed the ${level} quality requirements. Retry generation; your material is not exhausted.`,
  };
}
