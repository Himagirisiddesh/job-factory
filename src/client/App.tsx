import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Chat from './components/Chat';
import { useOrders } from './hooks/useOrders';
import { useInventory } from './hooks/useInventory';
import { useMessages } from './hooks/useMessages';

export type UserRole = 'User' | 'Manufacturer';

const App: React.FC = () => {
  // Detect role based on port (5174 is manufacturer portal)
  const portRole: UserRole = window.location.port === '5173' ? 'Manufacturer' : 'User';
  
  const [user, setUser] = useState<string | null>(localStorage.getItem('precision_user'));
  const [role, setRole] = useState<UserRole>(portRole);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('chat');
  
  const { 
    orders: allOrders, replaceOrders, addOrder, updateStatus, progressStatus, addQualityNote,
    getOrdersByStatus, getOrdersByMaterial, getDelayedOrders,
    getApproachingDeadlines, getQualityIssueOrders, getOrderSummary,
    STATUS_FLOW
  } = useOrders();

  const orders = role === 'Manufacturer' ? allOrders : allOrders.filter(o => o.customerId === user);
  
  const { inventory, checkStock, deductStock } = useInventory();
  const { messages, sendMessage, markRead } = useMessages();

  // Sync role if port changes or storage updates
  useEffect(() => {
    setRole(portRole);
  }, [portRole]);

  const handleLogin = (username: string, userRole: string) => {
    const isMfgChoice = ['Admin', 'Operator', 'Manager'].includes(userRole);
    const targetPort = isMfgChoice ? '5173' : '5174';
    const mappedRole: UserRole = isMfgChoice ? 'Manufacturer' : 'User';

    if (window.location.port !== targetPort) {
      // Redirect to the appropriate port
      localStorage.setItem('precision_user', username);
      localStorage.setItem('precision_role', mappedRole);
      window.location.href = `http://localhost:${targetPort}`;
      return;
    }

    setUser(username);
    setRole(mappedRole);
    localStorage.setItem('precision_user', username);
    localStorage.setItem('precision_role', mappedRole);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('precision_user');
    localStorage.removeItem('precision_role');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className={`app-container role-${role.toLowerCase()}`} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-dark)' }}>
      {/* Sidebar */}
      <aside className="glass" style={{
        width: '260px', minWidth: '260px',
        margin: '16px', marginRight: 0,
        display: 'flex', flexDirection: 'column',
        padding: '28px 18px',
      }}>
        {/* Brand */}
        <div style={{ marginBottom: '36px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: role === 'Manufacturer' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-heading)',
            boxShadow: role === 'Manufacturer' ? '0 4px 12px rgba(245,158,11,0.3)' : '0 4px 12px rgba(99,102,241,0.3)',
          }}>{role === 'Manufacturer' ? 'M' : 'P'}</div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.2 }}>
              {role === 'Manufacturer' ? 'MFG Command' : 'PrecisionManage'}
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 500 }}>
              {role === 'Manufacturer' ? 'Operations Portal' : 'Manufacturing AI'}
            </span>
          </div>
        </div>

        {/* Role badge */}
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: role === 'Manufacturer' ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)',
          border: `1px solid ${role === 'Manufacturer' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
          marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '1rem' }}>{role === 'Manufacturer' ? '🏭' : '📋'}</span>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Access Level</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: role === 'Manufacturer' ? '#fbbf24' : '#818cf8' }}>{role}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('chat')}
            style={{
              justifyContent: 'flex-start',
              background: activeTab === 'chat' ? undefined : 'transparent',
              color: activeTab === 'chat' ? undefined : 'var(--text-muted)',
              fontSize: '0.88rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
            AI Assistant
          </button>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{
              justifyContent: 'flex-start',
              background: activeTab === 'dashboard' ? undefined : 'transparent',
              color: activeTab === 'dashboard' ? undefined : 'var(--text-muted)',
              fontSize: '0.88rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            Dashboard
          </button>
        </nav>

        {/* Info panel */}
        <div style={{
          padding: '14px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
          marginBottom: '16px', fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.6,
        }}>
          {role === 'User' ? (
            <>
              <strong style={{ color: 'var(--text-muted)' }}>Customer Portal</strong><br />
              Port: 5174. Use the AI to place orders and check status.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-muted)' }}>Operations Portal</strong><br />
              Port: 5173. Manage production, quality, and coordination.
            </>
          )}
        </div>

        {/* User + Logout */}
        <div style={{
          borderTop: '1px solid var(--glass-border)', paddingTop: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: role === 'Manufacturer'
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.85rem',
            }}>
              {user.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Portal Indicator Bar */}
        <div style={{
          padding: '12px 30px',
          background: role === 'Manufacturer' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>{role === 'Manufacturer' ? '🏭' : '👤'}</span>
            <span style={{ 
              fontWeight: 800, 
              fontSize: '0.9rem', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              color: role === 'Manufacturer' ? '#fbbf24' : '#818cf8'
            }}>
              {role === 'Manufacturer' ? 'Manufacturer Operations Portal' : 'Customer Self-Service Portal'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
            Session Active • Port {window.location.port}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab === 'dashboard' ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <Dashboard
              orders={orders}
              role={role}
              inventory={inventory}
              onUpdateStatus={updateStatus}
              onProgressStatus={progressStatus}
              STATUS_FLOW={STATUS_FLOW}
            />
          </div>
        ) : (
          <div className="workspace-grid" style={{
            height: '100%',
            display: 'grid',
            gap: '16px',
            padding: '16px',
          }}>
            <section className="glass" style={{ minHeight: 0, overflow: 'hidden' }}>
              <Chat
                user={user!}
                orders={orders}
                role={role}
                onReplaceOrders={replaceOrders}
                onAddOrder={(data) => addOrder({ ...data, customerId: user! })}
                onUpdateStatus={updateStatus}
                onProgressStatus={progressStatus}
                onAddQualityNote={addQualityNote}
                onSwitchTab={() => setActiveTab('dashboard')}
                onCheckStock={checkStock}
                onDeductStock={deductStock}
                // Smart Query props
                getOrdersByStatus={getOrdersByStatus}
                getOrdersByMaterial={getOrdersByMaterial}
                getDelayedOrders={getDelayedOrders}
                getApproachingDeadlines={getApproachingDeadlines}
                getQualityIssueOrders={getQualityIssueOrders}
                getOrderSummary={getOrderSummary}
                // Messaging props
                messages={messages}
                sendMessage={sendMessage}
                markRead={markRead}
              />
            </section>
            <section style={{ minHeight: 0, overflowY: 'auto' }}>
              <Dashboard
                orders={orders}
                role={role}
                inventory={inventory}
                onUpdateStatus={updateStatus}
                onProgressStatus={progressStatus}
                STATUS_FLOW={STATUS_FLOW}
              />
            </section>
          </div>
        )}
      </div>
    </main>
    </div>
  );
};

export default App;
