import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock('idb-keyval', () => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) }));

import OmniChatDrawer from "@/components/OmniChatDrawer";
import { useAppStore } from '@/lib/store';
import { MedeaLauncher } from '@/components/medea/MedeaLauncher';

function createUiMessageStreamResponse(
  text: string,
) {
  const textId =
    "assistant-text-1";

  const body = [
    {
      type:
        "start",
    },
    {
      type:
        "text-start",
      id:
        textId,
    },
    {
      type:
        "text-delta",
      id:
        textId,
      delta:
        text,
    },
    {
      type:
        "text-end",
      id:
        textId,
    },
    {
      type:
        "finish",
    },
  ]
    .map(
      (event) =>
        `data: ${JSON.stringify(event)}\n\n`,
    )
    .join("") +
    "data: [DONE]\n\n";

  return new Response(
    body,
    {
      status: 200,
      headers: {
        "Content-Type":
          "text/event-stream",
        "Cache-Control":
          "no-cache",
        Connection:
          "keep-alive",
        "x-vercel-ai-ui-message-stream":
          "v1",
        "x-accel-buffering":
          "no",
      },
    },
  );
}

describe("Medea drawer", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  beforeEach(() => {
    useAppStore.setState({ chatDrawerOpen: true, medeaRequest: null, activeChatContext: [] });
    sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('moves focus into the drawer and restores the launcher after Escape', async () => {
    useAppStore.setState({ chatDrawerOpen: false });
    render(<><MedeaLauncher source="topbar">Launch assistant</MedeaLauncher><OmniChatDrawer /></>);
    const launcher = screen.getByRole('button', { name: 'Launch assistant' });
    launcher.focus();
    fireEvent.click(launcher);
    const dialog = await screen.findByRole('dialog', { name: /Medea AI/i });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Medea AI/i })).toBeNull());
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
    expect(useAppStore.getState().medeaRequest).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it('keeps keyboard focus inside the open drawer', async () => {
    useAppStore.getState().openMedea({ source: 'dashboard', suggestedPrompt: 'Plan my studying' });
    render(<OmniChatDrawer />);
    const first = await screen.findByRole('button', { name: 'Close Medea AI' });
    const last = screen.getByRole('button', { name: 'Send question to Medea' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('keeps focus in Medea when switching away from a pending document', async () => {
    useAppStore.getState().openMedea({ source: 'study-hub', documentId: 'ethics-document' });
    render(<OmniChatDrawer />);
    const general = await screen.findByRole('button', { name: 'Open general Medea instead' });
    general.focus();
    fireEvent.click(general);
    expect(screen.queryByText(/document selected.*not loaded/i)).toBeNull();
    expect(screen.getByRole('dialog', { name: /Medea AI/i }).contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
  });

  it('prefills a suggestion exactly once without sending or loading a document', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useAppStore.getState().openMedea({ source: 'dashboard', suggestedPrompt: 'What should I study tonight?' });
    const { rerender } = render(<OmniChatDrawer />);
    const composer = await screen.findByRole('textbox', { name: 'Ask Medea a question' }) as HTMLTextAreaElement;
    expect(composer.value).toBe('What should I study tonight?');
    fireEvent.change(composer, { target: { value: 'My edited question' } });
    rerender(<OmniChatDrawer />);
    expect(composer.value).toBe('My edited question');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close Medea AI' }));
    expect(useAppStore.getState().medeaRequest).toBeNull();
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
  });

  it('labels document handoff as not loaded and never answers from stale context', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useAppStore.getState().openMedea({ source: 'study-hub', documentId: 'ethics-document', suggestedPrompt: 'Explain this' });
    render(<OmniChatDrawer />);
    expect(await screen.findByText(/document selected.*(?:not loaded|unavailable)/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send question to Medea' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Ask Medea a question' }), { key: 'Enter' });
    const postCalls = fetchMock.mock.calls.filter(
      ([url, options]) =>
        String(url) === "/api/chat" &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
    act(() => useAppStore.getState().openMedea({ source: 'topbar' }));
    expect(screen.queryByText(/document selected.*(?:not loaded|unavailable)/i)).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Ask Medea a question' }) as HTMLTextAreaElement).value).toBe('');
  });

  it(
    "loads saved-document metadata, blocks sending while pending, and enables the ready document with the server filename",
    async () => {
      const documentId =
        "22222222-2222-4222-8222-222222222222";

      let resolveMetadata:
        | ((value: Response) => void)
        | undefined;

      const metadataResponse =
        new Promise<Response>(
          (resolve) => {
            resolveMetadata = resolve;
          },
        );

      const fetchMock =
        vi.fn();

      fetchMock.mockReturnValueOnce(
        metadataResponse,
      );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,

        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092701,

          source:
            "study-hub",

          documentId,

          suggestedPrompt:
            "Explain this document",
        },
      });

      render(
        <OmniChatDrawer />,
      );

      /*
       * A saved-document launch should automatically
       * resolve safe server metadata.
       */
      await waitFor(() => {
        expect(
          fetchMock,
        ).toHaveBeenCalled();
      });

      const firstRequest =
        fetchMock.mock.calls[0][0];

      expect(
        String(firstRequest),
      ).toBe(
        `/api/chat?documentId=${documentId}`,
      );

      /*
       * The document is not usable while metadata
       * is unresolved.
       */
      expect(
        screen.getByRole("status", {
          name: "Loading document",
        }),
      ).toBeTruthy();

      expect(
        screen.queryByText(
          /using:\s*lecture-notes\.pdf/i,
        ),
      ).toBeNull();

      const sendButton =
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        );

      expect(
        (sendButton as HTMLButtonElement).disabled,
      ).toBe(true);

      /*
       * Resolve metadata using only the safe
       * server-derived response contract.
       */
      await act(
        async () => {
          resolveMetadata?.(
            new Response(
              JSON.stringify({
                documentId,

                fileName:
                  "lecture-notes.pdf",

                readiness:
                  "ready",
              }),
              {
                status: 200,

                headers: {
                  "Content-Type":
                    "application/json",

                  "Cache-Control":
                    "private, no-store",
                },
              },
            ),
          );
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /using:\s*lecture-notes\.pdf/i,
          ),
        ).toBeTruthy();
      });

      expect(
        screen.queryByText(
          /document selected.*not loaded/i,
        ),
      ).toBeNull();

      /*
       * The suggested prompt is non-empty, so only
       * document readiness should gate sending.
       */
      expect(
        (sendButton as HTMLButtonElement).disabled,
      ).toBe(false);
    },
  );

  it(
    "ignores stale saved-document metadata when a newer document launch wins the race",
    async () => {
      const documentA =
        "22222222-2222-4222-8222-222222222222";

      const documentB =
        "33333333-3333-4333-8333-333333333333";

      let resolveA:
        | ((response: Response) => void)
        | undefined;

      let resolveB:
        | ((response: Response) => void)
        | undefined;

      const metadataA =
        new Promise<Response>(
          (resolve) => {
            resolveA = resolve;
          },
        );

      const metadataB =
        new Promise<Response>(
          (resolve) => {
            resolveB = resolve;
          },
        );

      const fetchMock =
        vi.fn(
          (
            input: RequestInfo | URL,
          ) => {
            const url =
              String(input);

            if (
              url ===
              `/api/chat?documentId=${documentA}`
            ) {
              return metadataA;
            }

            if (
              url ===
              `/api/chat?documentId=${documentB}`
            ) {
              return metadataB;
            }

            throw new Error(
              `Unexpected fetch: ${url}`,
            );
          },
        );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092702,

          source:
            "study-hub",

          documentId:
            documentA,

          suggestedPrompt:
            "Explain document A",
        },
      });

      render(
        <OmniChatDrawer />,
      );

      await waitFor(() => {
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          `/api/chat?documentId=${documentA}`,
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      /*
       * Launch document B before A's metadata
       * request resolves.
       */
      act(() => {
        useAppStore.setState({
          medeaRequest: {
            nonce:
              2026092703,

            source:
              "study-hub",

            documentId:
              documentB,

            suggestedPrompt:
              "Explain document B",
          },
        });
      });

      await waitFor(() => {
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          `/api/chat?documentId=${documentB}`,
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      /*
       * B resolves first and becomes the active
       * document source.
       */
      await act(
        async () => {
          resolveB?.(
            new Response(
              JSON.stringify({
                documentId:
                  documentB,

                fileName:
                  "document-b.pdf",

                readiness:
                  "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            ),
          );
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /using:\s*document-b\.pdf/i,
          ),
        ).toBeTruthy();
      });

      /*
       * Now the older A request resolves late.
       * It must not replace, clear, or downgrade
       * document B's metadata.
       */
      await act(
        async () => {
          resolveA?.(
            new Response(
              JSON.stringify({
                documentId:
                  documentA,

                fileName:
                  "document-a.pdf",

                readiness:
                  "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            ),
          );
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /using:\s*document-b\.pdf/i,
          ),
        ).toBeTruthy();
      });

      expect(
        screen.queryByText(
          /using:\s*document-a\.pdf/i,
        ),
      ).toBeNull();

      /*
       * A late stale result must also not put the
       * currently-ready B document back into a
       * blocked/pending state.
       */
      const sendButton =
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        );

      expect(
        (sendButton as HTMLButtonElement).disabled,
      ).toBe(false);
    },
  );

  it(
    "clears the visible document conversation immediately when switching to a different saved document",
    async () => {
      const documentA =
        "22222222-2222-4222-8222-222222222222";

      const documentB =
        "33333333-3333-4333-8333-333333333333";

      let resolveDocumentB:
        | ((response: Response) => void)
        | undefined;

      const documentBMetadata =
        new Promise<Response>(
          (resolve) => {
            resolveDocumentB = resolve;
          },
        );

      const fetchMock =
        vi.fn(
          (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            const url =
              String(input);

            if (
              url ===
                `/api/chat?documentId=${documentA}` &&
              init?.method === "GET"
            ) {
              return Promise.resolve(
                new Response(
                  JSON.stringify({
                    documentId:
                      documentA,

                    fileName:
                      "document-a.pdf",

                    readiness:
                      "ready",
                  }),
                  {
                    status: 200,
                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                  },
                ),
              );
            }

            if (
              url ===
                `/api/chat?documentId=${documentB}` &&
              init?.method === "GET"
            ) {
              return documentBMetadata;
            }

            if (
              url === "/api/chat" &&
              init?.method === "POST"
            ) {
              return Promise.resolve(
                createUiMessageStreamResponse(
                  "A response from Medea",
                ),
              );
            }

            throw new Error(
              `Unexpected fetch: ${url} ${init?.method ?? ""}`,
            );
          },
        );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092721,

          source:
            "study-hub",

          documentId:
            documentA,
        },
      });

      render(
        <OmniChatDrawer />,
      );

      /*
       * Document A must become ready before we can
       * create a document-scoped visible chat turn.
       */
      await screen.findByText(
        /using:\s*document-a\.pdf/i,
      );

      const input =
        screen.getByRole(
          "textbox",
          {
            name:
              "Ask Medea a question",
          },
        );

      const sendButton =
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        );

      fireEvent.change(
        input,
        {
          target: {
            value:
              "Question only for document A",
          },
        },
      );

      fireEvent.click(
        sendButton,
      );

      /*
       * Prove both halves of A's visible turn
       * exist before switching document identity.
       */
      await screen.findByText(
        "Question only for document A",
      );

      await screen.findByText(
        "A response from Medea",
      );

      /*
       * Switch to B, but deliberately leave B's
       * metadata unresolved.
       *
       * Conversation clearing must happen because
       * document identity changed — it must not wait
       * for B to become ready.
       */
      act(() => {
        useAppStore.setState({
          medeaRequest: {
            nonce:
              2026092722,

            source:
              "study-hub",

            documentId:
              documentB,
          },
        });
      });

      await waitFor(() => {
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          `/api/chat?documentId=${documentB}`,
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      expect(
        screen.queryByText(
          "Question only for document A",
        ),
      ).toBeNull();

      expect(
        screen.queryByText(
          "A response from Medea",
        ),
      ).toBeNull();

      /*
       * B is still unresolved. This confirms the
       * old conversation was cleared on source
       * transition rather than as a side effect of
       * successful B metadata loading.
       */
      expect(
        screen.queryByText(
          /using:\s*document-b\.pdf/i,
        ),
      ).toBeNull();

      /*
       * Resolve the deferred request so the test
       * leaves no pending metadata work behind.
       */
      await act(
        async () => {
          resolveDocumentB?.(
            new Response(
              JSON.stringify({
                documentId:
                  documentB,

                fileName:
                  "document-b.pdf",

                readiness:
                  "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            ),
          );
        },
      );
    },
  );

  it(
    "does not rehydrate the previous document assistant message after sending in the new document",
    async () => {
      const documentA =
        "22222222-2222-4222-8222-222222222222";

      const documentB =
        "33333333-3333-4333-8333-333333333333";

      let postCount = 0;

      const fetchMock = vi.fn(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => {
          const url = String(input);

          if (
            url ===
              `/api/chat?documentId=${documentA}` &&
            init?.method === "GET"
          ) {
            return new Response(
              JSON.stringify({
                documentId: documentA,
                fileName: "document-a.pdf",
                readiness: "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            );
          }

          if (
            url ===
              `/api/chat?documentId=${documentB}` &&
            init?.method === "GET"
          ) {
            return new Response(
              JSON.stringify({
                documentId: documentB,
                fileName: "document-b.pdf",
                readiness: "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            );
          }

          if (
            url === "/api/chat" &&
            init?.method === "POST"
          ) {
            postCount += 1;

            return createUiMessageStreamResponse(
              postCount === 1
                ? "Answer from document A"
                : "Answer from document B",
            );
          }

          throw new Error(
            `Unexpected fetch: ${url} ${init?.method ?? ""}`,
          );
        },
      );

      vi.stubGlobal("fetch", fetchMock);

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],
        medeaRequest: {
          nonce: 1,
          source: "study-hub",
          documentId: documentA,
        },
      });

      render(<OmniChatDrawer />);

      await screen.findByText(
        /using:\s*document-a\.pdf/i,
      );

      const input = screen.getByRole(
        "textbox",
        {
          name: "Ask Medea a question",
        },
      );

      fireEvent.change(input, {
        target: {
          value: "Question for A",
        },
      });

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name: "Send question to Medea",
          },
        ),
      );

      await screen.findByText(
        "Answer from document A",
      );

      act(() => {
        useAppStore.setState({
          medeaRequest: {
            nonce: 2,
            source: "study-hub",
            documentId: documentB,
          },
        });
      });

      await screen.findByText(
        /using:\s*document-b\.pdf/i,
      );

      await waitFor(() => {
        expect(
          screen.queryByText(
            "Answer from document A",
          ),
        ).toBeNull();
      });

      fireEvent.change(input, {
        target: {
          value: "Question for B",
        },
      });

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name: "Send question to Medea",
          },
        ),
      );

      await screen.findByText(
        "Answer from document B",
      );

      /*
       * Changing the SDK message array for B must
       * never mirror A's answer back into B's chat.
       */
      expect(
        screen.queryByText(
          "Answer from document A",
        ),
      ).toBeNull();
    },
  );

  it(
    "clears document-scoped conversation and metadata when switching to explicit general Medea",
    async () => {
      const documentId =
        "22222222-2222-4222-8222-222222222222";

      const fetchMock =
        vi.fn(
          (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            const url =
              String(input);

            if (
              url ===
                `/api/chat?documentId=${documentId}` &&
              init?.method === "GET"
            ) {
              return Promise.resolve(
                new Response(
                  JSON.stringify({
                    documentId,
                    fileName:
                      "document-a.pdf",
                    readiness:
                      "ready",
                  }),
                  {
                    status: 200,
                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                  },
                ),
              );
            }

            if (
              url === "/api/chat" &&
              init?.method === "POST"
            ) {
              return Promise.resolve(
                createUiMessageStreamResponse(
                  "Document A answer",
                ),
              );
            }

            throw new Error(
              `Unexpected fetch: ${url} ${init?.method ?? ""}`,
            );
          },
        );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092723,

          source:
            "study-hub",

          documentId,
        },
      });

      render(
        <OmniChatDrawer />,
      );

      /*
       * Establish an active, ready saved-document
       * source first.
       */
      await screen.findByText(
        /using:\s*document-a\.pdf/i,
      );

      const input =
        screen.getByRole(
          "textbox",
          {
            name:
              "Ask Medea a question",
          },
        );

      const sendButton =
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        );

      fireEvent.change(
        input,
        {
          target: {
            value:
              "Question scoped to document A",
          },
        },
      );

      fireEvent.click(
        sendButton,
      );

      await screen.findByText(
        "Question scoped to document A",
      );

      await screen.findByText(
        "Document A answer",
      );

      /*
       * Explicit general Medea is represented by
       * a request with no documentId.
       */
      act(() => {
        useAppStore.setState({
          medeaRequest: {
            nonce:
              2026092724,

            source:
              "legacy",
          },
        });
      });

      /*
       * The old saved-document source must disappear.
       */
      await waitFor(() => {
        expect(
          screen.queryByText(
            /using:\s*document-a\.pdf/i,
          ),
        ).toBeNull();
      });

      /*
       * Document A's visible conversation must not
       * carry into general chat.
       */
      await waitFor(() => {
        expect(
          screen.queryByText(
            "Question scoped to document A",
          ),
        ).toBeNull();
      });

      expect(
        screen.queryByText(
          "Document A answer",
        ),
      ).toBeNull();

      /*
       * Switching to general chat must not trigger
       * another saved-document metadata request.
       */
      const metadataGets =
        fetchMock.mock.calls.filter(
          ([url, options]) =>
            String(url).startsWith(
              "/api/chat?documentId=",
            ) &&
            (
              options as
                | RequestInit
                | undefined
            )?.method === "GET",
        );

      expect(
        metadataGets,
      ).toHaveLength(1);
    },
  );

  it.each([
    [
      "processing",
      new Response(
        JSON.stringify({
          documentId:
            "22222222-2222-4222-8222-222222222222",
          fileName:
            "processing.pdf",
          readiness:
            "processing",
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        },
      ),
    ],

    [
      "failed",
      new Response(
        JSON.stringify({
          documentId:
            "22222222-2222-4222-8222-222222222222",
          fileName:
            "failed.pdf",
          readiness:
            "failed",
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        },
      ),
    ],

    [
      "metadata error",
      new Response(
        JSON.stringify({
          error:
            "DOCUMENT_SOURCE_UNAVAILABLE",
        }),
        {
          status: 503,
          headers: {
            "Content-Type":
              "application/json",
          },
        },
      ),
    ],
  ])(
    "does not fall back to general chat when saved-document metadata is %s",
    async (
      _state,
      metadataResponse,
    ) => {
      const documentId =
        "22222222-2222-4222-8222-222222222222";

      const fetchMock =
        vi.fn(
          (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            const url =
              String(input);

            if (
              url ===
                `/api/chat?documentId=${documentId}` &&
              init?.method === "GET"
            ) {
              return Promise.resolve(
                metadataResponse.clone(),
              );
            }

            if (
              url === "/api/chat" &&
              init?.method === "POST"
            ) {
              throw new Error(
                "Saved-document mode must not fall back to general POST",
              );
            }

            throw new Error(
              `Unexpected fetch: ${url} ${init?.method ?? ""}`,
            );
          },
        );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092725,

          source:
            "study-hub",

          documentId,

          suggestedPrompt:
            "Explain this document",
        },
      });

      render(
        <OmniChatDrawer />,
      );

      /*
       * Wait until the metadata request has resolved.
       */
      await waitFor(() => {
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          `/api/chat?documentId=${documentId}`,
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      const input =
        screen.getByRole(
          "textbox",
          {
            name:
              "Ask Medea a question",
          },
        );

      const sendButton =
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        );

      /*
       * A saved document is usable only when the
       * server explicitly reports readiness: ready.
       */
      await waitFor(() => {
        expect(
          (sendButton as HTMLButtonElement).disabled,
        ).toBe(true);
      });

      expect(
        screen.queryByText(
          /using:/i,
        ),
      ).toBeNull();

      /*
       * Exercise both keyboard and button paths.
       * Neither may silently route this request
       * through general Medea.
       */
      fireEvent.keyDown(
        input,
        {
          key: "Enter",
          code: "Enter",
        },
      );

      fireEvent.click(
        sendButton,
      );

      const postCalls =
        fetchMock.mock.calls.filter(
          ([url, options]) =>
            String(url) ===
              "/api/chat" &&
            (
              options as
                | RequestInit
                | undefined
            )?.method === "POST",
        );

      expect(
        postCalls,
      ).toHaveLength(0);
    },
  );

  it(
    "renders streamed assistant text for a ready saved document",
    async () => {
      const documentId =
        "22222222-2222-4222-8222-222222222222";

      const fetchMock =
        vi.fn(
          async (
            input:
              | RequestInfo
              | URL,
            init?:
              RequestInit,
          ) => {
            const url =
              String(input);

            if (
              url ===
                `/api/chat?documentId=${documentId}` &&
              init?.method ===
                "GET"
            ) {
              return new Response(
                JSON.stringify({
                  documentId,
                  fileName:
                    "lecture-notes.pdf",
                  readiness:
                    "ready",
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                },
              );
            }

            if (
              url ===
                "/api/chat" &&
              init?.method ===
                "POST"
            ) {
              return createUiMessageStreamResponse(
                "A streamed Medea answer",
              );
            }

            throw new Error(
              `Unexpected fetch: ${url} ${init?.method ?? ""}`,
            );
          },
        );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen:
          true,
        activeChatContext:
          [],
        medeaRequest: {
          nonce:
            2026092726,
          source:
            "study-hub",
          documentId,
        },
      });

      render(
        <OmniChatDrawer />,
      );

      await screen.findByText(
        /using:\s*lecture-notes\.pdf/i,
      );

      const input =
        screen.getByRole(
          "textbox",
          {
            name:
              "Ask Medea a question",
          },
        );

      fireEvent.change(
        input,
        {
          target: {
            value:
              "Explain this section",
          },
        },
      );

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        ),
      );

      await screen.findByText(
        "Explain this section",
      );

      await screen.findByText(
        "A streamed Medea answer",
      );
    },
  );

  it(
    "sends a ready saved-document question with only the saved-document request contract",
    async () => {
      const documentId =
        "22222222-2222-4222-8222-222222222222";

      let capturedPostBody:
        Record<string, unknown> | null =
        null;

      const fetchMock = vi.fn(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => {
          const url =
            String(input);

          if (
            url ===
              `/api/chat?documentId=${documentId}` &&
            init?.method === "GET"
          ) {
            return new Response(
              JSON.stringify({
                documentId,
                fileName:
                  "lecture-notes.pdf",
                readiness:
                  "ready",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            );
          }

          if (
            url === "/api/chat" &&
            init?.method === "POST"
          ) {
            capturedPostBody =
              JSON.parse(
                String(
                  init.body,
                ),
              );

            /*
             * The response contents are not the
             * behavior under test yet. We only need
             * the request boundary to be observable.
             */
            return new Response(
              JSON.stringify({
                content:
                  "Temporary test response",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type":
                    "application/json",
                },
              },
            );
          }

          throw new Error(
            `Unexpected fetch: ${url} ${init?.method ?? ""}`,
          );
        },
      );

      vi.stubGlobal(
        "fetch",
        fetchMock,
      );

      useAppStore.setState({
        chatDrawerOpen: true,
        activeChatContext: [],

        medeaRequest: {
          nonce:
            2026092727,

          source:
            "study-hub",

          documentId,
        },
      });

      render(
        <OmniChatDrawer />,
      );

      await screen.findByText(
        /using:\s*lecture-notes\.pdf/i,
      );

      const input =
        screen.getByRole(
          "textbox",
          {
            name:
              "Ask Medea a question",
          },
        );

      fireEvent.change(
        input,
        {
          target: {
            value:
              "Explain the key idea",
          },
        },
      );

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name:
              "Send question to Medea",
          },
        ),
      );

      await waitFor(() => {
        expect(
          capturedPostBody,
        ).not.toBeNull();
      });

      expect(
        capturedPostBody,
      ).toEqual({
        documentId,
        message:
          "Explain the key idea",

        /*
         * UUID value is generated client-side.
         */
        requestId:
          expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
      });

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "documentContext",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "messages",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "sourceScopedHistory",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "userId",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "fileName",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "chunks",
      );

      expect(
        capturedPostBody,
      ).not.toHaveProperty(
        "extractedText",
      );
    },
  );

  it("shows one unified Medea AI experience without separate mode tabs", async () => {
    render(<OmniChatDrawer />);

    expect(await screen.findByText("Medea AI", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("One assistant for every subject")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tutor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Socratic" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dictionary" })).toBeNull();
  });
});
