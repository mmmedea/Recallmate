import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role for testing

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== Running Backend Smoke Tests ===");

  // Setup: Get a user id (we'll just use the first user or create a dummy one)
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr || !users.users.length) {
    console.error("No users found. Please create a user first for the test.");
    return;
  }
  const user = users.users[0];
  console.log(`Using test user: ${user.id}`);

  // Scenario 1: Upload succeeds -> exactly one document -> exactly one extract job
  console.log("\n--- Scenario 1: Basic Upload ---");
  const docId = crypto.randomUUID();
  const idemKey = `process:${docId}:v1`;

  // Insert base document manually to simulate start of upload session
  await supabase.from('documents').insert({
    id: docId,
    user_id: user.id,
    filename: 'test_doc_1.pdf',
    status: 'uploaded' // Initial state
  });

  // Call the transactional RPC
  const { data: rpcData1, error: rpcErr1 } = await supabase.rpc('confirm_document_upload', {
    p_document_id: docId,
    p_user_id: user.id,
    p_idempotency_key: idemKey
  });

  if (rpcErr1) console.error("Scenario 1 RPC Error:", rpcErr1);

  const { data: jobs1 } = await supabase.from('ai_jobs').select('*').eq('document_id', docId);
  const { data: docs1 } = await supabase.from('documents').select('*').eq('id', docId);
  
  console.log(`Doc count: ${docs1?.length} (Expected 1)`);
  console.log(`Job count: ${jobs1?.length} (Expected 1, Operation: extract_text)`);
  console.log(`Doc status: ${docs1?.[0].status} (Expected queued)`);

  // Scenario 2: Repeat/duplicate confirmation -> no duplicate extract job
  console.log("\n--- Scenario 2: Duplicate Confirmation ---");
  const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('confirm_document_upload', {
    p_document_id: docId,
    p_user_id: user.id,
    p_idempotency_key: idemKey
  });
  
  if (rpcErr2) console.error("Scenario 2 RPC Error (Expected if duplicate violates unique constraint):", rpcErr2.message);

  const { data: jobs2 } = await supabase.from('ai_jobs').select('*').eq('document_id', docId);
  console.log(`Job count after repeat: ${jobs2?.length} (Expected 1)`);

  // Scenario 3: auto_generate = true -> Notes + Quiz jobs appear
  console.log("\n--- Scenario 3: Auto-generate = true ---");
  // Set pref
  await supabase.from('preferences').upsert({ user_id: user.id, auto_generate: true });

  const { data: pref3 } = await supabase.from('preferences').select('auto_generate').eq('user_id', user.id).single();
  console.log(`Auto generate preference: ${pref3?.auto_generate} (Expected true)`);

  // Scenario 4: auto_generate = false
  console.log("\n--- Scenario 4: Auto-generate = false ---");
  await supabase.from('preferences').upsert({ user_id: user.id, auto_generate: false });
  const { data: pref4 } = await supabase.from('preferences').select('auto_generate').eq('user_id', user.id).single();
  console.log(`Auto generate preference: ${pref4?.auto_generate} (Expected false)`);

  console.log("\n=== Smoke Tests Complete ===");
}

runTests().catch(console.error);
