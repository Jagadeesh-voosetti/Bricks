import React from 'react';
import { LogOut, Globe, User } from 'lucide-react';

export default function Header({ lang, setLang, t, user, onLogout }) {
  return (
    <header className="top-header">
      <div className="header-inner">
        <div className="brand-wrapper">
          <div className="brand-icon">🧱</div>
          <div>
            <div className="brand-title">
              Bricks<span className="brand-accent">-Land</span>
            </div>
            <div className="brand-badge">{t.location}</div>
          </div>
        </div>

        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={18} color="#ffd8bf" />
            <select
              className="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Select Language"
            >
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.12)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#ffffff'
                }}
              >
                <User size={15} color="#ff9d4d" />
                <span>
                  {user.user_metadata?.full_name || user.phone || 'User'}
                </span>
              </div>
              <button
                className="btn-logout"
                onClick={onLogout}
                title={t.logout}
              >
                <LogOut size={16} />
                <span>{t.logout}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
