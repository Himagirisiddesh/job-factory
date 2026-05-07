import React, { useEffect } from 'react';

export interface ToastData {
  id: string;
  type: 'email' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  to?: string;
}

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastData['type'], string> = {
  email: '📧',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
};

const COLORS: Record<ToastData['type'], { bg: string; border: string }> = {
  email: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
};

const Toast: React.FC<{ toast: ToastData; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const colors = COLORS[toast.type];

  return (
    <div
      style={{
        background: colors.bg,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        minWidth: '320px',
        maxWidth: '420px',
        animation: 'slideInRight 0.4s var(--ease) forwards',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={onDismiss}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{ICONS[toast.type]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>{toast.title}</div>
          {toast.to && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
              To: {toast.to}
            </div>
          )}
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{toast.message}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem', padding: '2px' }}
        >×</button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
};

export default ToastContainer;
