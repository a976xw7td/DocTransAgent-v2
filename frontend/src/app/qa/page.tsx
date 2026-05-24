"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStreamingQA } from "@/hooks/useStreamingQA";

export default function QAPage() {
  const { t } = useTranslation();
  const { messages, isStreaming, ask, clearMessages } = useStreamingQA("demo");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    await ask(q);
  };

  const handleSample = (sample: string) => {
    setInput(sample);
    inputRef.current?.focus();
  };

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: "calc(100vh - 7rem)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {t("qa.page_title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {t("qa.page_subtitle")}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="btn-secondary text-xs"
            disabled={isStreaming}
          >
            {t("qa.clear_chat")}
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-lg"
              style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
            >
              ◎
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>
              {t("qa.empty_title")}
            </p>
            <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-muted)" }}>
              {t("qa.empty_desc")}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {[t("qa.sample_q1"), t("qa.sample_q2"), t("qa.sample_q3")].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSample(q)}
                  className="text-left px-4 py-3 rounded-lg text-sm transition-colors"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
                    style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
                  >
                    A
                  </div>
                )}
                <div
                  className="max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          background: "var(--primary)",
                          color: "oklch(99% 0.004 175)",
                          borderBottomRightRadius: "4px",
                        }
                      : {
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          borderBottomLeftRadius: "4px",
                        }
                  }
                >
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                  {msg.isLoading && (
                    <span className="inline-flex items-center gap-0.5 ml-2 align-middle">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-faint)" }} />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-faint)" }} />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-faint)" }} />
                    </span>
                  )}
                </div>
                {msg.role === "user" && (
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
                    style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                  >
                    U
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        id="qa-form"
        onSubmit={handleSubmit}
        className="mt-4 flex gap-3 items-center p-3 rounded-xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text)", fontFamily: "var(--font-sans)" }}
          placeholder={t("qa.input_placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="btn-primary text-sm"
          style={{ padding: "7px 16px" }}
        >
          {isStreaming ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              {t("qa.responding")}
            </>
          ) : t("common.send")}
        </button>
      </form>
    </div>
  );
}
