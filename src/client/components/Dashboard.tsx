import React from 'react';
import { Order, OrderStatus, parseOrderDeadline } from '../hooks/useOrders';
import { InventoryItem } from '../hooks/useInventory';

interface DashboardProps {
  orders: Order[];
  role: 'User' | 'Manufacturer';
  inventory?: InventoryItem[];
  onUpdateStatus?: (orderNum: number, status: OrderStatus) => { ok: boolean; error?: string };
  onProgressStatus?: (orderNum: number) => { ok: boolean; newStatus?: OrderStatus; error?: string };
  STATUS_FLOW: OrderStatus[];
}

const STATUS_COLORS: Record<string, string> = {
  'Received': 'status-received',
  'In Review': 'status-in-review',
  'Accepted': 'status-accepted',
  'Manufacturing': 'status-mfg',
  'Inspection': 'status-inspect',
  'Completed': 'status-completed',
};

const ACTION_LABELS: Record<string, string> = {
  'Received': '📋 Start Review',
  'In Review': '✅ Accept Order',
  'Accepted': '🏭 Start Manufacturing',
  'Manufacturing': '🔍 Move to Inspection',
  'Inspection': '🏁 Complete Order',
};

const ACTION_COLORS: Record<string, { bg: string; hover: string; border: string }> = {
  'Received': { bg: 'rgba(245,158,11,0.1)', hover: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)' },
  'In Review': { bg: 'rgba(16,185,129,0.1)', hover: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.3)' },
  'Accepted': { bg: 'rgba(99,102,241,0.1)', hover: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.3)' },
  'Manufacturing': { bg: 'rgba(167,139,250,0.1)', hover: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.3)' },
  'Inspection': { bg: 'rgba(52,211,153,0.1)', hover: 'rgba(52,211,153,0.2)', border: 'rgba(52,211,153,0.3)' },
};

type DeadlineState = 'completed' | 'unknown' | 'overdue' | 'due-today' | 'due-soon' | 'on-track';

function getDeadlineState(order: Order): DeadlineState {
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

  const threeDays = 3 * 24 * 60 * 60 * 1000;

  if (endOfDeadline < now) return 'overdue';
  if (startOfDeadline.getTime() === todayStart.getTime()) return 'due-today';
  if (deadline.getTime() - now.getTime() <= threeDays) return 'due-soon';
  return 'on-track';
}

function isNotTakenFurther(order: Order): boolean {
  return order.status === 'Received' || order.status === 'In Review';
}

function getDeadlineLabel(state: DeadlineState): { label: string; color: string; bg: string; border: string } {
  switch (state) {
    case 'overdue':
      return { label: 'Overdue', color: '#fecaca', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' };
    case 'due-today':
      return { label: 'Due today', color: '#fed7aa', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' };
    case 'due-soon':
      return { label: 'Due soon', color: '#fde68a', bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.28)' };
    case 'completed':
      return { label: 'Completed', color: '#bbf7d0', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.28)' };
    case 'unknown':
      return { label: 'No deadline', color: '#cbd5e1', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)' };
    default:
      return { label: 'On track', color: '#bfdbfe', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)' };
  }
}

const Dashboard: React.FC<DashboardProps> = ({ orders, role, inventory, onProgressStatus, STATUS_FLOW }) => {
  const isManufacturer = role === 'Manufacturer';
  const customerTracking = orders.map(order => ({
    order,
    state: getDeadlineState(order),
    stalled: isNotTakenFurther(order) && (getDeadlineState(order) === 'due-today' || getDeadlineState(order) === 'overdue'),
  }));
  const stalledOrders = customerTracking.filter(item => item.stalled);
  const onTrackOrders = customerTracking.filter(item => item.state === 'on-track' || item.state === 'completed');

  const counts = {
    total: orders.length,
    active: orders.filter(o => o.status !== 'Completed').length,
    completed: orders.filter(o => o.status === 'Completed').length,
    risky: orders.filter(o => o.qualityNotes.some(qn => qn.riskFlag === 'high')).length,
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = (deadline: string) => {
    const d = parseOrderDeadline(deadline);
    if (!d) return false;
    return d < new Date();
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {isManufacturer ? 'Operations Command Center' : 'Order Tracking'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            {isManufacturer ? 'Live manufacturing pipeline and inventory control' : 'Real-time status of your precision orders'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="glass" style={{ padding: '8px 16px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
            Live Sync Active
          </div>
        </div>
      </header>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Total Orders', value: counts.total, icon: '📦', color: '#818cf8' },
          { label: 'Active Pipeline', value: counts.active, icon: '⚙️', color: '#fbbf24' },
          { label: 'Quality Alerts', value: counts.risky, icon: '⚠️', color: '#ef4444' },
          { label: 'Completed', value: counts.completed, icon: '✅', color: '#34d399' },
        ].map((s, i) => (
          <div key={i} className="glass animate-fade-in" style={{ padding: '24px', animationDelay: `${i * 0.1}s`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '1.8rem', position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.1 }}>{s.icon}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Inventory (Mfg Only) */}
      {isManufacturer && inventory && (
        <div className="glass animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏭 Real-time Inventory Stock
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {inventory.map((item, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>{item.material} {item.partType}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: item.available === 0 ? '#ef4444' : item.available < 20 ? '#fbbf24' : '#34d399' }}>
                  {item.available} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>pcs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Tracking */}
      {!isManufacturer && (
        <div className="glass animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>Customer Tracking System</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                Current order status, deadline health, and action alerts.
              </p>
            </div>
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: stalledOrders.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.10)',
              border: `1px solid ${stalledOrders.length > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.28)'}`,
              color: stalledOrders.length > 0 ? '#fecaca' : '#bbf7d0',
              fontSize: '0.82rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}>
              {stalledOrders.length > 0 ? `${stalledOrders.length} action alert(s)` : `${onTrackOrders.length} order(s) on track`}
            </div>
          </div>

          {stalledOrders.length > 0 && (
            <div style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.28)',
              marginBottom: '16px',
              color: '#fecaca',
              fontSize: '0.88rem',
              lineHeight: 1.6,
            }}>
              The deadline is meeting or has passed, but these orders have not been taken further:
              {' '}
              {stalledOrders.map(({ order }) => `#${order.orderNum} (${order.status})`).join(', ')}.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.9fr', gap: '10px', fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
            <div>Order</div>
            <div>Status</div>
            <div>Deadline</div>
            <div>Tracking</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {customerTracking.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 0' }}>No orders to track yet.</div>
            ) : customerTracking.map(({ order, state, stalled }) => {
              const deadline = getDeadlineLabel(state);
              return (
                <div key={order.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.9fr',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: stalled ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${stalled ? 'rgba(239,68,68,0.25)' : 'var(--glass-border)'}`,
                  fontSize: '0.84rem',
                }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>#{order.orderNum} - {order.partName}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>{order.quantity} pcs | {order.material}</div>
                  </div>
                  <div className={`status-badge ${STATUS_COLORS[order.status]}`} style={{ width: 'fit-content' }}>{order.status}</div>
                  <div style={{ color: state === 'overdue' || state === 'due-today' ? '#fecaca' : 'var(--text-muted)', fontWeight: 700 }}>{order.deadline}</div>
                  <div style={{
                    width: 'fit-content',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: deadline.bg,
                    border: `1px solid ${deadline.border}`,
                    color: deadline.color,
                    fontWeight: 800,
                    fontSize: '0.72rem',
                  }}>
                    {stalled ? 'Action needed' : deadline.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {orders.sort((a, b) => b.orderNum - a.orderNum).map((order) => (
          <div key={order.id} className="glass animate-fade-in" style={{ 
            padding: '24px', 
            border: order.qualityNotes.some(q => q.riskFlag === 'high') ? '1px solid rgba(239,68,68,0.4)' : undefined,
            background: order.qualityNotes.some(q => q.riskFlag === 'high') ? 'rgba(239,68,68,0.02)' : undefined
          }}>
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>#{order.orderNum}</span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>{order.partName}</h3>
              </div>
              <div className={`status-badge ${STATUS_COLORS[order.status]}`}>{order.status}</div>
            </div>

            {/* Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="card-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="card-label">Material</span>
                <span className="card-value">{order.material}</span>
              </div>
              <div className="card-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="card-label">Quantity</span>
                <span className="card-value">{order.quantity} pcs</span>
              </div>
              <div className="card-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="card-label">Deadline</span>
                <span className="card-value" style={{ color: isOverdue(order.deadline) ? '#ef4444' : undefined }}>
                  {order.deadline} {isOverdue(order.deadline) && '⚠️'}
                </span>
              </div>
              <div className="card-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="card-label">Specs</span>
                <span className="card-value">{order.specs || 'None'}</span>
              </div>
            </div>

            {/* Progress Flow */}
            <div className="status-flow" style={{ marginBottom: '24px' }}>
              {STATUS_FLOW.map((step, i) => {
                const currentIdx = STATUS_FLOW.indexOf(order.status);
                const isActive = i <= currentIdx;
                return (
                  <React.Fragment key={step}>
                    <div className={`step ${isActive ? 'active' : 'inactive'}`} style={{ 
                      fontSize: '0.65rem', padding: '4px 8px',
                      background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'
                    }}>
                      {step}
                    </div>
                    {i < STATUS_FLOW.length - 1 && <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>→</span>}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Action Button (Mfg Only) */}
            {isManufacturer && order.status !== 'Completed' && onProgressStatus && (
              <button
                className="btn"
                onClick={() => onProgressStatus(order.orderNum)}
                style={{
                  width: '100%', marginBottom: '20px',
                  background: ACTION_COLORS[order.status]?.bg || 'rgba(255,255,255,0.05)',
                  border: `1px solid ${ACTION_COLORS[order.status]?.border || 'var(--glass-border)'}`,
                  color: 'var(--text-main)', fontWeight: 700
                }}
              >
                {ACTION_LABELS[order.status] || 'Update Status'}
              </button>
            )}

            {/* Activity History / Audit Trail */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Traceability Log</div>
              <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {order.auditTrail.slice().reverse().map((entry, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>[{formatDate(entry.timestamp).split(', ')[1]}]</span>
                    <span style={{ color: entry.action.includes('⚠') ? '#ef4444' : 'var(--text-muted)' }}>{entry.action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Notes with Risk Flags */}
            {order.qualityNotes.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>Quality Inspection</div>
                {order.qualityNotes.slice(-2).map((qn, i) => (
                  <div key={i} style={{ 
                    padding: '8px 12px', borderRadius: '8px', marginBottom: '6px',
                    background: qn.riskFlag === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                    border: qn.riskFlag === 'high' ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--glass-border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{qn.note}</span>
                      {qn.riskFlag === 'high' && <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900 }}>CRITICAL RISK</span>}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>Logged {formatDate(qn.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
