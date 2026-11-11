# Medea Secure Document Loading — Design

## Goal

Allow Medea to securely use a saved RecallMate document as its active
source without trusting client-supplied document content or ownership.

## Existing Architecture

- Medea launch requests contain `documentId`, not document text.
- `OmniChatDrawer` currently recognizes selected documents but does not
  load them.
- `/api/chat` already authenticates users and supports document-scoped
  retrieval.
- Saved document content lives in `document_chunks`.
- Existing RLS and retrieval logic scope document data to its owner.
- Saved-document POST uses the existing AI SDK streaming contract.

## Security Boundary

The browser may provide:

- `documentId`
- question
- `requestId`

The browser must never provide trusted versions of:

- `userId`
- `fileName`
- extracted document text
- chunk content
- document ownership
- document readiness

The server derives all trusted document metadata and content.

## Document Resolution

Add:

```http
GET /api/chat?documentId=4a6f50c2-3a2e-4f8c-9d1b-6c2f9e7a1234
```

The route must:

1. Authenticate the current user.
2. Validate `documentId` before querying.
3. Query the document using both the authenticated user ID and document ID.
4. Verify document lifecycle status.
5. Verify at least one usable extracted chunk exists.
6. Return only safe, server-derived metadata.

The successful metadata response has exactly this shape:

```json
{
  "documentId": "4a6f50c2-3a2e-4f8c-9d1b-6c2f9e7a1234",
  "fileName": "lecture-notes.pdf",
  "readiness": "ready"
}
```

`readiness` is one of `ready`, `processing`, or `failed`. A ready response
is allowed only when the authenticated user owns the document,
`documents.status === "completed"`, and at least one usable
`document_chunks` row exists. `fileName` is server-derived display metadata,
not a storage path.

Every GET response, including errors, must include:

```http
Cache-Control: private, no-store
```

Never return extracted text, storage paths, owner IDs, chunk contents, or
internal database errors from this endpoint.

## Enumeration Protection

Unauthenticated requests return `401`. An invalid document ID returns a
safe `400 INVALID_DOCUMENT_ID` response without querying documents.

For authenticated requests, a nonexistent document and a document owned
by another user must be indistinguishable to the client. Return the same
safe response for both, preferably:

```http
404
```

```json
{ "error": "DOCUMENT_NOT_FOUND" }
```

Do not reveal whether another user's document exists.

## Readiness Rules

A saved document is usable only when:

- the authenticated user owns it;
- `documents.status === "completed"`;
- at least one usable `document_chunks` row exists.

A usable chunk has non-empty extracted content after whitespace
normalization. A completed document with zero usable chunks is not ready.
For an owned document, GET returns HTTP `200` with the safe metadata shape
and `readiness: "processing"` while extraction is still in progress.
Return HTTP `200` with `readiness: "failed"` for failed extraction or a
terminal source that cannot be used, including a completed document with
no usable chunks. These statuses describe source readiness, not whether a
document row was found. Do not treat processing, failed, inaccessible,
missing, or empty documents as loaded.

## Document Chat POST

The existing `POST /api/chat` remains the document-chat boundary.

Every document request must independently:

1. Authenticate.
2. Validate the strict request body.
3. Verify ownership using the authenticated user ID and document ID.
4. Verify lifecycle readiness.
5. Verify at least one usable chunk exists.
6. Retrieve only chunks belonging to that user and document.
7. Answer using the existing document-scoped streaming response.

A previous successful GET does not authorize a later POST. The saved-
document request must not accept client-supplied `userId`, `fileName`,
`extractedText`, or `chunks`. If any ownership, readiness, or retrieval
check fails, return a safe document-specific error; never continue through
the general-chat path.

## Prompt-Injection Boundary

Retrieved document content is untrusted evidence. Instructions contained
inside uploaded documents must never override system or developer
instructions. Clearly delimit document text as source data before sending
it to the model, and explicitly instruct the model to treat it as evidence,
not as instructions governing its behavior.

## OmniChatDrawer State

When Medea receives a document launch:

1. Clear stale active-document metadata.
2. Clear the visible conversation associated with the previous source.
3. Enter document-loading state.
4. Resolve metadata through `GET /api/chat?documentId=4a6f50c2-3a2e-4f8c-9d1b-6c2f9e7a1234`.
5. If ready, show `Using: lecture-notes.pdf` using the server-derived
   filename and enable sending.
6. If unavailable, display a safe source-specific error and keep sending
   blocked.

Do not silently change to general Medea.

## Race Handling

Changing `documentId` must abort the previous source-resolution request or
invalidate it with a request token. A late response from an older request
must never replace the currently selected source. Closing Medea or
switching to general chat must invalidate pending document resolution.

## General Chat

Explicitly switching to general Medea:

- clears active saved-document state;
- clears the document-specific conversation;
- removes the visible `Using:` source;
- allows normal general-chat behavior.

General chat must be entered explicitly, never as an error fallback.

## Direct Attachments

Direct file attachments remain on the existing general-chat attachment
path. They must not substitute for a saved RecallMate document that failed
authorization or source resolution.

## Error Behavior

- Anonymous: `401`.
- Authenticated foreign or nonexistent document: identical `404`
  `DOCUMENT_NOT_FOUND` response.
- Owned processing document: HTTP `200` with safe metadata and
  `readiness: "processing"`; sending remains blocked.
- Owned failed extraction or completed document with no usable chunks:
  HTTP `200` with safe metadata and `readiness: "failed"`; sending remains
  blocked.
- Internal database failure: safe `503` response; internal details never
  reach the browser.

All document-source failures keep the selected-document flow blocked.
They must not submit the question through general Medea, history, web
context, or direct attachments.

## Testing

### Route tests

Create:

```text
__tests__/medea-document-route.test.ts
```

Cover:

- authenticated owner + completed document + usable chunks → ready;
- anonymous → `401`;
- foreign document → safe `404`;
- missing document → the same safe `404` as a foreign document;
- processing document → not ready;
- failed document → unavailable;
- completed document with zero usable chunks → unavailable;
- metadata response excludes text, chunks, owner, and storage fields;
- every GET response is private/no-store;
- document POST repeats ownership, lifecycle, and usable-chunk checks.

### Request-contract tests

Extend:

```text
__tests__/medea-chat-request.test.ts
```

Cover:

- valid document request accepts `documentId`, question, and `requestId`;
- `userId` is rejected;
- `fileName` is rejected;
- `extractedText` is rejected;
- chunk payload is rejected;
- malformed `documentId` is rejected where applicable.

### Drawer tests

Extend:

```text
__tests__/medea-drawer.test.tsx
```

Cover:

- new document enters loading state;
- ready source shows the server-derived filename;
- sending remains disabled while loading;
- sending remains disabled after load failure;
- there is no fallback to general chat after failure;
- switching documents clears stale source and conversation;
- late response from an old document is ignored;
- switching to general chat clears document state;
- saved-document POST uses the existing stream transport.

## Verification

```text
Targeted Task 2 tests
→ TypeScript
→ related Medea tests
→ full test suite
→ production build
→ browser acceptance
```

No deployment until all gates pass.

## Deployment

No database migration is currently expected.

Before deployment:

- verify production schema matches the inspected local schema;
- verify RLS for `documents` and `document_chunks`;
- verify the production retrieval function remains user/document scoped;
- run authenticated owner and cross-user acceptance checks.

Production must not be mutated during local Task 2 development.
