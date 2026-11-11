import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// We need to bypass Next.js API in scripts, so we will use fetch against localhost:3000
const API_BASE = "http://localhost:3000";

// For direct db manipulation in testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log("Starting Phase 6.7 Integration Tests...");

  // 1. Setup a test user and document (borrowing from previous integration test patterns)
  const testEmail = `test.learning.${Date.now()}@example.com`;
  
  const { data: { user }, error: signUpError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: "Password123!",
    email_confirm: true
  });
  
  if (signUpError || !user) throw new Error("Failed to create test user: " + signUpError?.message);
  console.log(`✅ Created test user: ${user.id}`);

  // Create a document
  const { data: doc, error: docError } = await supabase.from("documents").insert({
    user_id: user.id,
    filename: "test.pdf",
    storage_path: "test.pdf",
    status: "completed"
  }).select().single();
  
  if (docError) throw new Error("Failed to create doc: " + docError.message);

  // Create a document chunk for the questions
  const { data: chunk, error: chunkError } = await supabase.from("document_chunks").insert({
    document_id: doc.id,
    content: "Dummy chunk content",
    chunk_index: 0
  }).select().single();
  if (chunkError) throw new Error("Failed to insert chunk: " + chunkError.message);

  // Create some questions
  const questionsToInsert = [
    { document_id: doc.id, source_chunk_id: chunk.id, question_text: "Q1", options: [], correct_answer: 0 },
    { document_id: doc.id, source_chunk_id: chunk.id, question_text: "Q2", options: [], correct_answer: 0 }
  ];
  const { error: qError } = await supabase.from("questions").insert(questionsToInsert);
  if (qError) throw new Error("Failed to insert questions: " + qError.message);

  // Initialize learning items (Testing ensure_learning_items RPC)
  const { error: rpcError } = await supabase.rpc("ensure_learning_items", {
    p_user_id: user.id,
    p_document_id: doc.id
  });
  if (rpcError) throw new Error("ensure_learning_items failed");
  console.log("✅ Successfully initialized learning items");

  // Authenticate as the user to get JWT for the API requests
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: "Password123!"
  });
  const token = authData.session?.access_token;

  // 2. Test /api/learning/session
  const sessionRes = await fetch(`${API_BASE}/api/learning/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ documentId: doc.id, requestedSize: 5 })
  });
  
  const sessionData = await sessionRes.json();
  if (!sessionData.success || sessionData.items.length !== 2) {
    throw new Error(`Session failed: ${JSON.stringify(sessionData)}`);
  }
  console.log(`✅ Successfully created review session with ${sessionData.items.length} items`);

  const itemToReview = sessionData.items[0];

  // 3. Test /api/learning/review (Incorrect -> Again)
  const reqId1 = crypto.randomUUID();
  const reviewRes1 = await fetch(`${API_BASE}/api/learning/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      learningItemId: itemToReview.learningItemId,
      reviewSessionId: sessionData.sessionId,
      requestId: reqId1,
      wasCorrect: false
    })
  });
  
  const reviewData1 = await reviewRes1.json();
  if (!reviewData1.success) throw new Error("Review 1 failed");
  console.log(`✅ Processed incorrect review (Again). Next due: ${reviewData1.nextDueAt}`);

  // 4. Test Idempotency (Same Request ID)
  const reviewResIdempotent = await fetch(`${API_BASE}/api/learning/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      learningItemId: itemToReview.learningItemId,
      reviewSessionId: sessionData.sessionId,
      requestId: reqId1, // SAME ID!
      wasCorrect: false
    })
  });
  
  const idempotentData = await reviewResIdempotent.json();
  if (!idempotentData.idempotent) throw new Error("Idempotency failed!");
  console.log(`✅ Verified Idempotency (Duplicate rejected safely)`);

  // 5. Test /api/learning/review (Correct + Easy)
  const reqId2 = crypto.randomUUID();
  const reviewRes2 = await fetch(`${API_BASE}/api/learning/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      learningItemId: sessionData.items[1].learningItemId,
      reviewSessionId: sessionData.sessionId,
      requestId: reqId2,
      wasCorrect: true,
      rating: 4 // Easy
    })
  });

  const reviewData2 = await reviewRes2.json();
  if (!reviewData2.success) throw new Error("Review 2 failed");
  console.log(`✅ Processed correct review (Easy). Next due: ${reviewData2.nextDueAt}`);

  // 6. Verify state in DB
  const { data: dbItems } = await supabase.from("learning_items").select("*").eq("user_id", user.id);
  const { data: dbReviews } = await supabase.from("learning_reviews").select("*").eq("user_id", user.id);
  
  if (dbReviews!.length !== 2) throw new Error("Expected exactly 2 reviews in ledger");
  console.log(`✅ DB State verified (${dbItems!.length} items, ${dbReviews!.length} reviews in ledger)`);

  // Cleanup
  await supabase.auth.admin.deleteUser(user.id);
  console.log("✅ Cleanup complete.");
}

runTests().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
