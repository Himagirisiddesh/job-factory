import React, { useState, useRef, useEffect, useCallback } from 'react';
import { processAgentInput, AgentContext } from '../utils/agent';
import { Order, OrderStatus, parseOrderDeadline } from '../hooks/useOrders';
import { PortalMessage } from '../hooks/useMessages';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'portal';
  timestamp: Date;
  confidence?: number;
  orderCard?: { orderNum: number; partName: string; material: string; specs: string; quantity: number; deadline: string; status: OrderStatus };
}

interface ChatProps {
  user: string;
  orders: Order[];
  role: 'User' | 'Manufacturer';
  onReplaceOrders: (orders: Order[]) => void;
  onAddOrder: (data: any) => Order;
  onUpdateStatus: (num: number, status: OrderStatus) => { ok: boolean; error?: string };
  onProgressStatus: (num: number) => { ok: boolean; newStatus?: OrderStatus; error?: string };
  onAddQualityNote: (num: number, note: string) => { ok: boolean; error?: string };
  onSwitchTab: () => void;
  onCheckStock: (p: string, m: string, q: number) => { ok: boolean; available: number; warning?: 'exceeds' | 'depleted' };
  onDeductStock: (p: string, m: string, q: number) => void;
  getOrdersByStatus: (s: OrderStatus) => Order[];
  getOrdersByMaterial: (m: string) => Order[];
  getDelayedOrders: () => Order[];
  getApproachingDeadlines: (d?: number) => Order[];
  getQualityIssueOrders: () => Order[];
  getOrderSummary: () => string;
  messages: PortalMessage[];
  sendMessage: (from: 'user' | 'manufacturer', to: 'user' | 'manufacturer', text: string) => void;
  markRead: (forRole: 'user' | 'manufacturer') => void;
}

interface ChatApiResponse {
  type: 'order_create' | 'status_update' | 'quality_log' | 'dashboard_query';
  response: string;
  order?: Order;
  orders: Order[];
  matches?: Order[];
}

function getDeadlineState(order: Order): 'completed' | 'unknown' | 'overdue' | 'due-today' | 'due-soon' | 'on-track' {
  if (order.status === 'Completed') return 'completed';

  const deadline = parseOrderDeadline(order.deadline);
  if (!deadline) return 'unknown';

  const now = new Date();
  const endOfDeadline = new Date(deadline);
  endOfDeadline.setHours(23, 59, 59, 999);

  const startOfDeadline = new Date(deadline);
  startOfDeadline.setHours(0, 0, 0, 0);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (endOfDeadline < now) return 'overdue';
  if (startOfDeadline.getTime() === todayStart.getTime()) return 'due-today';
  if (deadline.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) return 'due-soon';
  return 'on-track';
}

function isOrderNotTakenFurther(order: Order): boolean {
  return order.status === 'Received' || order.status === 'In Review';
}

function buildCustomerOrderSummary(orders: Order[]): string {
  if (orders.length === 0) return 'No current orders are available for tracking.';

  const lines = ['**Current order status and deadline summary:**'];
  for (const order of orders.slice().sort((a, b) => a.orderNum - b.orderNum)) {
    const state = getDeadlineState(order);
    const tracking =
      isOrderNotTakenFurther(order) && (state === 'due-today' || state === 'overdue')
        ? 'not taken further'
        : state.replace('-', ' ');

    lines.push(`- #${order.orderNum}: ${order.partName} | ${order.status} | Deadline: ${order.deadline} | ${tracking}`);
  }

  const meetingDeadline = orders.filter(order => {
    const state = getDeadlineState(order);
    return state === 'on-track' || state === 'due-soon' || state === 'completed';
  });

  if (meetingDeadline.length > 0) {
    lines.push(`\n**Orders meeting the deadline:** ${meetingDeadline.map(order => `#${order.orderNum}`).join(', ')}`);
  }

  return lines.join('\n');
}

function speakCustomerAlert(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

const Chat: React.FC<ChatProps> = (props) => {
  const { orders, role, onReplaceOrders, onAddOrder, onUpdateStatus, onProgressStatus, onAddQualityNote, onCheckStock, onDeductStock,
    getOrdersByStatus, getOrdersByMaterial, getDelayedOrders, getApproachingDeadlines, getQualityIssueOrders, getOrderSummary,
    messages: portalMessages, sendMessage, markRead } = props;

  const [msgs, setMsgs] = useState<ChatMessage[]>([{
    id: 'welcome', sender: 'agent', timestamp: new Date(),
    text: role === 'User'
      ? `🤖 Hello! I'm your **Manufacturing AI Agent**.\n\nI understand natural language — just describe what you need.\n\n💡 Try: *"I need 500 titanium flanges by July 20"*\nOr say **"help"** to see everything I can do.`
      : `🤖 Welcome to **MFG Operations Center**.\n\nI can manage orders, track quality, filter by material/status, and communicate with customers.\n\n💡 Try: *"Show delayed orders"* or *"Summary"*\nSay **"help"** for the full command guide.`,
  }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agentCtx, setAgentCtx] = useState<AgentContext>({ role, orders, conversationHistory: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const orderSnapshotRef = useRef<Map<number, { status: OrderStatus; qualityCount: number; auditCount: number; updatedAt: string }>>(new Map());
  const hasOrderSnapshotRef = useRef(false);
  const announcedDeadlineAlertsRef = useRef<Set<string>>(new Set());

  // Keep agent context synced
  useEffect(() => { setAgentCtx(prev => ({ ...prev, orders, role })); }, [orders, role]);

  // Portal message sync
  useEffect(() => {
    const forMe = role.toLowerCase() as 'user' | 'manufacturer';
    const unread = portalMessages.filter(m => m.to === forMe && !m.read);
    if (unread.length > 0) {
      const latest = unread[unread.length - 1]!;
      setMsgs(prev => {
        if (prev.some(m => m.id === latest.id)) return prev;
        return [...prev, {
          id: latest.id, sender: 'portal', timestamp: new Date(latest.timestamp),
          text: `📩 **Message from ${latest.from === 'user' ? 'Customer' : 'Manufacturer'}:**\n\n"${latest.text}"`,
        }];
      });
      markRead(forMe);
    }
  }, [portalMessages, role, markRead]);

  // Customer-facing live order update notices.
  useEffect(() => {
    const nextSnapshot = new Map<number, { status: OrderStatus; qualityCount: number; auditCount: number; updatedAt: string }>();

    for (const order of orders) {
      nextSnapshot.set(order.orderNum, {
        status: order.status,
        qualityCount: order.qualityNotes.length,
        auditCount: order.auditTrail.length,
        updatedAt: order.updatedAt,
      });
    }

    if (role !== 'User') {
      orderSnapshotRef.current = nextSnapshot;
      hasOrderSnapshotRef.current = true;
      return;
    }

    if (!hasOrderSnapshotRef.current) {
      orderSnapshotRef.current = nextSnapshot;
      hasOrderSnapshotRef.current = true;
      return;
    }

    const notices: ChatMessage[] = [];

    for (const order of orders) {
      const previous = orderSnapshotRef.current.get(order.orderNum);
      if (!previous) continue;

      const statusChanged = previous.status !== order.status;
      const qualityAdded = order.qualityNotes.length > previous.qualityCount;
      const auditAdded = order.auditTrail.length > previous.auditCount;

      if (!statusChanged && !qualityAdded && !auditAdded) continue;

      const latestQuality = qualityAdded ? order.qualityNotes[order.qualityNotes.length - 1] : undefined;
      const latestAudit = order.auditTrail[order.auditTrail.length - 1];
      const lines = [
        `**Order #${order.orderNum} updated**`,
        `Part: ${order.partName}`,
        `Status: ${order.status}`,
      ];

      if (statusChanged) lines.push(`Previous status: ${previous.status}`);
      if (latestQuality) lines.push(`Quality note: ${latestQuality.note}`);
      else if (latestAudit) lines.push(`Latest activity: ${latestAudit.action}`);

      notices.push({
        id: `order-update-${order.orderNum}-${order.updatedAt}`,
        sender: 'portal',
        timestamp: new Date(order.updatedAt),
        text: lines.join('\n'),
      });
    }

    if (notices.length > 0) {
      setMsgs(prev => {
        const existing = new Set(prev.map(message => message.id));
        return [...prev, ...notices.filter(notice => !existing.has(notice.id))];
      });
    }

    orderSnapshotRef.current = nextSnapshot;
  }, [orders, role]);

  // Customer deadline alerts for orders due/overdue without progress.
  useEffect(() => {
    if (role !== 'User') return;

    const stalledOrders = orders.filter(order => {
      const state = getDeadlineState(order);
      return isOrderNotTakenFurther(order) && (state === 'due-today' || state === 'overdue');
    });

    const newAlerts = stalledOrders.filter(order => {
      const state = getDeadlineState(order);
      const key = `${order.orderNum}-${state}-${order.status}-${order.deadline}`;
      if (announcedDeadlineAlertsRef.current.has(key)) return false;
      announcedDeadlineAlertsRef.current.add(key);
      return true;
    });

    if (newAlerts.length === 0) return;

    const alertText = [
      '**Deadline alert**',
      newAlerts.map(order => {
        const state = getDeadlineState(order);
        const timing = state === 'overdue' ? 'has passed' : 'is meeting today';
        return `Order #${order.orderNum} deadline ${timing}, but the order is not taken further. Current status: ${order.status}.`;
      }).join('\n'),
      '',
      buildCustomerOrderSummary(orders),
    ].join('\n');

    setMsgs(prev => {
      const id = `deadline-alert-${Date.now()}`;
      return [...prev, { id, sender: 'portal', timestamp: new Date(), text: alertText }];
    });

    speakCustomerAlert(
      newAlerts.map(order => `Deadline alert. Order ${order.orderNum} is not taken further. Current status is ${order.status}.`).join(' ')
    );
  }, [orders, role]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, isThinking]);

  // Voice setup
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput(t); setIsListening(false);
      setTimeout(() => handleAgentProcess(t), 500);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) { alert('Use Chrome for voice input.'); return; }
    if (isListening) { recognitionRef.current.abort(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const addMsg = useCallback((text: string, sender: 'agent' | 'portal' = 'agent', extra?: Partial<ChatMessage>) => {
    setMsgs(prev => [...prev, { id: `${sender}-${Date.now()}-${Math.random()}`, text, sender, timestamp: new Date(), ...extra }]);
  }, []);

  const runSharedChatCommand = useCallback(async (text: string, actionType: string): Promise<boolean> => {
    const backendActions = new Set([
      'ORDER_CREATE',
      'STATUS_UPDATE',
      'QUALITY_LOG',
      'DASHBOARD_QUERY',
      'ORDER_QUERY',
    ]);

    if (!backendActions.has(actionType)) return false;

    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, role: role.toLowerCase(), user: props.user }),
    });

    const payload = await response.json() as ChatApiResponse;
    if (payload.orders) onReplaceOrders(payload.orders);

    if (!response.ok) {
      addMsg(payload.response || 'I could not complete that command.');
      return true;
    }

    if (payload.type === 'dashboard_query') {
      const matches = payload.matches || payload.orders || [];
      if (matches.length === 0) {
        addMsg(payload.response);
      } else {
        addMsg(`${payload.response}\n${matches.map(o => `- **#${o.orderNum}** ${o.partName} | ${o.quantity} pcs | ${o.status} | Deadline: ${o.deadline} | Latest quality: ${o.qualityNotes.at(-1)?.note || 'None'}`).join('\n')}`);
      }
      return true;
    }

    if (payload.type === 'order_create' && payload.order) {
      addMsg(`**${payload.response}**`, 'agent', {
        orderCard: {
          orderNum: payload.order.orderNum,
          partName: payload.order.partName,
          material: payload.order.material,
          specs: payload.order.specs,
          quantity: payload.order.quantity,
          deadline: payload.order.deadline,
          status: payload.order.status,
        },
      });
      return true;
    }

    addMsg(payload.response);
    return true;
  }, [addMsg, onReplaceOrders, role]);

  // ─── Core Agent Processing ───
  const handleAgentProcess = useCallback((text: string) => {
    // Add user message
    setMsgs(prev => [...prev, { id: `usr-${Date.now()}`, text, sender: 'user', timestamp: new Date() }]);
    setInput('');
    setIsThinking(true);

    // Update context
    const ctx: AgentContext = { ...agentCtx, orders, conversationHistory: [...agentCtx.conversationHistory, { role: 'user', text }] };

    // Simulate LLM thinking delay
    const delay = 600 + Math.random() * 800;
    setTimeout(async () => {
      setIsThinking(false);
      const action = processAgentInput(text, ctx);

      // Update context with last intent
      setAgentCtx(prev => ({
        ...prev,
        lastIntent: action.type,
        lastOrderNum: action.data.orderNum || prev.lastOrderNum,
        conversationHistory: [...prev.conversationHistory, { role: 'user', text }, { role: 'agent', text: action.response || '...' }],
      }));

      const myRole = role.toLowerCase() as 'user' | 'manufacturer';

      try {
        if (action.type === 'CREATE_ORDER' && role === 'User') {
          const { partName, material, quantity } = action.data;
          const stock = onCheckStock(partName, material, quantity);
          if (!stock.ok) {
            addMsg(`Insufficient stock. Requested ${quantity} pcs, only **${stock.available}** available.\n\nReduce quantity or contact the manufacturer.`);
            return;
          }
          const handled = await runSharedChatCommand(text, action.type);
          if (handled) {
            onDeductStock(partName, material, quantity);
            if (stock.warning === 'depleted') addMsg(`Stock Alert: ${material} ${partName} is now at **0** units. Restocking needed.`);
            return;
          }
        } else {
          const handled = await runSharedChatCommand(text, action.type);
          if (handled) return;
        }
      } catch {
        addMsg('The shared command API is not reachable. I will try the local command path.');
      }

      switch (action.type) {
        case 'GREETING':
        case 'HELP':
        case 'CONVERSATIONAL':
          addMsg(action.response);
          break;

        case 'SEND_MESSAGE': {
          const target = action.data.messageTarget || (myRole === 'user' ? 'manufacturer' : 'user');
          sendMessage(myRole, target, action.data.messageText);
          addMsg(`✅ Message sent to **${target === 'user' ? 'Customer' : 'Factory'}**:\n\n> "${action.data.messageText}"`);
          break;
        }

        case 'CREATE_ORDER': {
          if (role !== 'User') { addMsg("⚠️ Only customers can create orders. Use the **Customer Portal** (port 5173)."); break; }
          const { partName, material, quantity, deadline, specs } = action.data;
          const stock = onCheckStock(partName, material, quantity);
          if (!stock.ok) {
            addMsg(`❌ **Insufficient stock.** Requested ${quantity} pcs, only **${stock.available}** available.\n\nReduce quantity or contact the manufacturer.`);
            break;
          }
          const order = onAddOrder({ partName, material, quantity, deadline, specs });
          onDeductStock(partName, material, quantity);
          addMsg(`✅ **Order #${order.orderNum} created!**`, 'agent', {
            orderCard: { orderNum: order.orderNum, partName, material, specs, quantity, deadline, status: 'Received' },
          });
          if (stock.warning === 'depleted') addMsg(`⚠️ **Stock Alert:** ${material} ${partName} is now at **0** units. Restocking needed.`);
          break;
        }

        case 'UPDATE_STATUS': {
          if (role !== 'Manufacturer') { addMsg('Status changes are available in the Manufacturer portal.'); break; }
          const { orderNum, status } = action.data;
          if (!orderNum) { addMsg("Which order? Please include an order number like **#3**."); break; }
          const r = status ? onUpdateStatus(orderNum, status) : onProgressStatus(orderNum);
          addMsg(r.ok ? `✅ Order **#${orderNum}** updated.` : `⚠️ ${r.error}`);
          break;
        }

        case 'PROGRESS_STATUS': {
          if (role !== 'Manufacturer') { addMsg('Order progression is available in the Manufacturer portal. You can still ask me to check an order status here.'); break; }
          const num = action.data.orderNum;
          if (!num) { addMsg("Which order? Include **#number**."); break; }
          const r = onProgressStatus(num);
          addMsg(r.ok ? `✅ Order **#${num}** → **${r.newStatus}**` : `⚠️ ${r.error}`);
          break;
        }

        case 'QUALITY_LOG': {
          if (role !== 'Manufacturer') { addMsg('Quality notes are restricted to the Manufacturer portal.'); break; }
          const { orderNum, remarks } = action.data;
          if (!orderNum) { addMsg("Which order? Include **#number**."); break; }
          const r = onAddQualityNote(orderNum, remarks);
          addMsg(r.ok ? `🔍 Quality log updated for **#${orderNum}**.` : `⚠️ ${r.error}`);
          break;
        }

        case 'DASHBOARD_QUERY': {
          const { queryType } = action.data;
          if (queryType === 'delayed') {
            const d = getDelayedOrders();
            addMsg(d.length === 0 ? "✅ No overdue orders." : `⚠️ **${d.length} Overdue Order(s)**`);
          } else if (queryType === 'due_soon') {
            const s = getApproachingDeadlines(3);
            addMsg(s.length === 0 ? "📅 No deadlines approaching soon." : `📅 **Approaching Deadlines**`);
          } else if (queryType === 'quality') {
            const q = getQualityIssueOrders();
            addMsg(q.length === 0 ? "✅ No quality issues." : `🔴 **Quality Alerts Detected**`);
          } else {
            addMsg(getOrderSummary());
          }
          break;
        }

        case 'ORDER_QUERY': {
          const o = orders.find(x => x.orderNum === action.data.orderNum);
          if (!o) { addMsg(`Order **#${action.data.orderNum}** not found.`); break; }
          addMsg(`📋 **Order #${o.orderNum} — ${o.partName}**\n**Status:** ${o.status}\n**Material:** ${o.material} | **Qty:** ${o.quantity}\n**Deadline:** ${o.deadline}`);
          break;
        }

        case 'ORDER_CREATE': {
          if (role !== 'User') { addMsg("⚠️ Only customers can create orders. Use the **Customer Portal** (port 5173)."); break; }
          const { partName, material, quantity, deadline, specs } = action.data;
          const stock = onCheckStock(partName || 'Custom Part', material || 'Standard', quantity || 1);
          if (!stock.ok) {
            addMsg(`❌ **Insufficient stock.** Requested ${quantity} pcs, only **${stock.available}** available.\n\nReduce quantity or contact the manufacturer.`);
            break;
          }
          const order = onAddOrder({ partName, material, quantity, deadline, specs });
          onDeductStock(partName || 'Custom Part', material || 'Standard', quantity || 1);
          addMsg(`✅ **Order #${order.orderNum} created!**`, 'agent', {
            orderCard: { orderNum: order.orderNum, partName: order.partName, material: order.material, specs: order.specs, quantity: order.quantity, deadline: order.deadline, status: 'Received' },
          });
          if (stock.warning === 'depleted') addMsg(`⚠️ **Stock Alert:** ${material} ${partName} is now at **0** units. Restocking needed.`);
          break;
        }
        
        case 'MESSAGE_SEND': {
          const target = action.data.messageTarget || (myRole === 'user' ? 'manufacturer' : 'user');
          sendMessage(myRole, target, action.data.messageText);
          addMsg(`✅ Message sent to **${target}**.`);
          break;
        }
      }
    }, delay);
  }, [agentCtx, orders, role, onAddOrder, onUpdateStatus, onProgressStatus, onAddQualityNote, onCheckStock, onDeductStock, getOrderSummary, getDelayedOrders, getApproachingDeadlines, getQualityIssueOrders, getOrdersByMaterial, getOrdersByStatus, sendMessage, addMsg, runSharedChatCommand]);

  const handleSend = () => { if (input.trim()) handleAgentProcess(input.trim()); };

  const fmt = (t: string) => t
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
    .replace(/^> (.+)/gm, '<span style="border-left:3px solid var(--primary);padding-left:10px;display:block;margin:4px 0;color:var(--text-muted)">$1</span>');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 20px 20px 30px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>
            {role === 'Manufacturer' ? '🏭 MFG Operations Agent' : '🤖 AI Manufacturing Agent'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Rule-first NLP • Stateless extraction • {orders.length} orders tracked • Port {window.location.port}
          </p>
        </div>
        <div className="status-badge" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>● Agent Online</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px', marginBottom: '16px' }}>
        {msgs.map(m => (
          <div key={m.id} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
              {m.sender === 'user' ? 'You' : m.sender === 'portal' ? '📩 Incoming' : '🤖 AI Agent'}
            </div>
            <div className="glass" style={{
              padding: '14px 18px',
              borderRadius: m.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.sender === 'user' ? 'linear-gradient(135deg, var(--primary), #7c3aed)' : m.sender === 'portal' ? 'rgba(245,158,11,0.08)' : 'var(--bg-card)',
              border: m.sender === 'portal' ? '1px solid rgba(245,158,11,0.3)' : undefined,
            }}>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: fmt(m.text) }} />
              {m.orderCard && (
                <div style={{ marginTop: '12px', padding: '14px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>Order #{m.orderCard.orderNum}</span>
                    <span className="status-badge status-received" style={{ fontSize: '0.65rem' }}>Received</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.82rem' }}>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Part:</span> {m.orderCard.partName}</div>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Material:</span> {m.orderCard.material}</div>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Qty:</span> {m.orderCard.quantity} pcs</div>
                    <div><span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Deadline:</span> {m.orderCard.deadline}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '3px', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
              {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isThinking && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px', fontWeight: 700 }}>🤖 AI AGENT</div>
            <div className="glass" style={{ padding: '12px 18px', borderRadius: '16px 16px 16px 4px' }}>
              <div className="typing-indicator"><span/><span/><span/></div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="glass" style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={toggleVoice} style={{
          width: '44px', height: '44px', borderRadius: '50%', border: '1px solid var(--glass-border)',
          background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
          color: isListening ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer',
          animation: isListening ? 'pulse 1.5s infinite' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        <input
          className="input-field"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none' }}
          placeholder={isListening ? '🎤 Listening...' : 'Talk to the AI agent...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          autoComplete="off"
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim()}
          style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%', opacity: input.trim() ? 1 : 0.4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </div>
    </div>
  );
};

export default Chat;
