# Medea Secure Document Loading — Implementation and Verification Record

Date: 2026-09-27

## Implementation record

### TypeScript and Test-Harness Corrections

Two test-only TypeScript issues were identified during final verification:

1. `medea-document-route.test.ts`
   - The POST route accepts `NextRequest`.
   - The test helper previously constructed a standard `Request`.
   - The helper was corrected to construct a real `NextRequest`.
   - No casts or production route type changes were introduced.

2. `medea-drawer.test.tsx`
   - `MedeaRequest.nonce` is defined as a number.
   - Seven newly added test fixtures used string nonces.
   - The fixtures were corrected to use numeric nonces.
   - The production `MedeaRequest` contract was not weakened.

Reported verification after these corrections:
- TypeScript: PASS
- Medea document route tests: 31/31 PASS
- Medea drawer tests: 15/15 PASS

The first route-test attempt stopped during provider configuration because
model IDs were not present in the test process. The tests were rerun with
non-secret model IDs configured process-locally. No `.env` files or
persistent environment configuration were modified.

### Document Stream History Isolation — 2026-09-28

A regression test first reproduced the A-to-B state leak: after switching to
document B and sending a question, the assistant answer from document A
reappeared in the visible conversation. The drawer now clears both its local
messages and the AI SDK message history when leaving a saved-document source.

- Focused regression: PASS (1 test)
- Medea drawer suite: PASS (16/16)
- TypeScript: PASS
- No general-chat transport, metadata-fetch, or streaming-mirroring behavior
  was changed in this fix.

## Whole-project verification

| Gate | Result |
| --- | --- |
| `npx.cmd vitest run --reporter=verbose` | Exit 0; 58 test files passed, 434 tests passed, 0 failed; 109.92s |
| `npx.cmd tsc --noEmit` | Exit 0 |
| `npm run build` | Exit 0; Next.js compiled and generated all 45 static pages |
| Scoped `git diff --check` | Exit 0; no whitespace errors in scoped tracked files. Git printed only LF-to-CRLF normalization warnings. |
| Scoped `git diff --stat` | 4 tracked files; 2,649 insertions and 87 deletions |

The scoped diff stat does not include the newly created, currently untracked
`__tests__/medea-document-route.test.ts`; Git's ordinary `diff` commands omit
untracked files. Include that test file explicitly in the later whole-branch
review before staging or committing.

The fresh Vitest run and build used process-local, non-secret model IDs
(`GEMINI_MODEL_CHAT`, `GEMINI_MODEL_NOTES`, and `GEMINI_MODEL_QUIZ` were set to
`gemini-test`). No environment files or persistent environment settings were
changed. Vitest also printed existing Vite loader, PDF/font polyfill, and React
`act(...)` warnings, along with expected simulated failure logs; all tests
passed.

## Remaining acceptance gates

- Browser acceptance for ready, pending, and failed saved documents; streamed
  replies; A-to-B switching; and switching from document mode to general Medea.
- Read-only verification of the intended production Supabase project, document
  schema, RLS, and retrieval scoping.
- Whole-branch review, including unrelated dirty and untracked worktree files.

No production database mutation or deployment was performed. This record does
not claim browser acceptance or production-schema verification is complete.

## Browser Acceptance — 2026-09-28

Browser: Codex in-app browser, local development server at `http://localhost:3000`.

| Case | Result |
| --- | --- |
| Ready document metadata | BLOCKED — navigating to `/dashboard` redirected to `/login?next=/dashboard`; no authenticated session was available. |
| Saved-document streamed response | BLOCKED — requires the authenticated document flow. |
| Processing/failed no-fallback | BLOCKED — requires the authenticated document flow. |
| A → B stale-state protection | BLOCKED — requires an authenticated drawer session with selectable documents. |
| Document → general reset | BLOCKED — requires an authenticated drawer session. |
| Relevant browser console errors | None observed on the rendered login page; the protected drawer flows were not rendered. |

The local landing page rendered, the protected dashboard redirected to sign-in,
and no Next.js error overlay appeared on the observed page. Browser console
inspection returned no errors for that page. The dev server logged that its
Google Fonts request was blocked by the environment and Next.js used its
fallback font. Drawer open/close, general Medea, and direct attachment behavior
were not browser-verified without an authenticated session. No account was
created and no external sign-in was started.

## Production Supabase Read-Only Verification — 2026-09-28

| Check | Result |
| --- | --- |
| Repository migration inspection | VERIFIED — local migrations define the expected document/chunk columns and ownership RLS policies. |
| Production catalog/schema | NOT VERIFIED — the configured expected project was not accessible through the available Supabase connection. |
| Production RLS/policies | NOT VERIFIED — no production catalog query was run. |
| Production mutation | No. |

The repository's expected production reference is `eihrsnqqpaafjzhgwxch`.
The Supabase project listing exposed only `dzyopanccqqoqtumkoxm` and
`lrlqyxaofnmhgmuivxge`, both inactive; neither was queried. A metadata lookup
for the expected reference returned a permission error, and the Supabase CLI
was not available on PATH. Therefore no production schema or RLS result is
claimed. The relevant local migration definitions are in
`supabase/migrations/20260813000001_initial_schema.sql` and
`supabase/migrations/20260906160711_optimize_rls_and_indexes.sql`.

## Current completion status

Task 2 has passed the automated local gates, but remains incomplete pending
authenticated browser acceptance, read-only verification against the intended
production project, and the final whole-branch requirements review. Do not
stage, commit, or deploy as part of this record.

### Scope Review — Legacy General Chat

Status: Pending attribution.

The current source worktree (`D:\MedRev\recallmate`) and Task 2 worktree have
the same legacy general-chat `documentContext` prompt selection and grounding
behavior. The drawer's `attachmentFirstContext` usage, `documentContext` field,
`sourceScopedHistory` field, and general-chat POST body are also unchanged
between the two current copies. No source-vs-Task2 diff hunk changes those
legacy sections.

Both source files are modified relative to their Git HEAD, and the initial
Task 2 sync has no committed baseline. Therefore the current comparison is
consistent with inherited/preexisting code, but cannot establish when the
source worktree last changed if it changed after the Task 2 copy was made.
No code was changed or reverted pending attribution.

### Latest Completion Checklist — 2026-09-28

Implementation and automated verification are complete for the latest
reported code. Task 2 itself remains incomplete because acceptance and release
gates are unresolved.

Automated verification:
- [x] Focused A → B leak regression — 1/1
- [x] Drawer suite — 16/16
- [x] TypeScript
- [x] Full Vitest suite — 58 files, 434/434
- [x] Production build — 45 static pages
- [x] Scoped diff check
- [x] Verification record updated

Acceptance and release gates:
- [ ] Authenticated browser acceptance — blocked pending the user's local sign-in.
- [ ] Intended production Supabase schema verification — blocked pending read-only project access.
- [ ] Intended production Supabase RLS/policy verification — blocked pending read-only project access.
- [ ] Final whole-branch sign-off — pending review of the intended Task 2 files and artifacts; unrelated dirty files remain out of scope.
- [ ] Commit / PR / deployment — not authorized before acceptance gates are resolved or explicitly waived.

No further production changes are planned unless a review or acceptance test
reveals another defect. The browser and production Supabase gates were not
passed or waived, and no production database mutation, commit, PR, or
deployment was performed.
