"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  

type ChatResponse = {
  message: string;
  intent: string;
  confidence: number;
  request_id?: string | null;
  status?: string | null;
  conversation_id?: string | null;
};

type Conversation = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type StoredChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  message_type: string;
  intent: string | null;
  ai_confidence: number | null;
  request_id: string | null;
  created_at: string;
};

type ConversationDetail = Conversation & {
  messages: StoredChatMessage[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
};

function getRequestStatusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200";
    case "REJECTED":
      return "border-rose-300/15 bg-rose-300/[0.06] text-rose-200";
    case "PROCESSING":
      return "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-100";
    case "APPROVAL_REQUIRED":
      return "border-amber-300/15 bg-amber-300/[0.06] text-amber-200";
    default:
      return "border-white/[0.07] bg-white/[0.025] text-white/45";
  }
}

export default function AskNexusPage() {
  const router = useRouter();
  const [initialMessage, setInitialMessage] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const initialMessageConsumedRef = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null
  );
  const newChatRef = useRef(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: "end",
      });
    });
  }

  function formatConversationDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function storedMessagesToChatMessages(
    storedMessages: StoredChatMessage[]
  ): ChatMessage[] {
    return storedMessages.map((item) => ({
      id: item.id,
      role: item.role === "USER" ? "user" : "assistant",
      content: item.content,
      response:
        item.role === "ASSISTANT"
          ? {
              message: item.content,
              intent: item.intent ?? "UNKNOWN",
              confidence: item.ai_confidence ?? 0,
              request_id: item.request_id,
              status: null,
            }
          : undefined,
    }));
  }

  async function loadConversations(token: string) {
    setHistoryLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/nexus/conversations`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Unable to load NEXUS conversations.");
      }

      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (error) {
      console.error("Failed to load NEXUS conversations:", error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openConversation(
    conversationId: string,
    token?: string
  ) {
    const accessToken =
      token ?? localStorage.getItem("access_token");

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    newChatRef.current = false;
    setSelectedConversationId(conversationId);
    setConversationLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/nexus/conversations/${conversationId}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Unable to load this conversation.");
      }

      const data: ConversationDetail = await res.json();

      setMessages(storedMessagesToChatMessages(data.messages));

      // Keep the history sidebar open on desktop.
      // Close it only on smaller/mobile screens.
      if (window.innerWidth < 1024) {
        setHistoryOpen(false);
      }

      // Wait for the message list and bottom composer to render, then
      // scroll the conversation to the real visual bottom.
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });

        textareaRef.current?.focus();
      }, 150);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setConversationLoading(false);
    }
  }

  function startNewConversation() {
    // Set the ref synchronously so the next message can NEVER be sent
    // into the previously selected conversation.
    newChatRef.current = true;
    setSelectedConversationId(null);
    setMessages([]);
    setInput("");
    setHistoryOpen(false);

    window.setTimeout(() => textareaRef.current?.focus(), 100);
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    void loadConversations(token);

    const params = new URLSearchParams(window.location.search);
    const messageFromUrl = params.get("message")?.trim() ?? "";

    setInitialMessage(messageFromUrl);

    if (
      messageFromUrl &&
      !initialized &&
      !initialMessageConsumedRef.current
    ) {
      initialMessageConsumedRef.current = true;
      newChatRef.current = true;
      setInitialized(true);

      // Consume the dashboard hand-off URL immediately so a remount,
      // Strict Mode effect replay, or browser restoration cannot submit
      // the same message a second time.
      window.history.replaceState({}, "", "/ask-nexus");

      void sendToNexus(messageFromUrl);
    } else if (!messageFromUrl) {
      if (!selectedConversationId) {
        newChatRef.current = true;
      }

      setInitialized(true);
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    }
    // Initial query parameter is intentionally processed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, router]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    // Wait until the DOM has painted the latest messages so the
    // scroll reaches the actual bottom of the conversation viewport.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    });
  }, [messages, sending]);

  async function sendToNexus(text: string) {
    const cleanText = text.trim();

    if (!cleanText || sending) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: cleanText,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: cleanText,
          // Use the ref so clicking "+ New chat" takes effect immediately,
          // even before React finishes the state update.
          conversation_id: newChatRef.current
            ? null
            : selectedConversationId,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }

      if (!res.ok) {
        throw new Error(
          data?.detail || "NEXUS could not process your request."
        );
      }

      const response: ChatResponse = data;

      if (response.conversation_id) {
        setSelectedConversationId(response.conversation_id);
        newChatRef.current = false;
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: response.message,
          response,
        },
      ]);

      void loadConversations(token);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Unable to connect to NEXUS.",
        },
      ]);
    } finally {
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendToNexus(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendToNexus(input);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1050px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] text-white/50 transition hover:bg-white/[0.04] hover:text-white lg:hidden"
              aria-label="Open conversation history"
            >
              <Clock3 size={16} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.035]"
            >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
              <Sparkles size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold">Ask NEXUS</p>
              <p className="text-[9px] uppercase tracking-[0.22em] text-white/30">
                University OS
              </p>
            </div>
          </button>

          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white"
          >
            <ArrowLeft size={14} />
            Dashboard
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-76px)] w-full min-h-0 overflow-hidden">
        {historyOpen && (
        <button
          type="button"
          aria-label="Close conversation history"
          onClick={() => setHistoryOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-[76px] z-50 w-[300px] border-r border-white/[0.06] bg-[#090c11] transition-transform duration-200 lg:static lg:z-20 lg:block lg:h-full lg:w-[260px] lg:shrink-0 lg:translate-x-0 ${
          historyOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
            <div>
              <p className="text-xs font-semibold text-white/80">
                Conversations
              </p>
              <p className="mt-1 text-[10px] text-white/25">
                Your NEXUS history
              </p>
            </div>

            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white"
            >
              + New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {historyLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-white/30">
                <Loader2 size={13} className="animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-white/35">
                  No previous conversations.
                </p>
                <p className="mt-1 text-[10px] leading-5 text-white/20">
                  Your NEXUS conversations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => {
                  const active =
                    selectedConversationId === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => void openConversation(conversation.id)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        active
                          ? "border border-cyan-300/[0.12] bg-cyan-300/[0.055]"
                          : "border border-transparent hover:bg-white/[0.035]"
                      }`}
                    >
                      <p className="truncate text-xs font-medium text-white/75">
                        {conversation.title || "NEXUS Conversation"}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-white/25">
                          {formatConversationDate(conversation.updated_at)}
                        </span>

                        <span className="text-[9px] uppercase tracking-wide text-white/20">
                          {conversation.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-5 sm:px-8">
        <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-6 sm:py-8">
            {conversationLoading ? (
              <div className="flex min-h-[55vh] items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-white/30">
                <Loader2 size={15} className="animate-spin" />
                Loading conversation...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-lg shadow-cyan-500/10">
                <Sparkles size={24} />
              </div>

              <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
                How can NEXUS help?
              </h1>

              <p className="mt-3 max-w-lg text-sm leading-6 text-white/35">
                Ask about university services, requests, receipts,
                certificates, transcripts, ID cards, and more.
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[860px] space-y-7 px-4 sm:px-8">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.role === "user"
                      ? "flex justify-end"
                      : "flex items-start gap-3"
                  }
                >
                  {item.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div
                    className={
                      item.role === "user"
                        ? "max-w-[82%] rounded-2xl rounded-br-md border border-cyan-300/[0.12] bg-cyan-300/[0.055] px-4 py-3 text-sm leading-6 text-white/85"
                        : "min-w-0 max-w-[82%]"
                    }
                  >
                    {item.role === "assistant" && (
                      <p className="mb-2 text-xs font-semibold text-white/80">
                        NEXUS
                      </p>
                    )}

                    <p className="whitespace-pre-wrap text-sm leading-6 text-white/65">
                      {item.content}
                    </p>

                    {item.response &&
                      item.response.intent !== "ERROR" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] text-white/25">
                            Intent: {item.response.intent}
                          </span>
                          <span className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] text-white/25">
                            Confidence:{" "}
                            {(item.response.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                    {item.response?.request_id &&
                      item.response.status !== "ERROR" && (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/requests/${item.response?.request_id}`
                            )
                          }
                          className="group mt-4 w-full overflow-hidden rounded-2xl border border-cyan-300/[0.14] bg-gradient-to-br from-cyan-300/[0.055] via-blue-400/[0.035] to-violet-400/[0.055] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/[0.28] hover:bg-cyan-300/[0.07]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200">
                              <CheckCircle2 size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white/90">
                                  Request created successfully
                                </p>

                                {item.response.status && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${getRequestStatusClass(
                                      item.response.status
                                    )}`}
                                  >
                                    {item.response.status.replaceAll(
                                      "_",
                                      " "
                                    )}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-xs text-white/40">
                                Your request has been added to your NEXUS
                                requests.
                              </p>

                              <p className="mt-2 truncate font-mono text-[10px] text-white/25">
                                {item.response.request_id}
                              </p>
                            </div>

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/25 transition group-hover:border-cyan-300/15 group-hover:bg-cyan-300/[0.06] group-hover:text-cyan-100/70">
                              <ChevronRight size={15} />
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-medium text-cyan-100/45 transition group-hover:text-cyan-100/75">
                            View request
                            <ArrowUpRight size={12} />
                          </div>
                        </button>
                      )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                    <Sparkles size={16} />
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-xs text-white/35">
                    <Loader2 size={14} className="animate-spin" />
                    NEXUS is thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
            )}
          </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/[0.05] bg-[#07090d]/92 px-0 pb-4 pt-3 backdrop-blur-xl sm:pb-6">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-[calc(100%-32px)] max-w-[760px] items-end gap-2 rounded-[28px] border border-white/[0.10] bg-[#0b0e13]/98 px-3 py-2.5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:w-[calc(100%-56px)]"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || conversationLoading}
              placeholder="Message NEXUS..."
              rows={1}
              className="max-h-[180px] min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/20 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={sending || conversationLoading || !input.trim()}
              aria-label="Send message"
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </form>

          <p className="mx-auto mt-2 w-[calc(100%-32px)] max-w-[760px] px-2 text-center text-[9px] text-white/15 sm:w-[calc(100%-56px)]">
            Enter to send • Shift + Enter for a new line
          </p>
        </div>
        </div>
      </section>
      </div>
    </main>
  );
}