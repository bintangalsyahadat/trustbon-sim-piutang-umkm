"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";

const emptySubscribe = () => () => {};

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const WELCOME_MESSAGE = {
  role: "model",
  content:
    "Halo! Saya Asisten TrustBon. Tanya apa saja tentang data piutang dan pelanggan Anda.",
};

const ERROR_MESSAGE = {
  role: "model",
  content: "Maaf, terjadi kesalahan. Coba lagi.",
};

const USER_BUBBLE =
  "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-violet-500 text-white rounded-2xl rounded-br-md shadow-sm";

const MODEL_BUBBLE =
  "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-2xl rounded-bl-md";

/**
 * Three bouncing dots shown in an assistant bubble while /api/chat is pending.
 */
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div
        role="status"
        aria-label="Asisten sedang mengetik"
        className={`${MODEL_BUBBLE} flex items-center gap-1.5`}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Floating TrustBon AI chat widget.
 *
 * Renders a violet gradient FAB in the bottom-right corner that opens a
 * glassmorphism chat panel above it. Both live in a body portal (like
 * MobileNav) so no ancestor backdrop-filter can break the fixed positioning.
 * While the panel is open, background scroll is locked and Escape closes it.
 *
 * Conversation is posted to /api/chat as { messages } in Gemini role format
 * ("user" | "model") and the API answers { reply }. Any failure degrades to
 * an in-thread error bubble — the widget never crashes.
 */
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Lock background scroll and close on Escape while the panel is open
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Keep the newest message in view
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isLoading, isOpen]);

  // Focus the composer when the panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const reply =
        typeof json?.reply === "string" && json.reply.trim().length > 0
          ? json.reply
          : ERROR_MESSAGE.content;
      setMessages((prev) => [...prev, { role: "model", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, ERROR_MESSAGE]);
    } finally {
      setIsLoading(false);
    }
  }

  function onComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Tutup asisten chat" : "Buka asisten chat"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:scale-105 hover:shadow-xl hover:shadow-violet-500/40 active:scale-95 transition-all duration-200 cursor-pointer ${FOCUS_RING}`}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Asisten TrustBon"
        inert={!isOpen}
        className={`fixed bottom-24 right-6 z-50 flex flex-col w-[380px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100dvh-8rem)] overflow-hidden bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl origin-bottom-right transition-all duration-200 ease-out ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100"
            : "pointer-events-none opacity-0 translate-y-4 scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/40 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Asisten TrustBon
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              Tanya seputar piutang &amp; pelanggan
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup asisten"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 ${FOCUS_RING}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          aria-live="polite"
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={
                  message.role === "user" ? USER_BUBBLE : MODEL_BUBBLE
                }
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading ? <TypingDots /> : null}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-white/40 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onComposerKeyDown}
              rows={1}
              placeholder="Tulis pesan…"
              aria-label="Tulis pesan"
              className={`flex-1 resize-none bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${FOCUS_RING}`}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Kirim pesan"
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/30 hover:scale-105 hover:shadow-lg hover:shadow-violet-500/40 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:hover:scale-105 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer shrink-0 ${FOCUS_RING}`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            Enter untuk kirim · Shift+Enter untuk baris baru
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
