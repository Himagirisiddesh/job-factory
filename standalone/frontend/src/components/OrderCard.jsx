import React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Factory, Package2, ShieldCheck } from "lucide-react";
import StatusBadge from "./StatusBadge";

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OrderCard({ order }) {
  return (
    <motion.article
      layout
      whileHover={{ y: -2 }}
      className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
            {order.orderId}
          </span>
          <h3 className="mt-3 text-lg font-bold text-white">{order.productName}</h3>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Package2 size={12} />
            Quantity
          </div>
          <p className="mt-2 font-semibold text-white">{order.quantity}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Factory size={12} />
            Material
          </div>
          <p className="mt-2 font-semibold text-white">{order.material}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <CalendarDays size={12} />
            Deadline
          </div>
          <p className="mt-2 font-semibold text-white">{formatDate(order.deadline)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <ShieldCheck size={12} />
            Quality Grade
          </div>
          <p className="mt-2 font-semibold text-white">{order.qualityGrade}</p>
        </div>
      </div>
    </motion.article>
  );
}

