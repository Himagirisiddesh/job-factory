import React, { useState } from "react";
import { motion } from "framer-motion";
import { Factory, LockKeyhole, UserRound } from "lucide-react";
import api from "../api";

const CUSTOMER_DEMO = {
  label: "Customer Demo",
  role: "customer",
  email: "customer@factoryflow.demo",
  password: "Customer#2026!",
  icon: UserRound,
  accent: "#66d9ef",
  description: "Place smart inventory-aware manufacturing requests and confirm orders securely.",
};

export default function LoginPanel({ onAuthenticated, onToast }) {
  const [email, setEmail] = useState(CUSTOMER_DEMO.email);
  const [password, setPassword] = useState(CUSTOMER_DEMO.password);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", { email, password });
      onAuthenticated?.(data.user);
    } catch (requestError) {
      const message = requestError.response?.data?.error || "Unable to sign in right now.";
      setError(message);
      onToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(102,217,239,0.16),_transparent_35%),linear-gradient(135deg,_#08131f_0%,_#0e1b29_45%,_#1b2334_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-8 px-6 py-10 lg:flex-row lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full lg:max-w-xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-slate-300">
            <Factory size={14} />
            FactoryFlow Access
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-5xl">
            Secure customer access for the AI manufacturing order demo.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
            Sign in to use the AI-powered customer portal. Orders are validated against real inventory, confirmed by
            verification code, and tracked in your personal order workspace.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
            <div className="flex items-center justify-between">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                  background: `${CUSTOMER_DEMO.accent}18`,
                  borderColor: `${CUSTOMER_DEMO.accent}55`,
                  color: CUSTOMER_DEMO.accent,
                }}
              >
                <CUSTOMER_DEMO.icon size={18} />
              </div>
              <span
                className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  color: CUSTOMER_DEMO.accent,
                  borderColor: `${CUSTOMER_DEMO.accent}55`,
                  background: `${CUSTOMER_DEMO.accent}12`,
                }}
              >
                {CUSTOMER_DEMO.role}
              </span>
            </div>

            <h2 className="mt-4 text-lg font-bold text-white">{CUSTOMER_DEMO.label}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-300">{CUSTOMER_DEMO.description}</p>
            <div className="mt-4 space-y-1 text-xs text-slate-400">
              <p>{CUSTOMER_DEMO.email}</p>
              <p>{CUSTOMER_DEMO.password}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950/60 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <LockKeyhole size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Sign In</p>
              <p className="text-xs text-slate-400">Protected customer demo session</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-slate-900"
                placeholder="name@company.com"
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-slate-900"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-cyan-300/50"
            >
              {loading ? "Signing in..." : "Enter Workspace"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
