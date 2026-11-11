import { buildBoundedMemoryPrompt } from "../lib/ai/memory";
import { LexicalRetriever, RetrievedChunk } from "../lib/ai/retriever";
import { describe, expect, it } from "vitest";

describe('Phase 6.6 Chat Core Abstractions', () => {

  describe('Bounded Memory Construction', () => {
    it('should inject system prompt and context correctly', () => {
      const prompt = buildBoundedMemoryPrompt({
        systemPrompt: "You are a helpful tutor.",
        question: "What is X?",
        retrievedContext: [
          { id: '1', document_id: 'doc1', chunk_index: 1, content: "X is Y.", score: 1 }
        ],
        history: []
      });

      expect(prompt).toContain("You are a helpful tutor.");
      expect(prompt).toContain("X is Y.");
      expect(prompt).toContain("[Source Chunk: 1]");
      expect(prompt).toContain("User: What is X?");
    });

    it('should handle no-evidence fallback', () => {
      const prompt = buildBoundedMemoryPrompt({
        systemPrompt: "You are a helpful tutor.",
        question: "What is Z?",
        retrievedContext: [],
        history: []
      });

      expect(prompt).toContain("(No relevant document context found for this query)");
    });

    it('should bound history correctly', () => {
      const prompt = buildBoundedMemoryPrompt({
        systemPrompt: "You are a helpful tutor.",
        question: "What is X?",
        retrievedContext: [],
        history: [
          { role: 'user', content: 'Msg1' },
          { role: 'assistant', content: 'Msg2' },
          { role: 'user', content: 'Msg3' },
          { role: 'assistant', content: 'Msg4' },
          { role: 'user', content: 'Msg5' },
        ],
        maxHistoryMessages: 2
      });

      // Should only contain the last 2 history messages
      expect(prompt).not.toContain("Msg1");
      expect(prompt).not.toContain("Msg2");
      expect(prompt).not.toContain("Msg3");
      expect(prompt).toContain("Msg4");
      expect(prompt).toContain("Msg5");
    });
  });

});
