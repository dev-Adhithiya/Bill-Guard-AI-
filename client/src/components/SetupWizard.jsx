import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function SetupWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const totalSteps = 5;

  /** Step 3: Create the Google Sheets ledger */
  async function createSheet() {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/sheets/url');
      setSheetUrl(res.data.url);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ledger. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /** Step 4: Run first scan */
  async function runFirstScan() {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/scan/run');
      setScanResult(res.data.results);
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Scan failed. You can retry from the dashboard.');
      setStep(5); // Still advance — scan can be retried later
    } finally {
      setLoading(false);
    }
  }

  /** Renders the step indicators at the top */
  function StepIndicators() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        {Array.from({ length: totalSteps }).map((_, i) => {
          const num = i + 1;
          let className = 'step-indicator ';
          if (num < step) className += 'step-completed';
          else if (num === step) className += 'step-current';
          else className += 'step-upcoming';

          return (
            <React.Fragment key={num}>
              <div className={className}>
                {num < step ? '✓' : num}
              </div>
              {num < totalSteps && (
                <div style={{
                  flex: 1, height: 2,
                  background: num < step ? '#10B981' : 'rgba(255,255,255,0.08)',
                  borderRadius: 2
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="wizard-container">
      {/* Progress Bar */}
      <div className="wizard-progress">
        <div className="wizard-progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>

      <StepIndicators />

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#EF4444', fontSize: 13
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ─── Step 1: Welcome ─────────────────────────── */}
      {step === 1 && (
        <div className="wizard-step">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Welcome to BillGuard<span style={{ color: '#10B981' }}>AI</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            Your silent financial watchdog. BillGuard monitors your email for bills,
            subscriptions, and charges — alerting you only when action is genuinely needed.
          </p>

          <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 12 }}>
              What we'll need access to:
            </div>
            {[
              { icon: '📧', label: 'Gmail', desc: 'Read financial emails & send alerts' },
              { icon: '📊', label: 'Google Sheets', desc: 'Store your bill ledger' },
              { icon: '📁', label: 'Google Drive', desc: 'Save monthly PDF reports' },
              { icon: '📅', label: 'Google Calendar', desc: 'Check subscription usage' }
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={() => setStep(2)} style={{ width: '100%' }}>
            Get Started →
          </button>
        </div>
      )}

      {/* ─── Step 2: Already Logged In ────────────────── */}
      {step === 2 && (
        <div className="wizard-step">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(16,185,129,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 28
            }}>
              ✅
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Connected Successfully!
            </h2>
            <p style={{ color: '#64748B', fontSize: 14 }}>
              Signed in as <span style={{ color: '#10B981', fontWeight: 600 }}>{user?.email || 'you'}</span>
            </p>
          </div>

          {user?.picture && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <img src={user.picture} alt="" style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '2px solid rgba(16,185,129,0.3)'
              }} />
            </div>
          )}

          <button className="btn-primary" onClick={() => {
            setStep(3);
            createSheet();
          }} style={{ width: '100%' }}>
            Create Bill Ledger →
          </button>
        </div>
      )}

      {/* ─── Step 3: Creating Ledger ──────────────────── */}
      {step === 3 && (
        <div className="wizard-step" style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            border: '3px solid rgba(16,185,129,0.3)', borderTopColor: '#10B981',
            borderRadius: '50%', animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Creating your BillGuard Ledger...
          </h2>
          <p style={{ color: '#64748B', fontSize: 14 }}>
            Setting up your Google Sheets data store
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ─── Step 4: Ledger Created → First Scan ──────── */}
      {step === 4 && (
        <div className="wizard-step">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Ledger Created!
            </h2>
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" style={{
                color: '#10B981', fontSize: 13, textDecoration: 'underline'
              }}>
                View in Google Sheets ↗
              </a>
            )}
          </div>

          <p style={{
            color: '#64748B', fontSize: 14, textAlign: 'center',
            marginBottom: 24, lineHeight: 1.5
          }}>
            Now let's run your first scan to find financial emails
            from the last 7 days.
          </p>

          <button
            className="btn-primary"
            onClick={runFirstScan}
            disabled={loading}
            style={{ width: '100%', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '🔍 Scanning your inbox...' : '🔍 Run First Scan'}
          </button>
        </div>
      )}

      {/* ─── Step 5: Done ────────────────────────────── */}
      {step === 5 && (
        <div className="wizard-step">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              You're All Set!
            </h2>
            <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.5 }}>
              BillGuard AI is now watching your inbox silently.
              You'll only hear from us when action is needed.
            </p>
          </div>

          {scanResult && !scanResult.error && (
            <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 12 }}>
                First Scan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Emails Found', value: scanResult.emailsFound, color: '#6366F1' },
                  { label: 'Bills Detected', value: scanResult.newBills, color: '#10B981' },
                  { label: 'Anomalies', value: scanResult.anomalies, color: '#F59E0B' },
                  { label: 'Alerts Sent', value: scanResult.alertsSent, color: '#EF4444' }
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card" style={{ padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              ⏰ <strong style={{ color: '#F1F5F9' }}>Automatic scans</strong> run every 6 hours<br/>
              📊 <strong style={{ color: '#F1F5F9' }}>Weekly check</strong> for forgotten subscriptions<br/>
              📄 <strong style={{ color: '#F1F5F9' }}>Monthly digest</strong> PDF saved to Drive
            </div>
          </div>

          <button className="btn-primary" onClick={onComplete} style={{ width: '100%' }}>
            Go to Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
