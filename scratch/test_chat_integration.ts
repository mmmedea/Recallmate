import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-key'; // It's usually in .env.local

async function runTests() {
  console.log("Starting Chat Integration Tests...");
  
  // Load env from .env.local
  const fs = require('fs');
  const dotenv = require('dotenv');
  
  if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  } else {
    console.warn('.env.local not found!');
  }
  
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !serviceKey) {
    const { execSync } = require('child_process');
    try {
      console.log("Fetching keys from supabase status...");
      const statusJson = execSync('npx supabase status -o json', { encoding: 'utf-8' });
      const status = JSON.parse(statusJson);
      supabaseUrl = status.API_URL;
      supabaseKey = status.ANON_KEY;
      serviceKey = status.SERVICE_ROLE_KEY;
    } catch (e) {
      console.error("Could not run npx supabase status", e);
    }
  }

  if (!supabaseUrl) throw new Error("supabaseUrl is missing in env");
  if (!supabaseKey) throw new Error("supabaseKey is missing in env");
  if (!serviceKey) throw new Error("serviceKey is missing in env");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const serviceClient = createClient(supabaseUrl, serviceKey);
  
  // 1. Create a test user
  const email = `test_chat_${Date.now()}@example.com`;
  const password = "password123";
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) throw authErr;
  
  const token = authData.session?.access_token;
  const userId = authData.user?.id;
  if (!token || !userId) throw new Error("Could not get token or userId");
  
  console.log("User created:", userId);
  
  // 2. Grant credits
  await serviceClient.from('ai_credits').insert({
    user_id: userId,
    balance: 5000
  });

  // 3. Create another user for RLS test
  const email2 = `test_chat_2_${Date.now()}@example.com`;
  const { data: authData2 } = await supabase.auth.signUp({ email: email2, password });
  const token2 = authData2.session?.access_token;

  // Grant credits to test user
  const { error: creditErr } = await serviceClient.from('ai_credit_ledger').insert({
    user_id: userId,
    entry_type: 'ADJUSTMENT',
    credits: 100,
    reason: 'Test setup'
  });
  if (creditErr) throw new Error("Credit Insert failed: " + JSON.stringify(creditErr));

  // 4. Create document and chunks
  const docId = '123e4567-e89b-12d3-a456-426614174000'; // Make sure to use valid UUID
  const docId2 = crypto.randomUUID();
  
  const { error: docErr } = await serviceClient.from('documents').insert({
    id: docId2,
    user_id: userId,
    filename: "Test Document.pdf",
    storage_path: "test/test.pdf",
    status: 'completed'
  });
  if (docErr) throw new Error("Doc Insert failed: " + JSON.stringify(docErr));

  const { error: chunksErr } = await serviceClient.from('document_chunks').insert([
    {
      document_id: docId2,
      chunk_index: 1,
      content: "The capital of France is Paris.",
      token_count: 10,
      metadata: {}
    },
    {
      document_id: docId2,
      chunk_index: 2,
      content: "Water boils at 100 degrees Celsius.",
      token_count: 10,
      metadata: {}
    }
  ]);
  if (chunksErr) throw new Error("Chunks Insert failed: " + JSON.stringify(chunksErr));

  // Make chunks searchable
  await serviceClient.rpc('execute_sql', { sql_string: `UPDATE document_chunks SET embedding = '[0]' WHERE document_id = '${docId2}';` }); // dummy

  const apiFetch = async (body: any, jwt: string = token) => {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
  };

  // Test 1: Ask a question clearly answered by PDF
  const msgId1 = crypto.randomUUID();
  console.log("Running Test 1: Answered by PDF");
  const res1 = await apiFetch({
    documentId: docId2,
    message: "What is the capital of France?",
    clientMessageId: msgId1
  });
  console.log("Res1:", res1.status, res1.data);
  const sessionId = res1.data.sessionId;

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // --- Test 2: Absent from PDF ---
  console.log("Running Test 2: Absent from PDF");
  const msgId2 = crypto.randomUUID();
  await delay(3000);
  const res2 = await apiFetch({
    documentId: docId2,
    sessionId: sessionId,
    message: "Who is the president of Mars?",
    clientMessageId: msgId2
  });
  console.log("Res2:", res2.status, res2.data);

  // --- Test 3: Follow-up (Context continuity) ---
  console.log("Running Test 3: Follow-up");
  const msgId3 = crypto.randomUUID();
  await delay(3000);
  const res3 = await apiFetch({
    documentId: docId2,
    sessionId: sessionId,
    message: "And what temperature does water boil at?",
    clientMessageId: msgId3
  });
  console.log("Res3:", res3.status, res3.data);

  // --- Test 4: Idempotency ---
  console.log("Running Test 4: Idempotency");
  await delay(3000);
  const res4 = await apiFetch({
    documentId: docId2,
    sessionId: sessionId,
    message: "And what temperature does water boil at?",
    clientMessageId: msgId3 // Same msgId!
  });
  console.log("Res4 (should recover):", res4.status, res4.data);

  // Test 5: Try another user's document/session
  console.log("Running Test 5: RLS");
  const res5 = await apiFetch({
    documentId: docId2,
    message: "Hack the document",
    clientMessageId: crypto.randomUUID()
  }, token2);
  console.log("Res5 (should fail 403):", res5.status, res5.data);

  // Clean up
  await serviceClient.from('documents').delete().eq('id', docId2);
  await serviceClient.from('users').delete().in('id', [userId, authData2.user?.id]);
  
  console.log("Integration tests completed.");
}

runTests().catch(console.error);
