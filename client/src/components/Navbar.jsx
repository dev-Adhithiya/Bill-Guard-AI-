import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function Navbar({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  async function handleLogout() {
    try {
      await axios.post('/auth/logout');
      if (onLogout) onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  return (
    <nav className="navbar">
      <div style={{
        maxWidth: 1100, margin: '0 auto', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>BillGuard</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>AI</span>
          <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8, fontWeight: 500 }}>🛡️</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="nav-links" style={{
          display: 'flex', alignItems: 'center', gap: 24
        }}>
          <Link to="/" style={{
            textDecoration: 'none', fontSize: 14, fontWeight: 500,
            color: isActive('/') ? '#F1F5F9' : '#64748B',
            borderBottom: isActive('/') ? '2px solid #10B981' : '2px solid transparent',
            paddingBottom: 4, transition: 'all 0.2s'
          }}>Dashboard</Link>

          <Link to="/settings" style={{
            textDecoration: 'none', fontSize: 14, fontWeight: 500,
            color: isActive('/settings') ? '#F1F5F9' : '#64748B',
            borderBottom: isActive('/settings') ? '2px solid #10B981' : '2px solid transparent',
            paddingBottom: 4, transition: 'all 0.2s'
          }}>Settings</Link>

          {/* User Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user?.picture ? (
              <img src={user.picture} alt="" style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.1)'
              }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, color: '#10B981'
              }}>
                {user?.name?.[0] || '?'}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 8,
          display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <span style={{ width: 20, height: 2, background: '#F1F5F9', display: 'block',
            transition: 'transform 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'none' }} />
          <span style={{ width: 20, height: 2, background: '#F1F5F9', display: 'block',
            opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ width: 20, height: 2, background: '#F1F5F9', display: 'block',
            transition: 'transform 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          background: 'rgba(10,15,30,0.98)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <Link to="/" onClick={() => setMenuOpen(false)} style={{
            textDecoration: 'none', fontSize: 15, fontWeight: 500,
            color: isActive('/') ? '#F1F5F9' : '#64748B', padding: '8px 0'
          }}>Dashboard</Link>
          <Link to="/settings" onClick={() => setMenuOpen(false)} style={{
            textDecoration: 'none', fontSize: 15, fontWeight: 500,
            color: isActive('/settings') ? '#F1F5F9' : '#64748B', padding: '8px 0'
          }}>Settings</Link>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', color: '#EF4444',
            fontSize: 15, fontWeight: 500, textAlign: 'left', padding: '8px 0',
            cursor: 'pointer', fontFamily: 'inherit'
          }}>Logout</button>
        </div>
      )}
    </nav>
  );
}
