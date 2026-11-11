# RecallMate Password + Email Step-Up Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace passwordless email login with password-based signup/sign-in and require a server-verified email step-up before any normal RecallMate session or private data access is released.

**Architecture:** Supabase Auth performs primary authentication, while RecallMate holds pending sessions server-side and binds them to durable parent auth flows and child challenges. A verified-session row and ready account-enrollment record jointly gate refreshed JWT claims, RLS, Storage/Realtime/RPC access, and every user-facing service-role route. UI changes come after the data and route security boundaries are enforced.

**Tech Stack:** Next.js 14.2.5 App Router, React 18, TypeScript, `@supabase/supabase-js` 2.x, `@supabase/ssr` 0.12.x, Vitest, Supabase Postgres/Auth/Storage/Realtime, existing Upstash Redis packages.

**Spec:** `docs/superpowers/specs/2026-09-28-recallmate-session-step-up-auth-design.md`

**Review status:** Revised per security review; awaiting re-approval. This plan does not authorize implementation, Supabase mutation, or deployment.

## Global Constraints

- Passwords have a 12-character minimum, and Supabase email confirmation remains enabled.
- RecallMate-generated email-step-up codes only have six digits, expire after 10 minutes, allow at most five incorrect attempts, and have a 60-second resend cooldown. Supabase signup-confirmation OTP length/expiry/attempt/resend behavior is provider-owned and pinned separately in Task 1.
- Unready enrollment may consume `stepup_verified_at` only within 10 minutes and while the same parent flow is unexpired/unrevoked and the pending `(user_id, session_id)` still matches; stale evidence destroys pending secrets and requires fresh primary auth plus step-up.
- `recallmate_verified_sessions` has active rows only for sessions whose account readiness is `ready`; unready step-up is recorded on the parent flow and cannot set `rm_login_verified: true`.
- No normal Supabase cookie, token, or protected data is returned before code verification, readiness, refresh, and claim validation all succeed.
- Custom email step-up does not change Supabase `aal` or claim Supabase `aal2`.
- Parent auth-flow cookies are opaque, high-entropy, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` on HTTPS, and stable across resend; child challenge IDs remain server-side.
- Before verification, email/password/OTP may appear only in the required HTTPS POST body; they never appear in URLs, logs, responses, cookies, or persistent browser storage and are never reflected. After verification, only the normal configured Supabase session cookies may carry session tokens as required by `@supabase/ssr`.
- Challenge codes are stored only as keyed HMACs; pending refresh tokens and PKCE verifiers are authenticated ciphertext; secrets, emails, passwords, codes, raw IPs, and tokens are never logged.
- Signup intent binds only after exact-ID lookup verifies a flow-specific high-entropy creation correlation and Task 1 proves duplicate confirmed/unconfirmed signup requests cannot inherit or overwrite it. A returned `user.id`, lookup success, matching email, or timestamp alone is never creation proof.
- Auth endpoints use strict request schemas, same-origin/CSRF checks, account/IP rate limits, safe neutral errors, and `Cache-Control: private, no-store`.
- Auth-hook and service-route authorization derive identity from verified claims; never trust browser `userId`, Auth `user_metadata`, or `public.profiles` alone for readiness.
- The service-route guard validates the signed JWT and exact configured project issuer, `aud = 'authenticated'`, `role = 'authenticated'`, and unexpired numeric `exp` before checking `(sub, session_id)` readiness/verification state.
- Supabase-managed signup-confirmation resend is distinct from RecallMate's two-phase resend for app-generated login challenges; do not assume provider resend preserves old codes.
- All destructive/auth/RLS/Storage/Realtime integration tests use only an owner-approved isolated non-production project. If it is unavailable, stop; do not create a branch/project or incur cost without approval.
- Run `supabase test db` only when an already-provisioned local Supabase test runtime is available; otherwise use an explicitly approved non-production SQL test harness. Do not install Docker/CLI, initialize a local stack, or create a hosted branch/project without separate approval.
- No production migration, Auth setting change, test account/data creation, deployment, or cutover is part of implementation. Those require separate explicit owner approval after the non-production gates.
- The Task 2 worktree is already dirty. Before implementation, create a dedicated clean linked worktree from the reviewed baseline using `superpowers:using-git-worktrees`, ensure the approved spec and plan are present there, and leave the existing dirty worktree untouched. Do not implement or commit auth changes in the dirty Task 2 worktree. Do not create the worktree until the user approves the plan and execution method.

## Review Focus

- Duplicate, indeterminate, or mismatched signup/Auth lookup results must never bind consent or OTP verification to an existing account. Pin this in Tasks 1, 7, and 14.
- Concurrent login flows, resend races, and lost responses must keep one active child challenge under the same parent cookie and cannot consume another flow's code/verifier. Pin this in Tasks 6, 8, and 9.
- Replayed OAuth callbacks, cross-tab PKCE mixups, and Google Calendar callbacks must not issue or replace a RecallMate login session. Pin this in Task 9.
- `policy_reaccept_required` and other unready states must permit only the bounded consent operation; successful reacceptance alone must not restore a verified session. Pin this in Task 10.
- A validly signed token from another project or with the wrong audience, role, expiry, user, or session must be rejected before a privileged query or side effect. Pin this in Tasks 4 and 5.

---

## File Map

### Existing auth/UI boundary

- `components/auth/EmailOTPForm.tsx` — currently owns browser-side passwordless request/verification; migrate to server POST flows, then rename or remove after callers move.
- `components/auth/OTPInput.tsx`, `components/auth/ResendButton.tsx`, `components/auth/OAuthButtons.tsx` — retain accessible code entry, resend, and Google entry points.
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/verify-email/page.tsx` — route-level auth UI and sanitized `next` continuity.
- `app/(onboarding)/onboarding/page.tsx` — restricted profile completion only; metadata writes remain non-authoritative and no password is created here.
- `app/(app)/settings/page.tsx` — secure password change/add-password and recovery entry points.
- `app/api/auth/google/start/route.ts`, `app/auth/callback/route.ts`, and `app/api/integrations/google-calendar/connect/route.ts` — sign-in OAuth and the separate calendar-link flow.
- `utils/supabase/server.ts`, `utils/supabase/middleware.ts`, `middleware.ts`, `components/auth/SessionGuard.tsx`, and `app/(app)/layout.tsx` — session refresh and UX gates; never the sole security boundary.
- `lib/auth-safe-next.ts`, `lib/auth-diagnostics.ts`, and `lib/supabase/admin.ts` — preserve safe destination handling, sanitized diagnostics, and server-only client construction.

### New server-side auth modules

- `lib/auth/auth-flow-store.ts` — parent-flow cookie resolution and typed flow transitions backed by narrow database functions.
- `lib/auth/challenge-service.ts` — child challenge creation, verification, attempt counting, and resend transitions.
- `lib/auth/pending-session.ts` — authenticated encryption/decryption and one-time consumption of pending session secrets.
- `lib/auth/pkce-storage.ts` — server-only Supabase Auth storage adapter bound to one parent flow and one SDK `flowId`.
- `lib/auth/auth-mail.ts` — provider-neutral interface for RecallMate-generated login-step-up email.
- `lib/auth/verified-session.ts` — trusted JWT validation and durable verified-session/readiness checks.
- `app/api/auth/{signup,sign-in,verify,resend,enroll,policy-reaccept,sign-out}/route.ts` — strict server auth endpoints; add recovery endpoints in Task 11.

### Database and security tests

- New ordered files under `supabase/migrations/` — additive readiness, consent, parent-flow/child-challenge, verified-session schema and narrow functions; then hook/policy changes in later migrations.
- New SQL checks under `supabase/tests/` — grants, policies, function security, and migration invariants.
- New integration tests under `__tests__/security/` — direct Auth bypass, token-hook behavior, route guard, and cross-flow lifecycle checks.
- `docs/security/recallmate-session-step-up-data-path-inventory.md` — checked-in classification of tables, views, buckets, RPCs, Realtime, actions, API routes, service-role uses, and public Auth control-plane operations.
- `docs/security/recallmate-session-step-up-nonprod-spike.md` — observed provider/SDK behavior and exact isolated test-project identity; no secrets.

## Tasks

### Task 1: Non-production prerequisite, data-path inventory, and provider contract spike

**Files:**
- Create: `docs/security/recallmate-session-step-up-data-path-inventory.md`
- Create: `docs/security/recallmate-session-step-up-nonprod-spike.md`
- Read-only audit: `supabase/migrations/`, `supabase/tests/`, `app/`, `app/actions/`, `lib/`, `utils/supabase/`

**Interfaces:**
- Produces: an owner-approved isolated non-production Supabase project/branch identity and a complete access-path inventory. No product-code interface is introduced.

- [ ] **Step 1: Confirm the non-production target without exposing configuration values**

  Confirm the project reference is not the production project, the Auth/Postgres/Storage/Realtime services required for tests are available, and the project owner approves test data creation. Verify required test environment variable *names/presence* only; never print values. Identify the approved isolated Supabase confirmation-mail sink, RecallMate step-up mail sandbox, and non-production Google test identity needed by Task 14. If any isolated target/mailbox/provider is unavailable, stop here and request approval before creating one, installing infrastructure, or incurring cost.

- [ ] **Step 2: Build the inventory from the current worktree**

  Search all public/private database objects and migrations, `storage.objects` policies, Realtime publications, RPC grants/security modes, Server Actions, API routes, workers, webhooks, retrieval functions, and every `createSupabaseAdminClient`/service-key call. Classify each as `public`, `authenticated-and-step-up-required`, or `server-only`; explicitly classify `app/api/auth/check-availability/route.ts` and other intentionally public Auth endpoints.

  Required current paths to inventory/classify include `app/actions/document-actions.ts`, `app/api/account/route.ts`, `app/api/chat/route.ts`, `app/api/economy/quiz-wrong-answer/route.ts`, `app/api/jobs/{generate-reviewer,process-document,render,worker}/route.ts`, `app/api/learning/{review,session}/route.ts`, `app/api/premium/verify/route.ts`, and `app/api/support/route.ts`, plus shared helpers under `lib/`. Do not infer that a listed worker or support endpoint is browser-originated; Task 5 applies guards only after classification.

- [ ] **Step 3: Pin installed Auth SDK/provider behavior in the isolated project**

  Record, without secrets: the actual signup-confirmation OTP length/configuration and `verifyOtp` type/response; `auth.admin.getUserById()` behavior for an exact ID; Supabase signup resend semantics and whether the old confirmation code remains valid; Custom Access Token Hook events; `getClaims()` signature/expiry behavior; PKCE `signInWithOAuth()`/`exchangeCodeForSession(code, { flowId })` behavior; and callback behavior. Signup resend observations must be separate from app-generated login-code resend.

  For creation correlation, exercise (a) fresh email, (b) existing confirmed email, (c) existing unconfirmed email, (d) concurrent duplicate signup requests from distinct parent flows, (e) timeout after Auth may have created the user, and (f) retry in the same parent flow. Test whether the candidate server-generated correlation property survives the provider roundtrip and cannot be adopted/overwritten by duplicate confirmed or unconfirmed requests. Define exactly three outcomes: `created` (exact-ID lookup plus matching correlation, only if provider behavior proves it), `duplicate` (never bind; neutral response), and `indeterminate` (never bind; retain only expiring unbound intent and allow only safe same-flow retry/recovery). `getUserById()` success, returned `user.id`, email, and timestamps alone are not proof. If no provider-supported correlation contract passes, stop and seek a design decision; do not implement a weaker bind.

- [ ] **Step 4: Review the inventory and spike record**

  Confirm no data path remains unclassified, no email/code/token/credential values appear in notes, and no production state was queried or changed. Record unresolved platform limitations as release blockers, not implementation assumptions.

### Task 2: Add direct-auth bypass integration tests and observe behavioral RED

**Files:**
- Create: `__tests__/security/recallmate-step-up-bypass.integration.test.ts`
- Create: `__tests__/security/recallmate-step-up-test-fixtures.ts`
- Modify only if needed: `vitest.config.ts` for a Node integration-test environment or per-file environment directives

**Interfaces:**
- Consumes: Task 1 isolated project contract and data-path inventory.
- Produces: a non-production-only integration suite that fails on a real access bypass and rejects production project configuration before setup.

- [ ] **Step 1: Write the failing direct-session tests**

  Add named cases for password-only, direct OTP, recovery, direct signup/external-created account with no readiness row, and direct Google OAuth. For each supported session type, assert private fixture reads return no rows, writes are denied, private Storage is denied, protected RPC/Realtime joins are denied, and the representative service-role user route returns a safe denial without billing/retrieval/mutation. Use disposable user/document fixtures created and cleaned only in the isolated project. Fail fast if its project reference matches production.

  Core assertions include:

  ```ts
  expect(await readPrivateFixture(unverifiedClient)).toEqual([]);
  expect(await attemptPrivateWrite(unverifiedClient)).toMatchObject({ allowed: false });
  expect(await callProtectedUserRoute(unverifiedToken)).toMatchObject({ denied: true });
  expect(await assertNoVerifiedClaim(unverifiedToken)).toBe(true);
  ```

  The write helper must normalize the actual PostgREST result/error into `{ allowed: boolean }`; do not rely on an unregistered custom Vitest matcher. Route assertions should pin the safe denial contract without assuming `401` versus `403` where the spec does not require one.

- [ ] **Step 2: Run the integration suite against the isolated baseline**

  Run: `npx.cmd vitest run __tests__/security/recallmate-step-up-bypass.integration.test.ts --reporter=verbose`

  Expected RED: at least one protected data/API operation succeeds or a verified claim is present for a direct, unverified session. Configuration, missing-module, or fixture-setup failures are not valid REDs; fix the harness only before continuing.

- [ ] **Step 3: Preserve the RED as the security acceptance contract**

  Record the first behavioral bypass per access path in the test output and inventory. Do not add production enforcement in this task.

### Task 3: Add the authoritative auth-flow, readiness, consent, challenge, and session schema

**Files:**
- Create using `supabase migration new recallmate_step_up_auth_core`; use the generated timestamped file under `supabase/migrations/` (do not invent the timestamp)
- Create: `supabase/tests/recallmate_step_up_auth_schema.sql`
- Modify: `types/supabase.ts` only if generated application types are maintained by hand

**Interfaces:**
- Produces private records: `recallmate_account_readiness`, `recallmate_legal_consent_events`, `recallmate_auth_flows` (stable parent), `recallmate_signup_intents` (including creation-correlation digest/ciphertext), `recallmate_login_challenges` (RecallMate email-step-up child generations only), and `recallmate_verified_sessions`.
- Produces transaction functions for flow creation/binding, challenge activation/consumption, enrollment, and session revocation; exact SQL signatures must be documented alongside the migration and used by later tasks.

- [ ] **Step 1: Write SQL assertions for table shape and privilege boundaries**

  Assert required columns, unique/partial indexes, foreign keys, RLS on private tables, no browser-role table access, fixed `search_path` on privileged functions, and minimum grants. Assert the signup intent stores only a keyed email digest and is bound only to the exact Auth-returned `user_id`.

- [ ] **Step 2: Run the SQL test before adding schema**

  Run: `supabase test db` against the already-provisioned local test database, or use the approved non-production SQL harness recorded in Task 1. Do not provision tooling or infrastructure here.

  Expected RED: missing relation/function/privilege assertions fail against the isolated database. Do not run this against production.

- [ ] **Step 3: Add the additive schema and narrow atomic functions**

  Implement the six private tables and constraints from the spec. The parent flow owns `flow_handle_mac`, active/pending challenge pointers, pending encrypted session, OAuth state/verifier references, and `stepup_verified_at`; signup intent owns its per-flow creation-correlation HMAC and retry ciphertext; child rows represent RecallMate email-step-up only. Supabase signup confirmation is tracked as flow state and has no app-owned OTP attempt/expiry row. Create only narrow atomic functions with fixed empty `search_path`; expose no browser table access and accept no browser-provided user/session authority.

- [ ] **Step 4: Re-run SQL assertions and inspect the migration diff**

  Run: `supabase test db` against the already-provisioned local test database, or use the approved non-production SQL harness recorded in Task 1.

  Expected: schema/grant assertions PASS. Verify no existing user data is backfilled to `ready`; readiness backfill is a later reviewed operation.

- [ ] **Step 5: Record the migration result**

  Record migration version, isolated project identity, and SQL test result without connection strings or secrets. No production migration is run.

### Task 4: Add the deny-by-default access-token hook and trusted claim validator

**Files:**
- Create using `supabase migration new recallmate_step_up_token_hook`; use the generated timestamped file under `supabase/migrations/`
- Create: `lib/auth/verified-claims.ts`
- Create: `__tests__/security/verified-claims.test.ts`
- Create: `__tests__/security/token-hook.integration.test.ts`

**Interfaces:**
- `verifySupabaseClaims(accessToken: string, expectedIssuer: string): Promise<VerifiedSupabaseClaims>` verifies the signature through configured Supabase `getClaims()`/JWKS behavior, then checks exact issuer, `aud`, `role`, numeric future `exp`, `sub`, and `session_id`.
- The hook preserves Supabase `aal`, returns `rm_login_verified: false` by default, and may set it true only for `ready` account readiness plus an active matching `(user_id, session_id)` row.

- [ ] **Step 1: Write unit and isolated Auth integration tests**

  Cover wrong issuer/project, wrong audience, wrong role, invalid signature, absent/non-numeric/expired `exp`, missing `sub`/`session_id`, and valid signed claims. Exercise signup and `token_refresh` hook events; verify an unready user remains false and an `aal` value is unchanged.

- [ ] **Step 2: Run tests to verify behavioral RED**

  Run: `npx.cmd vitest run __tests__/security/verified-claims.test.ts __tests__/security/token-hook.integration.test.ts --reporter=verbose`

  Expected RED: hook/validator does not yet enforce the required claim contract. No manual JWT base64 decoding is acceptable.

- [ ] **Step 3: Implement hook and validator**

  Use the project-configured Supabase Auth signing-key validation path. Resolve the expected issuer from server configuration (normally `${SUPABASE_URL}/auth/v1`, or the explicitly configured canonical issuer for a custom Auth domain). Never accept an issuer/audience/project value from the request. Configure the hook only in the isolated project and grant it minimum read access.

- [ ] **Step 4: Run focused tests and direct-token probes**

  Run the command from Step 2, then the Task 2 integration suite.

  Expected: invalid claims fail closed; no direct-auth test gains a verified claim. Do not add the restrictive RLS cutover yet.

### Task 5: Enforce RLS, Storage/Realtime/RPC checks, and the service-route guard

**Files:**
- Create: `lib/auth/verified-session.ts`
- Create: `__tests__/security/verified-session.test.ts`
- Create: `supabase/tests/recallmate_step_up_auth_policies.sql`
- Create using `supabase migration new recallmate_step_up_enforcement`; use the generated timestamped file under `supabase/migrations/`
- Modify only inventoried user-originated service-role call sites, including applicable handlers in `app/actions/document-actions.ts`, `app/api/account/route.ts`, `app/api/chat/route.ts`, `app/api/economy/quiz-wrong-answer/route.ts`, `app/api/jobs/{generate-reviewer,process-document,render}/route.ts`, `app/api/learning/{review,session}/route.ts`, and `app/api/premium/verify/route.ts`.
- Review/classify separately: `app/api/auth/check-availability/route.ts`, `app/api/support/route.ts`, and `app/api/jobs/worker/route.ts` plus other internal worker/webhook paths. Browser-originated user-data routes must use the verified-session guard; public endpoints and server-only workers retain their explicitly documented identity model and must not impersonate browser users.

**Interfaces:**
- `requireVerifiedRecallMateSession(supabase: SupabaseClient): Promise<VerifiedRecallMatePrincipal>` returns `{ userId, sessionId, verificationMethod }` only after verified claims and a narrow user-context DB helper confirm the durable `ready` + active-session state.
- `VerifiedRecallMatePrincipal.userId` is always derived from verified `sub`; no user ID is accepted as authority from request data.
- RLS calls `private.recallmate_session_is_verified(): boolean`, a no-argument `STABLE SECURITY DEFINER` function with `search_path = ''` and fully qualified references. It derives `sub` through `auth.uid()` and `session_id` plus `rm_login_verified` from `auth.jwt()`, then requires the claim, `ready` readiness, and a matching active/unrevoked/unexpired `(user_id, session_id)` row. It is owned by `recallmate_authz_reader NOLOGIN NOINHERIT` (no `BYPASSRLS` or membership grants). Grant that role `USAGE` on schemas `private` and `auth`, `EXECUTE` on exactly `auth.uid()` and `auth.jwt()`, and `SELECT` only on the two private tables through role-scoped internal read policies. Revoke helper execution from `PUBLIC`, `anon`, and `service_role`; grant `USAGE` on `private` and execution of only the exact helper signature to `authenticated`; grant browser roles no direct table privileges.

- [ ] **Step 1: Write failing guard and route-order tests**

  Assert missing/false claim, wrong session binding, inactive/expired/revoked row, non-ready readiness, and invalid JWT are denied. Seed one isolated ready user/session through the approved fixture path and prove its existing owner-scoped access still works. For user-originated service-role routes, assert the guard runs before admin client creation, billing, AI job creation, retrieval, message persistence, or mutation. Test server-only workers separately against their explicit worker credential/identity contract; do not add a browser-user guard to them.

- [ ] **Step 2: Run focused tests and SQL policy assertions**

  Run: `npx.cmd vitest run __tests__/security/verified-session.test.ts __tests__/security/recallmate-step-up-bypass.integration.test.ts --reporter=verbose`

  Run: `supabase test db` against the already-provisioned local test database, or use the approved non-production SQL harness recorded in Task 1.

  Expected RED: Task 2's direct-auth tests still demonstrate access and guard tests fail behaviorally.

- [ ] **Step 3: Add restrictive policy and guard enforcement**

  Keep existing owner/tenant predicates and add `private.recallmate_session_is_verified()` to both `USING` and `WITH CHECK` where applicable. Its exact contract is no arguments, boolean return, `STABLE SECURITY DEFINER`, empty `search_path`, qualified references, and identity from `auth.uid()` + `auth.jwt()` only. Own it as `recallmate_authz_reader NOLOGIN NOINHERIT` without `BYPASSRLS` or role membership; grant that role `USAGE` on `private` and `auth`, `EXECUTE` on exactly `auth.uid()`/`auth.jwt()`, and `SELECT` only on readiness and verified-session rows through role-scoped internal policies. Revoke function `EXECUTE` from `PUBLIC`, `anon`, and `service_role`; grant minimum `private` schema `USAGE` and exact-function `EXECUTE` only to `authenticated`; give browser roles no table grants. Apply equivalent owner + step-up checks to private Storage and Realtime. Call `requireVerifiedRecallMateSession()` before privileged clients in every inventoried user-originated route; keep workers/webhooks on explicit server identity.

- [ ] **Step 4: Re-run the direct-auth suite and route regressions**

  Run the commands from Step 2 plus the existing affected route tests.

  Expected: unverified direct Auth paths cannot read/write private data or invoke protected APIs; a valid verified user retains owner-scoped access; route denial happens before side effects.

  Run `supabase db advisors` (or the installed CLI's documented equivalent) only after re-confirming the isolated non-production target. Resolve unexpected grants/policies before proceeding.

### Task 6: Implement durable parent-flow, cryptographic, rate-limit, and mail primitives

**Files:**
- Create: `lib/auth/auth-flow-store.ts`
- Create: `lib/auth/challenge-service.ts`
- Create: `lib/auth/pending-session.ts`
- Create: `lib/auth/auth-mail.ts`
- Create: `lib/auth/auth-rate-limit.ts`
- Create: `__tests__/auth-flow-store.test.ts`, `__tests__/auth-challenge-service.test.ts`, `__tests__/auth-pending-session.test.ts`, `__tests__/auth-mail.test.ts`

**Interfaces:**
- `resolveAuthFlow(cookieHandle: string, purpose: AuthFlowPurpose): Promise<AuthFlowRecord | null>` resolves a stable parent flow; no client challenge ID is accepted.
- `createLoginChallenge(flowId: string, input: ChallengeInput): Promise<ChallengeDelivery>` persists only HMAC code material before delivery.
- `consumeLoginChallenge(flowId: string, code: string): Promise<ChallengeConsumeResult>` is atomic and single-use.
- `encryptPendingSecret(flowId: string, kind: 'refresh_token' | 'pkce_verifier', plaintext: string): Promise<EncryptedSecret>` and `consumePendingSecret(...)` use versioned AEAD and one-time removal.
- `AuthMailAdapter.sendStepUpCode(input): Promise<{ providerMessageId?: string }>` sends only app-generated login challenges and supports provider idempotency when available.

- [ ] **Step 1: Write failing tests for crypto and parent/child transitions**

  Test six-digit code format, HMAC separation by challenge ID, constant-time verifier use, AEAD tamper/version failure, parent-cookie stability, atomic attempt increments, concurrent correct-code single consumption, wrong attempts/lockout, 60-second cooldown, and one active plus one pending child per parent.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `npx.cmd vitest run __tests__/auth-flow-store.test.ts __tests__/auth-challenge-service.test.ts __tests__/auth-pending-session.test.ts __tests__/auth-mail.test.ts --reporter=verbose`

- [ ] **Step 3: Implement narrow adapters and state transitions**

  Implement against Task 3's private RPC contract. Use Web Crypto/Node crypto only through a reviewed server-only module, version keys, and never log payloads. Bind Upstash rate limits to account and keyed IP; fail closed if durable limiting is unavailable. The parent cookie does not change on resend. The old app-generated code remains active only while replacement delivery is pending; successful delivery atomically promotes the child. Keep Supabase signup-confirmation resend out of this two-phase code path.

- [ ] **Step 4: Re-run focused tests and SQL race assertions**

  Run the Step 2 command and the SQL race assertions against the already-provisioned local test database or approved non-production SQL harness. Do not provision tooling or infrastructure as part of this step.

  Expected: all unit/race tests pass and database transitions remain atomic under concurrent requests.

### Task 7: Implement password signup and Supabase-owned signup confirmation

**Files:**
- Create: `app/api/auth/signup/route.ts`
- Create or modify: `app/api/auth/verify/route.ts`, `app/api/auth/resend/route.ts`
- Create: `lib/auth/signup-service.ts`
- Create: `__tests__/signup-auth-route.test.ts`
- Create: `__tests__/security/auth-route-assertions.ts` with `assertAuthNoStore(response)`, `assertAuthCookieAttributes(setCookie, { secure })`, and `postWithOrigin(path, body, origin)` helpers
- Modify: `supabase/tests/recallmate_step_up_auth_schema.sql` only if an additional database invariant is required

**Interfaces:**
- `POST /api/auth/signup` accepts strict `{ username, email, password, confirmPassword, privacyVersion, termsVersion, next? }` and returns the same HTTP status, JSON shape, and neutral copy for a fresh creation, confirmed/unconfirmed duplicate, or indeterminate provider result, plus the safe non-secret `confirmationCodeLength` matching Task 1 provider configuration and stable HttpOnly flow cookie. It never returns a creation/duplicate indicator or user ID/email/code. The UI does not claim that a message was sent or that an account exists; it presents the same generic next-step/recovery guidance for each result.
- `POST /api/auth/verify` accepts only `{ token }`; the parent flow determines signup-confirmation versus app step-up purpose.
- Signup OTP verification resolves canonical email with server-only `auth.admin.getUserById(exactPersistedUserId)`, verifies returned ID, then calls the spike-confirmed Supabase `verifyOtp({ email: canonicalEmail, token, type })` contract.

- [ ] **Step 1: Write failing signup route tests**

  Cover fresh-user creation correlation; existing confirmed duplicate; existing unconfirmed Auth user followed by signup with the same email; two distinct parent flows racing for the same email; provider timeout after possible creation; and same-parent retry. Assert only exact-ID lookup plus a matching, provider-tested flow correlation can bind. Assert duplicate/indeterminate outcomes never bind, never call signup OTP verification, and never finalize consent; returned IDs, `getUserById()` existence, email, and timestamps alone cannot bind. Compare fresh, confirmed-duplicate, unconfirmed-duplicate, and indeterminate responses to prove status, JSON body, and user-visible copy are identical and contain no outcome/account-existence field. Also cover strict extra-field rejection, weak/mismatched password, terms-not-accepted, admin lookup error/mismatched ID/missing canonical email, successful confirmation, and no cookie before readiness/verified-session commit plus refreshed-claim validation. For each auth POST route, assert cross-origin POST is rejected, extra authority/context fields are rejected before privileged work, limiter unavailable fails closed, and responses include `Cache-Control: private, no-store`. Assert any issued flow cookie has the exact HttpOnly/Secure-on-HTTPS/SameSite=Lax/Path=/ attributes and configured expiry.

  Canonical identity assertion:

  ```ts
  expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(PERSISTED_AUTH_USER_ID);
  expect(verifyOtp).toHaveBeenCalledWith({ email: AUTH_RETURNED_CANONICAL_EMAIL, token, type: OBSERVED_SIGNUP_CONFIRMATION_TYPE });
  expect(verifyOtp).not.toHaveBeenCalledWith(expect.objectContaining({ email: BROWSER_EMAIL }));
  ```

  The test fixture must set `OBSERVED_SIGNUP_CONFIRMATION_TYPE` to the exact literal recorded in Task 1's non-production spike. It must not remain a placeholder or be guessed from the email step-up flow.

- [ ] **Step 2: Run focused tests and verify behavioral RED**

  Run: `npx.cmd vitest run __tests__/signup-auth-route.test.ts --reporter=verbose`

- [ ] **Step 3: Implement server signup and verification**

  Use a server-only Supabase Auth client with persistence disabled. Generate a 256-bit correlation per stable parent signup flow, persist its HMAC plus AEAD-encrypted retry value, and pass it through the server-initiated signup data channel selected by Task 1 (candidate: a dedicated Auth user-metadata field that is never authorization evidence). Bind only if Task 1 proved duplicate confirmed/unconfirmed requests cannot inherit or overwrite that correlation and the exact returned ID's admin lookup matches it. Reuse the same correlation only for retries in that parent flow; erase it after binding/terminal expiry. If the provider contract is inconclusive, leave the intent unbound and stop for a design decision. The email digest is for rate limiting/flow matching only and is never reversed or used to identify an Auth user. Signup-confirmation resend calls Supabase's signup resend API using canonical email from the exact bound user ID; follow Task 1's observed old-code validity and do not apply app-generated two-phase rules. For fresh, duplicate, and indeterminate outcomes, emit the same neutral HTTP/body contract; only a correlated fresh creation may bind or be verified, and duplicates/indeterminate results do not call signup OTP verification or finalize consent. On successful confirmation, atomically commit profile + append-only consent + readiness=`ready` + verified-session row, then refresh and validate claims before setting normal SSR cookies.

- [ ] **Step 4: Re-run signup/auth tests and Task 2 denial tests**

  Run: `npx.cmd vitest run __tests__/signup-auth-route.test.ts __tests__/security/recallmate-step-up-bypass.integration.test.ts --reporter=verbose`

  Expected: signup cannot bind to an existing identity, and no session is issued if any canonical-email, database, refresh, or claim check fails.

### Task 8: Implement password sign-in and RecallMate login step-up

**Files:**
- Create: `app/api/auth/sign-in/route.ts`
- Modify: `app/api/auth/verify/route.ts`, `app/api/auth/resend/route.ts`
- Create: `lib/auth/sign-in-service.ts`
- Create: `__tests__/password-step-up-route.test.ts`

**Interfaces:**
- `POST /api/auth/sign-in` accepts strict `{ email, password, next? }`; it never creates a user and returns only a neutral verification-required response after valid primary credentials.
- `POST /api/auth/resend` resolves the stable parent flow from its HttpOnly cookie; it does not accept a user/session/challenge ID.

- [ ] **Step 1: Write failing password-step-up tests**

  Test correct/incorrect credentials with generic responses; no email sent for invalid credentials; session/refresh token remains server-only and AEAD-encrypted; challenge binds exact `user_id` + `session_id`; no Supabase cookie/token or private data before verification; valid ready account receives a cookie only after refresh/claim validation; for an unready account, the parent auth flow is marked `stepup_verified_pending_enrollment` with `stepup_verified_at` but gets no verified-session row/cookie/claim. Reuse `auth-route-assertions.ts` for cross-origin denial, strict unknown-field rejection, limiter-unavailable fail-closed behavior, `private, no-store`, and exact flow-cookie attributes.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `npx.cmd vitest run __tests__/password-step-up-route.test.ts --reporter=verbose`

- [ ] **Step 3: Implement server password flow and app-generated code delivery**

  Call `signInWithPassword()` only in the server route's non-persisting Auth client. Keep account-enumeration-safe responses. Use `AuthMailAdapter` and `ChallengeService`; custom resend follows the two-phase parent/child protocol and keeps the existing parent cookie unchanged. Verify that `signInWithOtp()` is absent from the email login path.

- [ ] **Step 4: Run focused tests and route guard regressions**

  Run: `npx.cmd vitest run __tests__/password-step-up-route.test.ts __tests__/security/verified-session.test.ts --reporter=verbose`

  Expected: only the refreshed matching session for a ready account can be released.

### Task 9: Move Google OAuth to parent-flow-bound PKCE and isolate Calendar linking

**Files:**
- Create: `lib/auth/pkce-storage.ts`
- Modify: `app/api/auth/google/start/route.ts`
- Modify: `app/auth/callback/route.ts`
- Modify: `app/api/integrations/google-calendar/connect/route.ts`
- Modify: `lib/auth-diagnostics.ts`
- Modify: `__tests__/google-auth-start-route.test.ts`, `__tests__/auth-callback-route.test.ts`
- Create: `__tests__/google-auth-flow-isolation.test.ts`

**Interfaces:**
- `createParentBoundAuthClient(flowId: string): SupabaseClient` uses a server-only custom Auth storage adapter whose PKCE verifier is AEAD-encrypted on the parent flow.
- Login callback consumes one-time RecallMate callback state plus the stable parent cookie, then calls `exchangeCodeForSession(code, { flowId: storedSupabaseFlowId })` on a non-persisting client.
- Google Calendar linking has a distinct `flowPurpose = 'calendar_link'` and separate cookie/PKCE storage namespace; it never resolves or consumes a `google_login` parent flow.

- [ ] **Step 1: Write failing OAuth and flow-isolation tests**

  Cover state absent/mismatch/replay, cross-origin callback/start attempts where applicable, `private, no-store` redirect/response headers, cookie-parent mismatch, callback with expired/revoked flow, two simultaneous Google sign-ins exchanging only their own verifier, server-side verifier encryption/one-time removal, no normal auth cookie before email step-up, and the Calendar callback retaining the already verified app session.

- [ ] **Step 2: Run focused OAuth tests to verify RED**

  Run: `npx.cmd vitest run __tests__/google-auth-start-route.test.ts __tests__/auth-callback-route.test.ts __tests__/google-auth-flow-isolation.test.ts --reporter=verbose`

- [ ] **Step 3: Implement one-time OAuth state and PKCE binding**

  At Google login start, persist an HMAC of a fresh RecallMate callback-state nonce on the parent flow and pass the nonce as a callback correlation parameter. At callback, atomically validate/consume that nonce against the parent cookie before exchange. Do not override Supabase's own OAuth protocol state: Supabase Auth validates its state during its callback/code flow. Save the `flowId` returned by `signInWithOAuth()` on the parent record; store the verifier through the custom server-only AEAD storage adapter; pass only that flow's `flowId` to `exchangeCodeForSession`. Do not fall back to another verifier and do not persist pending session cookies.

  Keep `integration=google-calendar` on its own namespace. Require an already verified session at connect and callback, validate its separate state/cookie, use only the Calendar flow's PKCE verifier, and prove exchange does not replace or elevate the current RecallMate session. Preserve the existing provider-token and event-sync behavior.

- [ ] **Step 4: Run focused OAuth and Auth integration tests**

  Run the Step 2 command and the Task 2 direct-auth integration suite.

  Expected: one-time callbacks and concurrent flows cannot cross-bind; Google sign-in proceeds to email step-up, while Calendar linking remains a separate already-authenticated integration.

### Task 10: Implement controlled enrollment and policy re-acceptance

**Files:**
- Create: `app/api/auth/enroll/route.ts`
- Create: `app/api/auth/policy-reaccept/route.ts`
- Create: `app/(auth)/policy-reaccept/page.tsx`
- Create: `lib/auth/enrollment-service.ts`
- Create: `__tests__/auth-enrollment-route.test.ts`, `__tests__/policy-reacceptance-route.test.ts`, `__tests__/policy-reacceptance.test.tsx`

**Interfaces:**
- `POST /api/auth/enroll` accepts only profile/consent fields; it resolves the parent flow and never accepts `userId`, readiness, verification, or session claims.
- `POST /api/auth/policy-reaccept` derives the account from a signature-verified Supabase token and allows only recording currently required consent; it is not a general service-role/data route.

- [ ] **Step 1: Write failing enrollment and re-acceptance tests**

  Test first-time Google/direct Auth/legacy OTP users cannot access data; correct step-up records only `stepup_verified_at` while unready; enrollment commits profile + current append-only consent + readiness=`ready` + verified-session row atomically; transaction failure commits none; forged metadata cannot establish readiness. Route tests for policy re-acceptance must prove forged `sub`/body `userId` cannot affect another account, only current consent versions are accepted, no private data is accessible, no verified-session row or normal cookie is created, and reacceptance alone cannot restore access. UI tests cover the restricted consent screen. Expired/revoked parent flow, mismatched pending `(user_id, session_id)`, and `stepup_verified_at` older than 10 minutes must reject, destroy pending secrets, and require fresh primary authentication + step-up. Demoting readiness to `policy_reaccept_required` revokes active verified-session access; reacceptance alone does not reactivate it.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `npx.cmd vitest run __tests__/auth-enrollment-route.test.ts __tests__/policy-reacceptance-route.test.ts __tests__/policy-reacceptance.test.tsx --reporter=verbose`

- [ ] **Step 3: Implement narrowly scoped enrollment transactions**

  Use the parent flow's pending-session and verified `stepup_verified_at` evidence for first-time Google/external enrollment, with the 10-minute/parent-expiry/session-binding checks before consuming it. For policy re-acceptance, create a restricted route that validates the signed project token and exact subject, accepts only current consent versions, writes append-only events, and changes readiness through the narrow transaction. It must not expose private data or produce a normal session; require fresh step-up after readiness is restored.

- [ ] **Step 4: Run focused, RLS, and service-route tests**

  Run the Step 2 command, SQL policy tests against the already-provisioned local test database or approved non-production SQL harness, and the Task 2 bypass suite.

  Expected: incomplete consent/enrollment states remain blocked at RLS and service routes; only server-authoritative state transitions reach `ready`.

### Task 11: Implement password recovery, secure settings, logout, and revocation

**Files:**
- Create: `app/api/auth/recovery/start/route.ts`
- Create: `app/api/auth/recovery/complete/route.ts`
- Create: `app/api/auth/sign-out/route.ts`
- Modify: `app/(app)/settings/page.tsx`
- Create: `lib/auth/recovery-service.ts`
- Create: `__tests__/auth-recovery-route.test.ts`, `__tests__/auth-session-revocation.test.ts`
- Reuse: `__tests__/security/auth-route-assertions.ts`

**Interfaces:**
- Recovery sessions are limited to password reset and cannot pass `requireVerifiedRecallMateSession()`.
- Sign-out revokes only the current `(user_id, session_id)` by default; global reset/session policy is explicit and tested.

- [ ] **Step 1: Write failing recovery/logout/settings tests**

  Cover neutral forgot-password responses, recovery token/session denial for all RecallMate data, successful password reset followed by revocation and required fresh login + step-up, current-password/recent-auth requirements for password change, Google-only add-password behavior, logout revocation, and an open Realtime channel being closed locally with queued events ignored. For each new auth POST route, test cross-origin denial, strict request fields, rate-limit-unavailable fail-closed behavior, `Cache-Control: private, no-store`, and exact cookie attributes using the shared assertions.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `npx.cmd vitest run __tests__/auth-recovery-route.test.ts __tests__/auth-session-revocation.test.ts --reporter=verbose`

- [ ] **Step 3: Implement recovery, change-password, and revocation paths**

  Keep Supabase Auth control-plane limitations documented. Recovery never writes `rm_login_verified`; password/email update policy and direct Auth behavior are tested independently. Do not trust UI hiding to secure direct `/auth/v1/user` operations.

- [ ] **Step 4: Run focused and direct-auth regression tests**

  Run the Step 2 command and Task 2 direct-auth suite.

  Expected: recovery cannot reach protected data and logout/revocation blocks new database/API work for the session.

### Task 12: Pin and verify the Supabase Auth control-plane boundary

**Files:**
- Create: `__tests__/security/auth-control-plane.integration.test.ts`
- Update: `docs/security/recallmate-session-step-up-nonprod-spike.md` with config/result evidence only

**Interfaces:**
- Consumes: the approved isolated project, test mailbox, and provider contract from Task 1.
- Produces: an explicit test record of direct Auth API behavior/configuration, separate from RecallMate RLS and `requireVerifiedRecallMateSession()`.

- [ ] **Step 1: Write direct Auth API/configuration tests**

  Against disposable identities in the isolated project, test the direct `/auth/v1/user` password/email/metadata operations, direct signup/confirmation, and identity link/unlink endpoints. Verify 12-character minimum, email confirmation enabled and no session before confirmation, secure email change requiring both confirmations, secure password change/current-password or recent-auth requirements, password/security notification configuration, leaked-password protection when plan-supported, and manual identity linking disabled. Use the non-production mailbox to verify required confirmation/notification messages without logging codes. Explicitly do **not** expect `rm_login_verified` or Postgres RLS to block `/auth/v1/user`; test and document that Auth control-plane residual separately, while confirming direct Auth sessions still cannot access RecallMate tables/routes.

- [ ] **Step 2: Run the integration test and classify each result**

  Run: `npx.cmd vitest run __tests__/security/auth-control-plane.integration.test.ts --reporter=verbose`

  Expected: every setting is either verified by an API probe or explicitly marked unsupported by the isolated project's plan/provider; unsupported leaked-password protection is recorded as a release residual, not silently passed.

- [ ] **Step 3: Correct only isolated non-production Auth configuration**

  If a required control is misconfigured, change only the approved isolated project, then rerun the exact direct API test. Do not change production Auth settings. If a required setting cannot be enabled, stop and require owner risk acceptance before release.

- [ ] **Step 4: Re-run direct-auth bypass tests**

  Run: `npx.cmd vitest run __tests__/security/recallmate-step-up-bypass.integration.test.ts __tests__/security/auth-control-plane.integration.test.ts --reporter=verbose`

  Expected: configured Auth controls behave as specified, and any direct Auth session remains unable to access RecallMate private data or user-data service routes.

### Task 13: Migrate login, signup, verification, onboarding, and auth UI

**Files:**
- Create: `components/auth/EmailPasswordForm.tsx`
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/verify-email/page.tsx`, `app/(onboarding)/onboarding/page.tsx`
- Modify: `components/auth/OTPInput.tsx`, `components/auth/ResendButton.tsx`, `components/auth/OAuthButtons.tsx`, `components/auth/AuthCard.tsx`
- Modify: `__tests__/auth.test.tsx`
- Remove `components/auth/EmailOTPForm.tsx` only after all imports/tests are migrated and no references remain.

**Interfaces:**
- The client forms `fetch()` POST only to `/api/auth/sign-in`, `/api/auth/signup`, `/api/auth/verify`, `/api/auth/resend`, and `/api/auth/enroll`; do not add Server Actions or direct browser Supabase Auth calls.
- `next` continues through `safeAuthenticatedNextPath()`; email, OTP, password, tokens, and user IDs are not placed in URLs or persistent browser storage.

- [ ] **Step 1: Write failing component and route-flow tests**

  Test signup has username/email/password/confirm/unchecked required Terms and Privacy; login has email/password and no browser `signInWithPassword()` call; signup/login actions `fetch()` only the defined route handlers; successful signup/login proceeds to `/verify-email` without email in the URL; signup confirmation accepts the configured provider token length from Task 1 while RecallMate step-up remains six digits; wrong/expired/rate-limited code is accessible/recoverable; resend keeps the same server flow while stale UI responses are ignored; onboarding contains no password field or password update; Google remains available; safe `next` survives; diamond auth loader and accessible live-region announcements remain.

- [ ] **Step 2: Run auth UI tests to verify RED**

  Run: `npx.cmd vitest run __tests__/auth.test.tsx --reporter=verbose`

- [ ] **Step 3: Implement the client/server UI transition**

  Use `EmailPasswordForm` with controlled fields and `fetch()` to the existing API Route Handler contracts; do not introduce Server Actions. Make `OTPInput` accept a server-provided, non-authoritative configured token length for signup confirmation and six cells for RecallMate step-up. Remove direct browser `signInWithOtp()` and `verifyOtp()` from the app flow. Keep onboarding for profile completion only and treat Auth metadata as display/projection data, never readiness authority. Preserve Google OAuth and the RecallMate diamond loader.

- [ ] **Step 4: Run auth UI, callback, and type checks**

  Run: `npx.cmd vitest run __tests__/auth.test.tsx __tests__/google-auth-start-route.test.ts __tests__/auth-callback-route.test.ts --reporter=verbose`

  Expected: email/password UI uses the server boundary, Google path remains separate, and no email appears in the verification URL.

### Task 14: Complete isolated non-production acceptance and whole-app regression

**Files:**
- Modify: `__tests__/security/recallmate-step-up-bypass.integration.test.ts` as new gates are added
- Modify: `supabase/tests/recallmate_step_up_auth_policies.sql`
- Create: `docs/security/recallmate-session-step-up-nonprod-acceptance.md`
- Create: `playwright.config.ts`, `tests/e2e/auth-step-up.spec.ts`, and `tests/e2e/support/nonprod-mailbox.ts`
- Modify: `package.json` and the lockfile to add `@playwright/test` and `test:e2e:auth` (Task 1's repository inventory found no compatible existing browser runner)

**Interfaces:**
- Consumes all prior task interfaces. Produces a non-production acceptance record with pass/fail and project reference only; no credentials, codes, or tokens. Browser tests run in Playwright Chromium against the exact owner-approved isolated project.

- [ ] **Step 1: Run Supabase security advisors and SQL policy/grant tests**

  Confirm the Supabase CLI target is the Task 1 isolated project or its already-provisioned local test database; stop if the target is production or ambiguous. Run `supabase db advisors` (or the installed CLI version's documented equivalent against that same non-production target) and record the CLI version, target, and findings. Resolve unintended grants/policies/functions before acceptance.

  Run: `supabase test db` against the already-provisioned local test database, or use the approved non-production SQL harness recorded in Task 1.

  Run: `npx.cmd vitest run __tests__/security --reporter=verbose`

  Run: `npx.cmd vitest run __tests__/signup-auth-route.test.ts __tests__/password-step-up-route.test.ts __tests__/google-auth-start-route.test.ts __tests__/auth-callback-route.test.ts __tests__/auth-enrollment-route.test.ts __tests__/policy-reacceptance-route.test.ts __tests__/auth-recovery-route.test.ts --reporter=verbose`

- [ ] **Step 2: Configure and start the isolated browser-test runtime**

  Use `playwright.config.ts` with `baseURL: http://127.0.0.1:3100` and `webServer.command: npm run dev -- --hostname 127.0.0.1 --port 3100`; test the exact routes `http://127.0.0.1:3100/signup`, `/verify-email`, `/onboarding`, `/dashboard`, and `http://127.0.0.1:3100/login?next=%2Fdashboard`. Fail before server/test setup if the configured Supabase project reference is not the Task 1 non-production reference. Obtain signup confirmation OTPs from the owner-approved isolated Supabase Auth mail sink and app step-up OTPs from the isolated `AuthMailAdapter` capture sandbox via `nonprod-mailbox.ts`; codes may exist only in test-process memory and must never be logged, returned by an app endpoint, or stored in artifacts. If no approved mailbox retrieval mechanism or test Google identity exists, stop and mark those cases blocked rather than adding a code/secret backdoor.

- [ ] **Step 3: Exercise the browser matrix and two independent flows**

  Run: `npx.cmd playwright test tests/e2e/auth-step-up.spec.ts --project=chromium`

  Cover `/signup` → `/verify-email` → `/onboarding` → `/dashboard`; `/login?next=%2Fdashboard` → `/verify-email` → `/dashboard`; logout; wrong-code recovery/resend; and password recovery/change. Assert signup entry uses provider-configured `confirmationCodeLength`, app step-up remains six digits, no email/password/code appears in any URL, browser storage, response body, or logs, and safe `next` survives. For cross-flow isolation, launch two concurrent login/OAuth flows in separate browser contexts with separate parent cookies and mailbox correlation IDs; a code/verifier from flow A must not complete flow B. Use an owner-approved non-production Google test identity; preserve the separate Calendar flow and assert linking does not replace/elevate the verified app session. A case passes only when route/session and denial/side-effect assertions all pass; console/server errors, wrong redirects, or credential/code leakage fail it.

  For Realtime, assert a verified fixture reaches `SUBSCRIBED`, a newly opened channel after server-side test revocation is denied, and local logout closes the channel and discards queued events. Revoke only through the Node test fixture using the isolated service credential, never a test-only HTTP endpoint. Measure whether an already-open remote channel continues until token refresh/expiry; if so, record its exact exposure bound and leave acceptance blocked pending the security sign-off required by the spec.

- [ ] **Step 4: Run full repository verification**

  Run: `npx.cmd vitest run --reporter=verbose`

  Run: `npx.cmd playwright test tests/e2e/auth-step-up.spec.ts --project=chromium`

  Run: `npm run build`

  Run: `npx.cmd tsc --noEmit`

  Run: `git diff --check`

  Expected: all existing and new tests pass, production build passes, typecheck passes, and no whitespace errors. If a code change follows, rerun the complete gate.

- [ ] **Step 5: Review the non-production acceptance record**

  Record each matrix item as PASS/FAIL, the isolated project reference, migration/test versions, and any unresolved platform residual. Do not record credentials, Auth identities, OTPs, session values, or document contents.

### Task 15: Write production preflight and two-phase cutover instructions (do not execute)

**Files:**
- Create: `docs/security/recallmate-session-step-up-production-preflight.md`
- Reference: `docs/superpowers/specs/2026-09-28-recallmate-session-step-up-auth-design.md`

**Interfaces:**
- Produces an owner-reviewable runbook only. It does not alter production Auth settings, schema, users, sessions, or deployment.

- [ ] **Step 1: Write the no-mutation production preflight checklist**

  Include exact project identity verification; read-only migration/schema/RLS/grant inventory; reviewed migration/backfill row counts; Auth hook and provider configuration preconditions; approved test account allowlist; maintenance-mode/rollback boundaries; expected issuer/audience/role/claim/session checks; direct-auth denial probes; and explicit stop conditions. Require separate owner approval before every production mutation/deploy/cutover action.

- [ ] **Step 2: Review the runbook against the spec rollout sequence**

  Confirm compatible code/schema/hook support is preflighted before restrictive enforcement, protected traffic stays closed during the enforcement cutover, no legacy unverified UI is reopened, and rollback never disables RLS or verified-session checks. Verify the document contains no production credentials or executable mutation command presented as already authorized.

## Execution Notes

- The plan is one cohesive project because the server session, token hook, Postgres policies, service-role routes, and UI all enforce the same authorization contract; splitting them into independently shippable plans would create insecure intermediate states.
- No implementation begins until an isolated non-production environment is approved and the user selects an execution method.
- The current worktree contains broad dirty RecallMate changes. Capture its state before execution, preserve unrelated changes, and do not commit/stage from that worktree unless the auth-only diff can be isolated and reviewed safely. This plan itself does not stage or commit files.
- Production preflight, mutation, and deployment are separate owner-approved release decisions, not completion steps for this implementation plan.
