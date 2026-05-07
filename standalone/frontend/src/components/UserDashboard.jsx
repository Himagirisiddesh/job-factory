import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardList, PackageSearch } from "lucide-react";
import api from "../api";
import ChatPanel from "./ChatPanel";
import OrderCard from "./OrderCard";
import ProductCatalog from "./ProductCatalog";
import WorkspaceHeader from "./WorkspaceHeader";

export default function UserDashboard({ user, onLogout, onSessionExpired, onToast }) {
  const [catalog, setCatalog] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    awaitingVerification: 0,
    confirmed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [catalogResponse, draftsResponse, ordersResponse, statsResponse] = await Promise.all([
          api.get("/catalog"),
          api.get("/order-drafts"),
          api.get("/orders"),
          api.get("/orders/stats"),
        ]);
        if (!active) return;
        setCatalog(catalogResponse.data.products || []);
        setDrafts(draftsResponse.data.drafts || []);
        setOrders(ordersResponse.data.orders || []);
        setStats(statsResponse.data);
      } catch (requestError) {
        if (requestError.response?.status === 401 && active) onSessionExpired?.();
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    const intervalId = window.setInterval(loadData, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshTick, onSessionExpired]);

  useEffect(() => {
    const stream = new EventSource("/api/orders/stream", { withCredentials: true });
    stream.addEventListener("order_confirmed", () => setRefreshTick((value) => value + 1));
    stream.addEventListener("inventory_updated", () => setRefreshTick((value) => value + 1));
    stream.addEventListener("draft_created", () => setRefreshTick((value) => value + 1));
    stream.onerror = () => {};
    return () => stream.close();
  }, []);

  const statCards = useMemo(
    () => [
      { label: "My Orders", value: stats.total, icon: ClipboardList, color: "text-white" },
      { label: "Awaiting Verification", value: stats.awaitingVerification, icon: PackageSearch, color: "text-cyan-200" },
      { label: "Confirmed Orders", value: stats.confirmed, icon: CheckCircle2, color: "text-emerald-200" },
    ],
    [stats]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.1),_transparent_35%),linear-gradient(180deg,_#07111b_0%,_#101827_100%)] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,_rgba(34,211,238,0.16),_transparent_25%),radial-gradient(circle_at_85%_20%,_rgba(59,130,246,0.14),_transparent_25%)]" />
      <div className="relative z-10">
        <WorkspaceHeader
          user={user}
          portalName="Customer Portal"
          portalHint="AI-powered manufacturing request workspace"
          accentClassName="border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
          onLogout={onLogout}
        />

        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6">
          <ProductCatalog products={catalog} />

          <section className="grid gap-4 md:grid-cols-3">
            {statCards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                    <p className={`mt-3 text-3xl font-black ${card.color}`}>{loading ? "..." : card.value}</p>
                  </div>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </motion.div>
            ))}
          </section>

          <ChatPanel
            pendingDrafts={drafts}
            onDataChanged={() => setRefreshTick((value) => value + 1)}
            onToast={onToast}
            onSessionExpired={onSessionExpired}
          />

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">My Orders</p>
              <h2 className="mt-2 text-2xl font-black text-white">Confirmed manufacturing orders</h2>
            </div>

            {loading ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 px-5 py-16 text-center text-sm text-slate-400">
                Loading your orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-5 py-16 text-center text-sm text-slate-400">
                No confirmed orders yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

