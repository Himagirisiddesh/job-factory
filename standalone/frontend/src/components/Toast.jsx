import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const STYLES = {
  success: { icon: CheckCircle, color: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  error: { icon: XCircle, color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  info: { icon: AlertCircle, color: "#60a5fa", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
};

export default function Toast({ message, type = "success" }) {
  const s = STYLES[type] || STYLES.info;
  const Icon = s.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.22 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm max-w-xs"
      style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: "blur(12px)", color: "#e8f4f8" }}
    >
      <Icon size={16} style={{ color: s.color, flexShrink: 0 }} />
      <span>{message}</span>
    </motion.div>
  );
}
