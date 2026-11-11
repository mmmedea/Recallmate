// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractDocxSource } from '@/lib/source/docx-source';
import { notesFromSource, notesEligible, sourceAcademicText } from '@/lib/source/academic-source';
import { buildStudyContentFallback } from '@/lib/ai/study-content-fallback';
import { applyQuizEngineV2 } from '@/lib/ai/quiz-engine-v2';

describe('original Ethics DOCX golden source', () => {
  it('preserves source structure and links every Notes block to exact source evidence', async () => {
    const source = await extractDocxSource(readFileSync('__tests__/fixtures/GED_107_Ethics_Reviewer.docx'), 'GED_107_Ethics_Reviewer.docx');
    const notes = notesFromSource(source);
    expect(source.document_type).toBe('reviewer');
    expect(source.source_hash).toHaveLength(64);
    expect(source.blocks.filter(b => b.kind === 'table')).toHaveLength(9);
    expect(notes.noteBlocks.filter(n => n.block.kind === 'table')).toHaveLength(8);
    expect(notes.sourceHtml).toContain('<table');
    expect(notes.sourceHtml).toContain('<strong>');
    expect(notes.sourceHtml).toContain('<li ');
    expect(notes.sourceHtml).toContain('Kant and the Categorical Imperative');
    expect(notes.sourceHtml).toContain('Justice and fairness');
    expect(notes.sourceHtml).not.toContain('Purpose of this reviewer');
    expect(notes.sourceHtml).not.toContain('Useful sentence starter');
    expect(notes.noteBlocks.map(n => n.block.id)).toEqual(source.blocks.filter(notesEligible).map(b => b.id));
    for (const note of notes.noteBlocks) {
      expect(note.document_id).toBe(source.document_id);
      expect(note.source_block_ids).toEqual([note.block.id]);
      expect(note.block).toEqual(source.blocks.find(b => b.id === note.block.id));
    }
    const values = source.blocks.find(b => b.cells?.some(row => row.some(c => c.paragraphs.flat().some(r => r.text === 'Pakikisama'))));
    expect(values?.cells?.[1][0].paragraphs.flat().map(r => r.text).join('')).toBe('Pakikisama');
    expect(values?.cells?.[1][1].paragraphs.flat().map(r => r.text).join('')).toContain('harmonious relationships');
    const quizSource = sourceAcademicText(source, true);
    expect(quizSource).not.toMatch(/Purpose of this reviewer|Study focus|Useful sentence starter/);
    expect(quizSource).toContain('moral philosophy');
    expect(buildStudyContentFallback(quizSource, source.fileName, 'hard', 20).questions).toEqual([]);
    if (process.env.RECALLMATE_SOURCE_QA === '1') {
      writeFileSync('tmp/ethics-source-qa/notes.html', '<!doctype html><meta charset="utf-8"><style>body{font:16px Arial;max-width:900px;margin:32px auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px}th{background:#dde6f5}h2,h3{break-after:avoid}tr{break-inside:avoid}</style>' + notes.sourceHtml);
    }
  });

  it('rejects the metadata question and fake Hard scenario even with inflated scores', () => {
    const candidate = { question: 'A student applies the lesson point about "Purpose of this reviewer" to a new review scenario. Which conclusion is best supported?',
      options: { A: 'Purpose of this reviewer', B: 'Study effectively', C: 'Understand concepts instead of memorizing', D: 'Prepare for your examination' },
      correctAnswer: 'A', sourceCitation: 'Purpose of this reviewer', cognitiveSkill: 'integration' as const, difficultyScore: 100 };
    const result = applyQuizEngineV2({ questions: [candidate], sourceText: Object.values(candidate.options).join('\n'), difficulty: 'hard', requestedCount: 1 });
    expect(result.questions).toEqual([]);
    expect(result.report.usefulRejected).toBe(1);
  });
});
