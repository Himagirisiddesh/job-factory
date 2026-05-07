import React from "react";

const STYLES = {
  "Order Confirmed": {
    background: "rgba(34, 211, 238, 0.14)",
    border: "rgba(34, 211, 238, 0.4)",
    color: "#a5f3fc",
  },
  "Pending Approval": {
    background: "rgba(250, 204, 21, 0.12)",
    border: "rgba(250, 204, 21, 0.3)",
    color: "#fde68a",
  },
  "In Review": {
    background: "rgba(96, 165, 250, 0.12)",
    border: "rgba(96, 165, 250, 0.3)",
    color: "#bfdbfe",
  },
  Accepted: {
    background: "rgba(74, 222, 128, 0.12)",
    border: "rgba(74, 222, 128, 0.3)",
    color: "#bbf7d0",
  },
  Production: {
    background: "rgba(192, 132, 252, 0.12)",
    border: "rgba(192, 132, 252, 0.3)",
    color: "#e9d5ff",
  },
  "Quality Check": {
    background: "rgba(45, 212, 191, 0.12)",
    border: "rgba(45, 212, 191, 0.3)",
    color: "#99f6e4",
  },
  Completed: {
    background: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.3)",
    color: "#a7f3d0",
  },
  Rejected: {
    background: "rgba(251, 113, 133, 0.12)",
    border: "rgba(251, 113, 133, 0.3)",
    color: "#fecdd3",
  },
};

export default function StatusBadge({ status, small = false }) {
  const style = STYLES[status] || STYLES["Pending Approval"];

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.16em] ${
        small ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
      }`}
      style={{
        background: style.background,
        borderColor: style.border,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
