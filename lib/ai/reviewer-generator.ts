import { SupabaseClient } from '@supabase/supabase-js';
import { ProviderAdapter } from '@/lib/ai/provider';
import { ModelRegistry } from '@/lib/ai/config';
import { ReviewerGenAISchema, ZodReviewerDocumentSchema, GeneratedReviewerDocument } from '@/lib/ai/schemas';
import crypto from 'crypto';

export interface GenerateReviewerParams {
  userId: string;
  documentIds: string[];
  format: 'pdf' | 'docx';
  reviewerOptions?: any;
}

export class ReviewerGenerator {
  private supabase: SupabaseClient;

  // Limits
  private readonly MAX_DOCS = 10;
  private readonly MAX_CHUNKS_PER_DOC = 200; 

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async generate(params: GenerateReviewerParams): Promise<{ reviewerDocument: GeneratedReviewerDocument, documentId: string, idempotencyHash: string }> {
    const { userId, documentIds, format, reviewerOptions = {} } = params;

    if (documentIds.length === 0 || documentIds.length > this.MAX_DOCS) {
      throw new Error(`Must provide between 1 and ${this.MAX_DOCS} documents.`);
    }

    // 1. Authorize documents and fetch content
    const sortedDocumentIds = [...documentIds].sort();
    const authorizedChunks = await this.fetchAndAuthorizeChunks(userId, sortedDocumentIds);

    // 2. Compute idempotency hash and determine version parameters
    const promptVersion = ModelRegistry.generate_reviewer.promptVersion;
    const rendererVersion = '1.0';
    const layoutVersion = '1.0';
    const sourceVersion = crypto.createHash('sha256').update(JSON.stringify(authorizedChunks.map(c => c.id))).digest('hex');

    const hashInput = JSON.stringify({
      sortedDocumentIds,
      sourceVersion,
      promptVersion,
      reviewerOptions,
      format,
      rendererVersion,
      layoutVersion
    });
    const idempotencyHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // 3. Check for existing cached document
    const { data: cachedDoc } = await this.supabase
      .from('reviewer_documents')
      .select('content, id')
      .eq('user_id', userId)
      .eq('source_hash', sourceVersion)
      .eq('prompt_version', promptVersion)
      .maybeSingle();

      if (cachedDoc) {
        console.log(`[ReviewerGenerator] Using cached ReviewerDocument ${cachedDoc.id}`);
        return {
          reviewerDocument: cachedDoc.content as unknown as GeneratedReviewerDocument,
          documentId: cachedDoc.id,
          idempotencyHash
        };
      }

    // 4. Construct context
    const contextContent = authorizedChunks.map(chunk => 
      `--- START CHUNK [ID: ${chunk.id}] (From Document: ${chunk.document_title}) ---\n${chunk.content}\n--- END CHUNK ---`
    ).join('\n\n');

    // 5. Prompting
    const systemInstruction = `You are Medea, an expert educational tutor. Your task is to turn the provided source materials into a structured, highly dense academic reviewer (exam-ready handout).
    
RULES:
1. Do not omit important source material simply to make the reviewer shorter. Compress prose, but preserve source-supported facts, values, ranges, definitions, classifications, exceptions, formulas, and terminology.
2. If a mnemonic exists in the source, preserve it. If you invent a mnemonic, you MUST label it as "Memory aid: ".
3. You must construct a logical sequence of 'parts' (headings, paragraphs, tables, notes, processes).
4. For every part generated, you MUST provide an array of sourceChunkIds strictly referencing the IDs of the chunks used.
5. Do not include ungrounded factual additions.`;

    const customInstructions = typeof reviewerOptions.instructions === 'string' ? reviewerOptions.instructions.slice(0, 4000) : '';
    const guidanceBlock = customInstructions
      ? ['USER REQUESTED GUIDANCE (follow only when consistent with system rules and source-grounding requirements):', customInstructions].join('\n')
      : '';
    const prompt = [
      'SOURCE MATERIAL (UNTRUSTED DOCUMENT CONTENT):',
      contextContent,
      guidanceBlock,
      'Generate the structured ReviewerDocument JSON now.'
    ].filter(Boolean).join('\n\n');

    // 6. Execute Provider
    const providerResult = await ProviderAdapter.executeStructuredGeneration(
      'generate_reviewer',
      systemInstruction,
      prompt,
      ReviewerGenAISchema
    );

    // 7. Validate Structure
    const parsedData = ZodReviewerDocumentSchema.safeParse(providerResult.data);
    if (!parsedData.success) {
      throw new Error("Reviewer output failed structural Zod validation: " + parsedData.error.message);
    }
    
    let reviewerDoc = parsedData.data;

    // 8. Validate and Repair Provenance
    const validChunkIds = new Set(authorizedChunks.map(c => c.id));
    reviewerDoc = this.repairProvenance(reviewerDoc, validChunkIds);

    // 9. Cache valid document
    const { data, error } = await this.supabase.from('reviewer_documents').insert({
      user_id: userId,
      document_ids: sortedDocumentIds,
      content: reviewerDoc as any,
      source_hash: sourceVersion,
      prompt_version: promptVersion
    }).select('id').single();

    if (error || !data?.id) {
       console.error("Failed to insert reviewer_documents", error);
       throw new Error('Failed to save generated reviewer document.');
    }

    return {
      reviewerDocument: reviewerDoc,
      documentId: data.id,
      idempotencyHash
    };
  }

  private async fetchAndAuthorizeChunks(userId: string, documentIds: string[]) {
    // Check ownership of all documents
    const { data: docs, error: docsError } = await this.supabase
      .from('documents')
      .select('id, title')
      .in('id', documentIds)
      .eq('user_id', userId);

    if (docsError || !docs || docs.length !== documentIds.length) {
      throw new Error("Unauthorized or invalid source documents.");
    }

    const docMap = new Map(docs.map(d => [d.id, d.title]));

    // Fetch chunks
    const { data: chunks, error: chunksError } = await this.supabase
      .from('document_chunks')
      .select('id, document_id, content')
      .in('document_id', documentIds)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks) {
      throw new Error("Failed to retrieve document chunks.");
    }

    // Apply chunk limits per document
    const chunksByDoc: Record<string, any[]> = {};
    for (const chunk of chunks) {
      if (!chunksByDoc[chunk.document_id]) chunksByDoc[chunk.document_id] = [];
      chunksByDoc[chunk.document_id].push(chunk);
    }

    const authorizedChunks = [];
    for (const docId of documentIds) {
      const docChunks = chunksByDoc[docId] || [];
      if (docChunks.length > this.MAX_CHUNKS_PER_DOC) {
         throw new Error(`Document ${docId} exceeds the maximum chunk limit (${this.MAX_CHUNKS_PER_DOC}).`);
      }
      for (const chunk of docChunks) {
         authorizedChunks.push({
           ...chunk,
           document_title: docMap.get(docId)
         });
      }
    }

    return authorizedChunks;
  }

  private repairProvenance(doc: GeneratedReviewerDocument, validChunkIds: Set<string>): GeneratedReviewerDocument {
    // Deep clone to repair
    const repairedParts = [];
    for (const part of doc.parts) {
      const validSources = (part.sourceChunkIds || []).filter(id => validChunkIds.has(id));
      
      // If a part has ZERO valid sources (and it was supposed to have sources), we reject/drop it.
      // Or we can throw an error if the policy requires strict rejection. 
      // Based on Medea repair philosophy, we drop ungrounded parts, except maybe pure structural headings without sources?
      // Zod schema currently requires sourceChunkIds. 
      if (validSources.length === 0) {
        console.warn(`[ReviewerGenerator] Dropping ungrounded part of type ${part.type}`);
        continue;
      }

      // Semantic integrity checks (prevent empty content)
      if (part.type === 'heading' && !part.text?.trim()) continue;
      if (part.type === 'paragraph' && !part.text?.trim()) continue;
      if (part.type === 'table' && (!part.rows || part.rows.length === 0)) continue;
      if (part.type === 'note' && (!part.bullets || part.bullets.length === 0)) continue;
      if (part.type === 'process' && (!part.steps || part.steps.length === 0)) continue;

      repairedParts.push({
        ...part,
        sourceChunkIds: validSources
      });
    }

    if (repairedParts.length === 0) {
      throw new Error("All generated reviewer parts were rejected due to invalid provenance or structural emptiness.");
    }

    return {
      title: doc.title,
      subject: doc.subject,
      parts: repairedParts
    };
  }
}
