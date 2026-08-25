"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, SendHorizonal } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string; confirm?: { label: string; command: string } | null };

const WELCOME: Msg = {
  role: "ai",
  text:
    "Hi! I'm the **WorshipFlow Assistant** 🎵\n\nTry:\n• \"Create this Sunday's worship service\"\n• \"Give me five worship songs about God's faithfulness\"\n• \"Schedule the worship team for September\"\n• \"Check for conflicts\"",
};

function renderText(text: string) {
  return text.split("\n").map((line, i) => (
    <p key={i} className={line.startsWith("•") ? "pl-2" : ""}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{part}</span>
        )
      )}
    </p>
  ));
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  async function send(text: string, confirmCommand?: string) {
    if (!text.trim() && !confirmCommand) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, confirmCommand }),
      });
      const json = await res.json();
      setMessages((m) => [...m, { role: "ai", text: json.reply || "…", confirm: json.confirm || null }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Sorry — something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open WorshipFlow Assistant"
        className="fixed bottom-24 right-4 z-[75] flex h-13 w-13 items-center justify-center rounded-full bg-gold-500 p-3.5 text-white shadow-pop transition hover:bg-gold-600 lg:bottom-6 lg:right-6 no-print"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-end bg-ink/30 p-0 backdrop-blur-sm sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-label="WorshipFlow Assistant"
            className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:h-[32rem] sm:w-[26rem] sm:rounded-3xl"
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-brand-800 to-brand-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">WorshipFlow Assistant</p>
                  <p className="text-[11px] text-brand-100/80">Service & scheduling copilot</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-brand-700 text-white" : "card text-ink"
                    }`}
                  >
                    {renderText(m.text)}
                    {m.confirm && (
                      <button
                        type="button"
                        onClick={() => send(m.confirm!.label, m.confirm!.command)}
                        disabled={busy}
                        className="btn-gold btn-sm mt-3"
                      >
                        {m.confirm.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="card flex gap-1 px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300 [animation-delay:240ms]" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              className="flex items-center gap-2 border-t border-line bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your services…"
                aria-label="Message the assistant"
                className="input"
                disabled={busy}
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="btn-primary shrink-0 p-2.5">
                <SendHorizonal className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
