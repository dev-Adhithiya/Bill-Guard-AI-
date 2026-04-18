import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AlertFeed() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    // Setup scroll animation observer
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    setTimeout(() => {
      document.querySelectorAll('.alert-animate').forEach(el => observer.observe(el));
    }, 200);
    return () => observer.disconnect();
  }, []);

  async function fetchAlerts() {
    try {
      const res = await axios.get('/alerts/recent');
      setAlerts(res.data.alerts?.slice(0, 5) || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  /** Determine severity color class based on alert type */
  function getSeverity(type) {
    if (type === 'price_hike' || type === 'duplicate') return 'severity-red';
    if (type === 'trial_expiry' || type === 'forgotten_sub') return 'severity-amber';
    return 'severity-green';
  }

  /** Get badge style based on alert type */
  function getBadgeClass(type) {
    if (type === 'price_hike' || type === 'duplicate') return 'badge badge-red';
    if (type === 'trial_expiry' || type === 'forgotten_sub') return 'badge badge-amber';
    return 'badge badge-blue';
  }

  /** Format the alert type for display */
  function formatType(type) {
    const labels = {
      price_hike: 'Price Hike',
      duplicate: 'Duplicate',
      trial_expiry: 'Trial Ending',
      forgotten_sub: 'Unused Sub',
      dismiss: 'Dismissed',
      snooze: 'Snoozed'
    };
    return labels[type] || type;
  }

  /** Format date for display */
  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHrs < 1) return 'Just now';
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  return (
    <div className="section-spacing">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>
          Recent Alerts
        </h2>
        <span style={{ fontSize: 12, color: '#64748B' }}>
          Last {alerts.length} alerts
        </span>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        {loading ? (
          // Skeleton rows
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="skeleton" style={{ width: 150, height: 14, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: 250, height: 12 }} />
                </div>
                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 20 }} />
              </div>
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            color: '#64748B', fontSize: 14
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 600, color: '#10B981', marginBottom: 4 }}>All clear!</div>
            <div>No alerts yet. BillGuard is watching silently.</div>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div
              key={i}
              className={`alert-item ${getSeverity(alert.alertType)} alert-animate animate-on-scroll`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: '#F1F5F9', marginBottom: 4
                }}>
                  {alert.merchant || 'Unknown'}
                </div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.4 }}>
                  {alert.message || 'Alert detected'}
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
                flexShrink: 0
              }}>
                <span className={getBadgeClass(alert.alertType)}>
                  {formatType(alert.alertType)}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  {formatDate(alert.alertDate)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
