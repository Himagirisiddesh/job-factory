import React from "react";
import { Building2, LogOut } from "lucide-react";

export default function WorkspaceHeader({ user, portalName, portalHint, accentClassName, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 px-6 py-5 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] ${accentClassName}`}>
              {portalName}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
              FactoryFlow AI
            </div>
          </div>
          <h1 className="mt-3 text-2xl font-black text-white">{portalHint}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
            AI-guided manufacturing requests are validated against live stock and confirmed through secure verification codes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 lg:flex">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-slate-100">
              <Building2 size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-slate-400">
                {user.companyName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
