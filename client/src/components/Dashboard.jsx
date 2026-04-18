import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardsRef = useRef([]);

  useEffect(() => {
    fetchStats();
    setupScrollAnimations();
  }, []);

  async function fetchStats() {
    try {
      const res = await axios.get('/alerts/stats');
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setStats({ totalBills: 0, totalAlerts: 0, anomalies: 0, moneyProtected: 0 });
    } finally {
      setLoading(false);
    }
  }

  /** IntersectionObserver for scroll animations */
  function setupScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe after a short delay to ensure DOM is ready
    setTimeout(() => {
      document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
      });
    }, 100);

    return () => observer.disconnect();
  }

  const statCards = [
    {
      icon: '📄', label: 'Bills Tracked',
      value: stats?.totalBills || 0,
      color: '#6366F1', bg: 'rgba(99,102,241,0.1)',
      border: '#6366F1'
    },
    {
      icon: '🔔', label: 'Alerts Sent',
      value: stats?.totalAlerts || 0,
      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',
      border: '#F59E0B'
    },
    {
      icon: '⚠️', label: 'Anomalies Found',
      value: stats?.anomalies || 0,
      color: '#EF4444', bg: 'rgba(239,68,68,0.1)',
      border: '#EF4444'
    },
    {
      icon: '🛡️', label: 'Money Protected',
      value: `₹${(stats?.moneyProtected || 0).toLocaleString()}`,
      color: '#10B981', bg: 'rgba(16,185,129,0.1)',
      border: '#10B981'
    }
  ];

  return (
    <div className="section-spacing">
      <h1 style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px',
        marginBottom: 24, color: '#F1F5F9'
      }}>
        Dashboard
      </h1>

      <div className="card-grid">
        {loading ? (
          // Skeleton loaders
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card stat-card">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 80, height: 36, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 120, height: 14 }} />
            </div>
          ))
        ) : (
          statCards.map((card, i) => (
            <div
              key={card.label}
              className="glass-card stat-card animate-on-scroll"
              style={{
                borderBottom: `2px solid ${card.border}`,
                transitionDelay: `${i * 80}ms`
              }}
            >
              <div className="stat-icon" style={{ background: card.bg }}>
                {card.icon}
              </div>
              <div className="stat-number" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
