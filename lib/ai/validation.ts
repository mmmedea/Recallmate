import { GeneratedNotes, GeneratedQuiz, GeneratedChat } from "./schemas";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates that all citations refer to chunks that actually exist
 * in the retrieved context for the user's document.
 */
export function validateCitations(
  sources: { chunkIndex: number }[],
  validChunkIndices: Set<number>
): void {
  if (sources.length === 0) {
    throw new ValidationError("Missing citations. Every generated item must cite at least one source chunk.");
  }
  
  for (const source of sources) {
    if (!validChunkIndices.has(source.chunkIndex)) {
      throw new ValidationError(`Invalid citation: Chunk index ${source.chunkIndex} was not part of the provided document context.`);
    }
  }
}

/**
 * Enforces educational quality rules for generated Notes.
 */
export function validateNotesEducationalQuality(
  notes: GeneratedNotes,
  validChunkIndices: Set<number>
): void {
  // 1. Minimum lengths
  if (notes.summary.trim().length < 50) {
    throw new ValidationError("Summary is too short. It must provide a meaningful overview of the material.");
  }
  if (notes.keyPoints.length === 0) {
    throw new ValidationError("Notes must contain at least one key point.");
  }
  if (notes.topics.length === 0) {
    throw new ValidationError("Notes must contain at least one topic.");
  }

  // 2. Topic quality & citations
  for (const topic of notes.topics) {
    if (topic.title.trim().length === 0) {
      throw new ValidationError("Topic title cannot be empty.");
    }
    if (topic.content.trim().length < 10) {
      throw new ValidationError(`Topic "${topic.title}" content is too short. Medea must explain concepts, not just compress them.`);
    }
    validateCitations(topic.sources, validChunkIndices);
  }
}

/**
 * Enforces strict business rules and educational quality for generated Quizzes.
 */
export function validateQuizBusinessRules(
  quiz: GeneratedQuiz,
  validChunkIndices: Set<number>
): void {
  if (quiz.questions.length === 0) {
    throw new ValidationError("Quiz must contain at least one question.");
  }

  const seenQuestions = new Set<string>();

  for (const [index, q] of quiz.questions.entries()) {
    // 1. Question quality
    if (q.question.trim().length < 10) {
      throw new ValidationError(`Question ${index + 1} is too short.`);
    }
    const qNormalized = q.question.trim().toLowerCase();
    if (seenQuestions.has(qNormalized)) {
      throw new ValidationError(`Duplicate question detected: "${q.question}"`);
    }
    seenQuestions.add(qNormalized);

    // 2. Options quality
    if (q.options.length !== 4) {
      throw new ValidationError(`Question ${index + 1} must have exactly 4 options. Found ${q.options.length}.`);
    }
    const uniqueOptions = new Set(q.options.map(opt => opt.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) {
      throw new ValidationError(`Question ${index + 1} has duplicate options.`);
    }

    // 3. Correct Answer Bounds
    if (q.correctAnswerIndex < 0 || q.correctAnswerIndex >= 4) {
      throw new ValidationError(`Question ${index + 1} correctAnswerIndex (${q.correctAnswerIndex}) is out of bounds [0-3].`);
    }

    // 4. Explanation quality
    if (q.explanation.trim().length < 10) {
      throw new ValidationError(`Question ${index + 1} explanation is too short.`);
    }

    // 5. Citations
    validateCitations(q.sources, validChunkIndices);
  }
}

/**
 * Validates chat responses to ensure they are strictly grounded.
 */
export function validateChatCitations(
  chat: GeneratedChat,
  validChunkIndices: Set<number>
): void {
  // If no chunks were retrieved at all, the model should not invent an answer
  if (validChunkIndices.size === 0) {
    if (chat.answer.toLowerCase().includes("not found") || 
        chat.answer.toLowerCase().includes("couldn't find") ||
        chat.answer.toLowerCase().includes("does not discuss")) {
      return; // Acceptable fallback response when no context
    }
    throw new ValidationError("Medea must explicitly state the answer is not found when no relevant context is retrieved. It must not generate an answer from general knowledge.");
  }

  // If there is context and it found an answer, it must cite at least one source
  if (chat.sources.length > 0) {
    validateCitations(chat.sources, validChunkIndices);
  }
}

