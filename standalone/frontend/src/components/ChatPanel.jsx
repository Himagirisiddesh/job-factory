import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ClipboardList, Loader2, Send, Verified } from "lucide-react";
import api from "../api";

const SUGGESTIONS = [
  "I need 300 titanium brackets by July 12",
  "I need 200 steel bearings by August 4",
  "I need 100 aluminum rods by June 25",
  "Show my orders",
];

export default function ChatPanel({ pendingDrafts = [], onDataChanged, onToast, onSessionExpired }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I am your manufacturing assistant. I can only create orders for products available in inventory, validate stock, and generate verification codes.",
      timestamp: new Date().toISOString(),
      entities: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const bottomRef = useRef(null);

  const activeDraft = useMemo(() => {
    const fallback = pendingDrafts[0] || null;
    return pendingDrafts.find((draft) => String(draft.id) === String(selectedDraftId)) || fallback;
  }, [pendingDrafts, selectedDraftId]);

  useEffect(() => {
    if (activeDraft) {
      setSelectedDraftId(String(activeDraft.id));
    } else {
      setSelectedDraftId("");
      setVerificationCode("");
    }
  }, [activeDraft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, confirming]);

  const appendMessage = (message) => {
    setMessages((current) => [...current, message]);
  };

  const handleSend = async (rawMessage) => {
    const message = (rawMessage || input).trim();
    if (!message || loading) return;
    setInput("");

    appendMessage({
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      entities: null,
    });

    setLoading(true);
    try {
      const { data } = await api.post("/chat", { message });
      appendMessage({
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        entities: data.extractedEntities || null,
      });

      if (["verification_required", "order_confirmed", "stock_exceeded"].includes(data.action)) {
        onDataChanged?.();
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onSessionExpired?.();
        return;
      }
      onToast?.("Unable to process chat request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!activeDraft || !verificationCode.trim()) return;
    setConfirming(true);
    try {
      const { data } = await api.post("/orders/confirm", {
        draftId: activeDraft.id,
        verificationCode: verificationCode.trim().toUpperCase(),
      });
      appendMessage({
        id: `${Date.now()}-confirm`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        entities: data.order
          ? {
              orderId: data.order.orderId,
              productName: data.order.productName,
              quantity: data.order.quantity,
              status: data.order.status,
            }
          : null,
      });
      setVerificationCode("");
      onDataChanged?.();
      onToast?.("Order confirmed and inventory updated.", "success");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onSessionExpired?.();
        return;
      }
      onToast?.(requestError.response?.data?.error || "Invalid verification code.", "error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="relative rounded-[32px] border border-cyan-300/20 bg-white/5 shadow-[0_20px_64px_rgba(6,182,212,0.12)] backdrop-blur">
      <div className="border-b border-cyan-300/20 bg-slate-950/35 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
            <Bot size={18} className="text-cyan-200" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">AI Order Assistant</h2>
            <p className="mt-1 text-xs text-slate-400">Inventory-aware NLP order parsing and verification workflow.</p>
          </div>
        </div>
      </div>

      <div className="max-h-[48vh] overflow-y-auto px-4 py-5 md:max-h-[52vh]">
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, x: isUser ? 10 : -10 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-[24px] border px-4 py-3 ${
                    isUser ? "border-white/10 bg-white/10 text-white" : "border-cyan-300/20 bg-cyan-300/10 text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  {message.entities ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-xs text-slate-200">
                      {Object.entries(message.entities).map(([key, value]) => (
                        <div key={key} className="mb-1 flex justify-between gap-4">
                          <span className="text-slate-400">{key}</span>
                          <span className="text-right text-white">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {loading ? (
          <div className="mb-4 flex justify-start">
            <div className="flex items-center gap-2 rounded-[24px] border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-slate-200">
              <Loader2 size={14} className="animate-spin" />
              Validating inventory and parsing request...
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 border-t border-cyan-300/20 bg-slate-950/70 px-4 py-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSend(suggestion)}
              className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <ClipboardList size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe your manufacturing request..."
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex min-w-[52px] items-center justify-center rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
          >
            <Send size={15} />
          </button>
        </form>

        <div className="mt-4 rounded-[24px] border border-cyan-300/20 bg-cyan-300/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            <Verified size={12} />
            Verification
          </div>
          {activeDraft ? (
            <>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">{activeDraft.requestId}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {activeDraft.quantity} {activeDraft.productName} · Deadline {activeDraft.deadline}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Code {activeDraft.verificationCode}
                </p>
              </div>
              {pendingDrafts.length > 1 ? (
                <select
                  value={selectedDraftId}
                  onChange={(event) => setSelectedDraftId(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none"
                >
                  {pendingDrafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {draft.requestId} · {draft.productName}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="mt-3 flex gap-3">
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
                  placeholder="Enter Verification Code"
                  disabled={confirming}
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.18em] text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={confirming || !verificationCode.trim()}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
                >
                  {confirming ? "Confirming..." : "Confirm Order"}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-300">Place an inventory-valid order to generate a verification code.</p>
          )}
        </div>
      </div>
    </section>
  );
}

