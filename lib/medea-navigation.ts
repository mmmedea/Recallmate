export type MedeaOpenSource =
  | "topbar"
  | "sidebar"
  | "mobile-fab"
  | "dashboard"
  | "topics"
  | "study-hub"
  | "review"
  | "notes"
  | "quiz"
  | "legacy";

export interface MedeaOpenOptions {
  documentId?: string;
  source?: MedeaOpenSource;
  suggestedPrompt?: string;
}

export interface MedeaRequest extends MedeaOpenOptions {
  nonce: number;
}

let lastNonce = 0;

function nextNonce() {
  lastNonce = Math.max(Date.now(), lastNonce + 1);
  return lastNonce;
}

/**
 * Creates a normalized request for opening Medea.
 *
 * Important:
 * - documentId is optional
 * - empty strings are removed
 * - every request gets a new nonce
 * - document content is NEVER stored here
 */
export function createMedeaRequest(
  options: MedeaOpenOptions = {},
  nonce: number = nextNonce(),
): MedeaRequest {
  const documentId = options.documentId?.trim();
  const suggestedPrompt = options.suggestedPrompt?.trim();

  return {
    ...(documentId ? { documentId } : {}),
    ...(options.source ? { source: options.source } : {}),
    ...(suggestedPrompt ? { suggestedPrompt } : {}),
    nonce,
  };
}

/** Compatibility only: new in-app controls use MedeaLauncher/openMedea. */
export function medeaHref(documentId?: string | null) {
  const id = documentId?.trim();
  return id ? `/chat?documentId=${encodeURIComponent(id)}` : '/dashboard?medea=1';
}
