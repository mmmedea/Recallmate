# Medea navigation verification — 2026-09-23

## Scope and status

Task 1's canonical navigation and request-handoff changes are verified locally. This is **not production acceptance** and does not complete secure document loading (Task 2).

No deployment or Supabase mutation was performed in this pass. Unrelated worktree changes were preserved. Notes generation, Quiz quality, file extraction, and economy logic were not changed in this navigation pass.

## Implemented navigation behavior

- `MedeaLauncher` uses the canonical Zustand `openMedea` action. Top bar, sidebar, mobile, dashboard, Topics, Study Hub, and Review entry points use this path.
- Document-scoped launches carry a document ID; global launches clear the previous launch request/context. This is request routing, not server-side authorization or retrieval.
- Requests have unique default nonces, trim empty values, and are not persisted. Hydration ignores old saved launch state without overwriting a new in-flight launch.
- Suggested prompts prefill once and never auto-send. Closing clears the pending request.
- Dashboard remains server-compatible. The old `/chat` route remains for backward compatibility, not new in-app navigation.
- A selected document is explicitly marked **not loaded**. Sending is blocked until secure source loading is implemented, with an explicit option to switch to general Medea.
- The dialog has an accessible name, `aria-modal`, initial focus, Tab wrapping, Escape dismissal, and launcher-focus restoration. Switching from a pending document to general chat no longer loses focus when its action button disappears.

## Verification

| Check | Result |
| --- | --- |
| Targeted Medea/dashboard regression tests | 46 passed across 6 files |
| Targeted Quiz, fallback, policy, and academic-source tests | 16 passed across 4 files |
| Full Vitest suite | 387 passed, 0 failed across 57 files (387 tests total; 323.54s) |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |
| `npm.cmd run build` | Exit 0; all 45 static pages generated |
| Browser: document handoff, general-chat switch, focus and Escape | Passed |
| Browser: suggestion prefill and Tab/Shift+Tab wrapping | Passed |

The final focus regression was observed failing before the fix and passing afterward. The browser checks used the real launcher, store, and drawer in a local fixture. The fixture recorded **zero attempted backend requests**, and no browser console errors were observed. It was not a Google-authenticated production session. The test tab and temporary server were closed afterward.

Machine-readable evidence from the latest run is saved at `tmp/task1-vitest-results-clean.json`; its log is `tmp/task1-full-suite-clean.log`. The latest build log is `tmp/task1-build-clean.log`. Earlier navigation-specific evidence remains under `tmp/task1-targeted-results.json` and `tmp/task1-vitest-results.json`.

## Quiz/fallback test-contract cleanup — 2026-09-27

The three failures reported by the earlier 381/3 run were resolved by aligning test coverage with the existing Quiz policy; production Quiz and fallback code was not changed.

- Semantic-deduplication coverage now uses Easy so it tests deduplication independently of Medium's no-recall rule; a separate test explicitly protects that Medium rule.
- Easy fallback fixtures now contain four real definition pairs, matching the generator's existing minimum. Medium and Hard tests explicitly assert that local fallback does not silently downgrade difficulty or invent scenarios.
- Unsupported-difficulty normalization is exercised with sufficient valid source definitions and verifies that `Loading...` artifacts do not enter generated content.
- Correct-answer assertions first require non-empty output, avoiding vacuous passes.
- Only `__tests__/quiz-engine-v2.test.ts` and `__tests__/study-content-fallback.test.ts` were changed for this cleanup. No validators or production behavior were weakened.

## Next gate

The local verification baseline is green, but this does not complete Task 2 or production acceptance. Keep secure document loading separate: ownership-checked server-side lookup, extraction readiness, attachment-first retrieval, visible source state, and grounded follow-ups. Do not treat a client-supplied document ID or the local component fixture as proof of authorization, grounding, or live production behavior. No deployment or Supabase mutation was performed in this pass.
