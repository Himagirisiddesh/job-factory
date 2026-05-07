import { useCallback, useEffect, useState } from 'react';

export interface QualityNote {
  timestamp: string;
  note: string;
  riskFlag?: 'high' | 'medium' | 'low';
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  user?: string;
}

export type OrderStatus = 'Received' | 'In Review' | 'Accepted' | 'Manufacturing' | 'Inspection' | 'Completed';

const STATUS_FLOW: OrderStatus[] = ['Received', 'In Review', 'Accepted', 'Manufacturing', 'Inspection', 'Completed'];

export interface Order {
  id: string;
  orderNum: number;
  partName: string;
  material: string;
  specs: string;
  quantity: number;
  deadline: string;
  status: OrderStatus;
  customerId?: string;
  qualityNotes: QualityNote[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'precision_orders';
const COUNTER_KEY = 'precision_order_counter';
const API_BASE = 'http://localhost:3001/api';

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadCounter(): number {
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    return raw ? Number.parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function parseOrderDeadline(deadline: string): Date | null {
  if (!deadline || deadline === 'TBD') return null;

  const direct = new Date(deadline);
  if (!Number.isNaN(direct.getTime())) return direct;

  const current = new Date();
  const withYear = new Date(`${deadline}, ${current.getFullYear()}`);
  return Number.isNaN(withYear.getTime()) ? null : withYear;
}

function parseDeadline(deadline: string): Date | null {
  return parseOrderDeadline(deadline);
}

function detectRiskFlag(note: string): QualityNote['riskFlag'] {
  if (/crack|fracture|fail|defect|reject|broken|damage|contamina/i.test(note)) return 'high';
  if (/deviation|out.of.tolerance|minor.defect|slight|worn/i.test(note)) return 'medium';
  if (/passed|approved|good|within.spec|acceptable/i.test(note)) return 'low';
  return undefined;
}

function syncCounterFromOrders(value: Order[]): number {
  return value.reduce((max, order) => Math.max(max, order.orderNum), 0);
}

function mergeOrders(sharedOrders: Order[], localOrders: Order[]): Order[] {
  const byOrderNum = new Map<number, Order>();

  for (const order of localOrders) {
    byOrderNum.set(order.orderNum, order);
  }

  for (const order of sharedOrders) {
    byOrderNum.set(order.orderNum, order);
  }

  return [...byOrderNum.values()].sort((a, b) => b.orderNum - a.orderNum);
}

async function fetchOrdersFromApi(): Promise<Order[]> {
  const response = await fetch(`${API_BASE}/orders`);
  if (!response.ok) throw new Error('Unable to load shared orders.');
  return response.json();
}

function persistOrderToApi(order: Order): void {
  fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  }).catch(error => {
    console.warn('Unable to sync order to shared API:', error);
  });
}

function updateOrderInApi(order: Order): void {
  fetch(`${API_BASE}/orders/${order.orderNum}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  }).catch(error => {
    console.warn('Unable to sync order update to shared API:', error);
  });
}

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>(loadOrders);
  const [counter, setCounter] = useState<number>(loadCounter);

  useEffect(() => {
    let cancelled = false;

    const loadSharedOrders = async () => {
      try {
        const sharedOrders = await fetchOrdersFromApi();
        if (cancelled) return;

        setOrders(prev => {
          const merged = mergeOrders(sharedOrders, prev);
          const sharedKeys = new Set(sharedOrders.flatMap(order => [order.id, String(order.orderNum)]));
          for (const order of merged) {
            if (!sharedKeys.has(order.id) && !sharedKeys.has(String(order.orderNum))) {
              persistOrderToApi(order);
            }
          }
          setCounter(syncCounterFromOrders(merged));
          return merged;
        });
      } catch {
        // The app still works locally if the API is not running.
      }
    };

    loadSharedOrders();
    const interval = window.setInterval(loadSharedOrders, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(COUNTER_KEY, String(counter));
  }, [counter]);

  const addOrder = useCallback((data: {
    partName: string;
    material: string;
    quantity: number;
    deadline: string;
    specs: string;
    customerId?: string;
  }): Order => {
    const nextNum = counter + 1;
    const now = new Date().toISOString();
    const order: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderNum: nextNum,
      partName: data.partName,
      material: data.material,
      quantity: data.quantity,
      deadline: data.deadline,
      specs: data.specs,
      status: 'Received',
      customerId: data.customerId,
      qualityNotes: [],
      auditTrail: [{ timestamp: now, action: 'Order created - status: Received' }],
      createdAt: now,
      updatedAt: now,
    };

    setCounter(nextNum);
    setOrders(prev => [...prev, order]);
    persistOrderToApi(order);
    return order;
  }, [counter]);

  const updateStatus = useCallback((orderNum: number, newStatus: OrderStatus): { ok: boolean; error?: string } => {
    let result: { ok: boolean; error?: string } = { ok: false };

    setOrders(prev => {
      const idx = prev.findIndex(order => order.orderNum === orderNum);
      if (idx === -1) {
        result = { ok: false, error: `Order #${orderNum} not found.` };
        return prev;
      }

      const order = prev[idx]!;
      const currentIdx = STATUS_FLOW.indexOf(order.status);
      const targetIdx = STATUS_FLOW.indexOf(newStatus);

      if (targetIdx <= currentIdx) {
        result = {
          ok: false,
          error: `Cannot move Order #${orderNum} from "${order.status}" to "${newStatus}". Status can only progress forward.`,
        };
        return prev;
      }

      const now = new Date().toISOString();
      const updated: Order = {
        ...order,
        status: newStatus,
        updatedAt: now,
        auditTrail: [...order.auditTrail, { timestamp: now, action: `Status changed: ${order.status} -> ${newStatus}` }],
      };

      const next = [...prev];
      next[idx] = updated;
      result = { ok: true };
      updateOrderInApi(updated);
      return next;
    });

    return result;
  }, []);

  const progressStatus = useCallback((orderNum: number): { ok: boolean; newStatus?: OrderStatus; error?: string } => {
    let result: { ok: boolean; newStatus?: OrderStatus; error?: string } = { ok: false };

    setOrders(prev => {
      const idx = prev.findIndex(order => order.orderNum === orderNum);
      if (idx === -1) {
        result = { ok: false, error: `Order #${orderNum} not found.` };
        return prev;
      }

      const order = prev[idx]!;
      const currentIdx = STATUS_FLOW.indexOf(order.status);
      if (currentIdx >= STATUS_FLOW.length - 1) {
        result = { ok: false, error: `Order #${orderNum} is already at "${order.status}" - final stage.` };
        return prev;
      }

      const newStatus = STATUS_FLOW[currentIdx + 1]!;
      const now = new Date().toISOString();
      const updated: Order = {
        ...order,
        status: newStatus,
        updatedAt: now,
        auditTrail: [...order.auditTrail, { timestamp: now, action: `Status progressed: ${order.status} -> ${newStatus}` }],
      };

      const next = [...prev];
      next[idx] = updated;
      result = { ok: true, newStatus };
      updateOrderInApi(updated);
      return next;
    });

    return result;
  }, []);

  const addQualityNote = useCallback((orderNum: number, note: string): { ok: boolean; error?: string } => {
    let result: { ok: boolean; error?: string } = { ok: false };
    const riskFlag = detectRiskFlag(note);

    setOrders(prev => {
      const idx = prev.findIndex(order => order.orderNum === orderNum);
      if (idx === -1) {
        result = { ok: false, error: `Order #${orderNum} not found.` };
        return prev;
      }

      const order = prev[idx]!;
      const now = new Date().toISOString();
      const updated: Order = {
        ...order,
        updatedAt: now,
        qualityNotes: [...order.qualityNotes, { timestamp: now, note, riskFlag }],
        auditTrail: [...order.auditTrail, { timestamp: now, action: `Quality note added${riskFlag === 'high' ? ' - HIGH RISK' : ''}` }],
      };

      const next = [...prev];
      next[idx] = updated;
      result = { ok: true };
      updateOrderInApi(updated);
      return next;
    });

    return result;
  }, []);

  const getOrdersByStatus = useCallback((status: OrderStatus): Order[] => {
    return orders.filter(order => order.status === status);
  }, [orders]);

  const getOrdersByMaterial = useCallback((material: string): Order[] => {
    return orders.filter(order => order.material.toLowerCase().includes(material.toLowerCase()));
  }, [orders]);

  const getDelayedOrders = useCallback((): Order[] => {
    const now = new Date();
    return orders.filter(order => {
      if (order.status === 'Completed') return false;
      const deadline = parseDeadline(order.deadline);
      return Boolean(deadline && deadline < now);
    });
  }, [orders]);

  const getApproachingDeadlines = useCallback((withinDays = 3): Order[] => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 86400000);
    return orders.filter(order => {
      if (order.status === 'Completed') return false;
      const deadline = parseDeadline(order.deadline);
      return Boolean(deadline && deadline >= now && deadline <= cutoff);
    });
  }, [orders]);

  const getQualityIssueOrders = useCallback((): Order[] => {
    return orders.filter(order => order.qualityNotes.some(note => note.riskFlag === 'high' || note.riskFlag === 'medium'));
  }, [orders]);

  const getOrderSummary = useCallback((): string => {
    const lines: string[] = [`Order Summary (${orders.length} total)`];

    for (const status of STATUS_FLOW) {
      const count = orders.filter(order => order.status === status).length;
      if (count > 0) lines.push(`- ${status}: ${count}`);
    }

    const delayed = getDelayedOrders();
    if (delayed.length > 0) lines.push(`\n${delayed.length} overdue order(s)`);

    const risky = getQualityIssueOrders();
    if (risky.length > 0) lines.push(`${risky.length} order(s) with quality issues`);

    if (orders.length > 0) {
      lines.push('\nCurrent status and deadline tracking:');
      for (const order of orders.slice().sort((a, b) => a.orderNum - b.orderNum)) {
        const deadline = parseDeadline(order.deadline);
        const now = new Date();
        let tracking = 'on track';

        if (!deadline) tracking = 'deadline not set';
        else if (order.status === 'Completed') tracking = 'completed';
        else {
          const endOfDeadline = new Date(deadline);
          endOfDeadline.setHours(23, 59, 59, 999);

          const startOfDeadline = new Date(deadline);
          startOfDeadline.setHours(0, 0, 0, 0);

          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          if (endOfDeadline < now) tracking = 'overdue';
          else if (startOfDeadline.getTime() === todayStart.getTime()) tracking = 'deadline meeting today';
          else if (deadline.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) tracking = 'deadline approaching';
        }

        if ((tracking === 'overdue' || tracking === 'deadline meeting today') && (order.status === 'Received' || order.status === 'In Review')) {
          tracking = `${tracking} - order not taken further`;
        }

        lines.push(`- #${order.orderNum}: ${order.partName} | ${order.status} | Deadline: ${order.deadline} | ${tracking}`);
      }
    }

    return lines.join('\n');
  }, [orders, getDelayedOrders, getQualityIssueOrders]);

  const replaceOrders = useCallback((nextOrders: Order[]): void => {
    setOrders(nextOrders);
    setCounter(syncCounterFromOrders(nextOrders));
  }, []);

  return {
    orders,
    replaceOrders,
    addOrder,
    updateStatus,
    progressStatus,
    addQualityNote,
    getOrdersByStatus,
    getOrdersByMaterial,
    getDelayedOrders,
    getApproachingDeadlines,
    getQualityIssueOrders,
    getOrderSummary,
    STATUS_FLOW,
  };
};
