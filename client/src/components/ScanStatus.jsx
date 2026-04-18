import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ScanStatus() {
  const [status, setStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    fetchStatus();
    // Refresh countdown every minute
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status?.nextScan) updateCountdown();
  }, [status]);

  async function fetchStatus() {
    try {
      const res = await axios.get('/scan/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch scan status:', err);
    }
  }

  /** Update the countdown timer to next scan */
  function updateCountdown() {
    if (!status?.nextScan) {
      setCountdown('No scan scheduled');
      return;
    }
    const next = new Date(status.nextScan);
    const now = new Date();
    const diffMs = next - now;

    if (diffMs <= 0) {
      setCountdown('Scan overdue');
      return;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    setCountdown(`${hours}h ${mins}m`);
  }

  /** Trigger a manual scan */
  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await axios.post('/scan/run');
      setScanResult(res.data.results);
      await fetchStatus(); // Refresh timestamps
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setScanResult({ error: msg });
    } finally {
      setScanning(false);
    }
  }

  /** Format date for display */
  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  return (
    <div className="section-spacing">
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16
        }}>
          {/* Scan Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: scanning ? '#F59E0B' : '#10B981',
                boxShadow: `0 0 8px ${scanning ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.5)'}`,
                animation: scanning ? 'pulse 1s infinite' : 'none'
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>
                {scanning ? 'Scanning...' : 'Scanner Active'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Last Scan
                </div>
                <div style={{ fontSize: 14, color: '#F1F5F9', fontWeight: 500 }}>
                  {formatDate(status?.lastScan)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Next Scan In
                </div>
                <div style={{ fontSize: 14, color: '#10B981', fontWeight: 600 }}>
                  {countdown || 'Calculating...'}
                </div>
              </div>
            </div>
          </div>

          {/* Run Scan Button */}
          <button
            className="btn-primary"
            onClick={runScan}
            disabled={scanning}
            style={{
              opacity: scanning ? 0.6 : 1,
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            {scanning ? (
              <>
                <span style={{
                  width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', display: 'inline-block'
                }} />
                Scanning...
              </>
            ) : (
              <>🔍 Run Scan Now</>
            )}
          </button>
        </div>

        {/* Scan Result Toast */}
        {scanResult && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 10,
            background: scanResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${scanResult.error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
            fontSize: 13
          }}>
            {scanResult.error ? (
              <span style={{ color: '#EF4444' }}>⚠️ {scanResult.error}</span>
            ) : (
              <span style={{ color: '#10B981' }}>
                ✅ Found {scanResult.emailsFound} emails → {scanResult.newBills} new bills
                {scanResult.anomalies > 0 && ` → ${scanResult.anomalies} anomalies`}
                {scanResult.alertsSent > 0 && ` → ${scanResult.alertsSent} alerts sent`}
                {' '}({Math.round(scanResult.duration / 1000)}s)
              </span>
            )}
          </div>
        )}
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
