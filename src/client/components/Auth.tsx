import React, { useState } from 'react';

interface AuthProps {
  onLogin: (user: string, role: string) => void;
}

const VALID_USERS: Record<string, { password: string; role: string }> = {
  // Manufacturer / Operations side
  admin:    { password: 'admin123',    role: 'Admin' },
  operator: { password: 'ops2024',     role: 'Operator' },
  // Customer / User side
  customer: { password: 'cust2024',    role: 'Customer' },
  user:     { password: 'user1234',    role: 'Customer' },
};

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = VALID_USERS[username.toLowerCase()];
    if (user && user.password === password) {
      onLogin(username, user.role);
    } else {
      setError('Invalid username or password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      position: 'relative',
    }}>
      {/* Animated orb background */}
      <div className="auth-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div
        className="glass"
        style={{
          padding: '48px 40px',
          maxWidth: '420px',
          width: '90%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          animation: shake ? 'shake 0.4s ease-in-out' : 'fadeInUp 0.6s var(--ease) forwards',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '1.5rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
          }}>P</div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: '6px',
            background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>PrecisionManage</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Conversational Manufacturing Intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</label>
            <input
              id="login-username"
              type="text"
              className="input-field"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              animation: 'fadeIn 0.3s ease',
            }}>{error}</div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '6px', height: '48px', fontSize: '0.95rem' }}
          >
            Sign In →
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--glass-border)',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Demo Credentials</p>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>customer / cust2024</span>
              <span style={{ color: '#818cf8', fontSize: '0.72rem', fontWeight: 600 }}>User</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>admin / admin123</span>
              <span style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600 }}>Manufacturer</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>operator / ops2024</span>
              <span style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600 }}>Manufacturer</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default Auth;
