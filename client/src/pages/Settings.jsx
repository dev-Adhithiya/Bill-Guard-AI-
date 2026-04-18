import React, { useState } from 'react';
import axios from 'axios';

export default function Settings({ user, onLogout }) {
  const [prefs, setPrefs] = useState({
    priceHike: true,
    duplicate: true,
    trialExpiry: true,
    forgottenSub: true,
    threshold: 20
  });
  const [saved, setSaved] = useState(false);

  function togglePref(key) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    // Preferences are stored client-side for hackathon scope
    localStorage.setItem('billguard_prefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    try {
      await axios.post('/auth/logout');
      if (onLogout) onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  async function handleGenerateDigest() {
    try {
      const res = await axios.post('/digest/generate');
      if (res.data.success) {
        alert(`Digest generated! ${res.data.digest.totalBills} bills processed. Check your Drive.`);
      }
    } catch (err) {
      alert('Failed to generate digest: ' + (err.response?.data?.message || err.message));
    }
  }

  /** Toggle switch component */
  function Toggle({ checked, onChange }) {
    return (
      <button
        onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2,
          background: checked ? '#10B981' : 'rgba(255,255,255,0.1)',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s',
          position: 'relative', flexShrink: 0
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(20px)' : 'translateX(0)'
        }} />
      </button>
    );
  }

  return (
    <main className="page-container" style={{ maxWidth: 640 }}>
      <h1 style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px',
        marginBottom: 32, color: '#F1F5F9'
      }}>Settings</h1>

      {/* ─── Connected Account ─────────────────────── */}
      <div className="glass-card section-spacing" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#F1F5F9' }}>
          Connected Account
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid rgba(16,185,129,0.3)'
            }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#10B981'
            }}>
              {user?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>
              {user?.name || 'Google User'}
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              {user?.email || 'No email'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Alert Preferences ─────────────────────── */}
      <div className="glass-card section-spacing" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#F1F5F9' }}>
          Alert Preferences
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { key: 'priceHike', label: 'Price Hike Alerts', desc: 'When a merchant charges more than usual', icon: '📈' },
            { key: 'duplicate', label: 'Duplicate Charge Alerts', desc: 'When the same charge appears multiple times', icon: '⚠️' },
            { key: 'trialExpiry', label: 'Trial Expiry Warnings', desc: 'When a free trial is about to end', icon: '⏰' },
            { key: 'forgottenSub', label: 'Unused Subscription Alerts', desc: 'Subscriptions you may have forgotten', icon: '💤' }
          ].map(pref => (
            <div key={pref.key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 18 }}>{pref.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>{pref.label}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{pref.desc}</div>
                </div>
              </div>
              <Toggle checked={prefs[pref.key]} onChange={() => togglePref(pref.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Sensitivity Threshold ────────────────── */}
      <div className="glass-card section-spacing" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#F1F5F9' }}>
          Price Hike Sensitivity
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
          Alert when a charge exceeds the average by this percentage.
          Lower values = more sensitive.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="range"
            min="5" max="50" step="5"
            value={prefs.threshold}
            onChange={e => {
              setPrefs(prev => ({ ...prev, threshold: parseInt(e.target.value) }));
              setSaved(false);
            }}
            style={{
              flex: 1, height: 4, appearance: 'none',
              background: `linear-gradient(to right, #10B981 ${(prefs.threshold - 5) / 45 * 100}%, rgba(255,255,255,0.1) 0%)`,
              borderRadius: 4, outline: 'none', cursor: 'pointer'
            }}
          />
          <div style={{
            minWidth: 48, textAlign: 'center', fontSize: 18,
            fontWeight: 800, color: '#10B981'
          }}>
            {prefs.threshold}%
          </div>
        </div>
      </div>

      {/* ─── Actions ──────────────────────────────── */}
      <div className="glass-card section-spacing" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#F1F5F9' }}>
          Actions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" onClick={handleSave} style={{ width: '100%' }}>
            {saved ? '✓ Saved!' : 'Save Preferences'}
          </button>
          <button className="btn-ghost" onClick={handleGenerateDigest} style={{ width: '100%' }}>
            📄 Generate Monthly Digest Now
          </button>
          <button className="btn-danger" onClick={handleLogout} style={{ width: '100%' }}>
            Disconnect & Logout
          </button>
        </div>
      </div>
    </main>
  );
}
