import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function BillLedger() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortField, setSortField] = useState('detectedDate');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchBills();
  }, []);

  async function fetchBills() {
    try {
      const res = await axios.get('/bills');
      setBills(res.data.bills || []);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    } finally {
      setLoading(false);
    }
  }

  /** Toggle sort direction or change sort field */
  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  /** Filter and sort bills */
  const filtered = bills
    .filter(b => {
      if (filterType !== 'all' && b.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.merchant?.toLowerCase().includes(q) ||
          b.amount?.toString().includes(q) ||
          b.type?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'amount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const types = ['all', 'bill', 'subscription', 'receipt', 'trial', 'refund'];

  return (
    <div className="section-spacing">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 16 }}>
        Bill Ledger
      </h2>

      {/* Filters Row */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center'
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 16px',
            color: '#F1F5F9', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
            flex: '1 1 200px', minWidth: 200,
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />

        {/* Type Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                border: filterType === type ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.08)',
                background: filterType === type ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: filterType === type ? '#10B981' : '#64748B'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card table-scroll" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div className="skeleton" style={{ width: 120, height: 14 }} />
                <div className="skeleton" style={{ width: 80, height: 14 }} />
                <div className="skeleton" style={{ width: 80, height: 14 }} />
                <div className="skeleton" style={{ width: 100, height: 14 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            {search || filterType !== 'all'
              ? 'No bills match your filters.'
              : 'No bills detected yet. Run a scan to get started.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {[
                  { key: 'merchant', label: 'Merchant' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'type', label: 'Type' },
                  { key: 'billingCycle', label: 'Cycle' },
                  { key: 'detectedDate', label: 'Detected' },
                  { key: 'anomalyFlag', label: 'Status' }
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    {col.label}
                    {sortField === col.key && (
                      <span style={{ marginLeft: 4, fontSize: 10 }}>
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill, i) => (
                <tr
                  key={bill.messageId || i}
                  className={`animate-on-scroll ${bill.anomalyFlag ? 'anomaly-row' : ''}`}
                  style={{ transitionDelay: `${Math.min(i, 10) * 40}ms` }}
                >
                  <td style={{ fontWeight: 600 }}>{bill.merchant || 'Unknown'}</td>
                  <td>
                    <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                      {bill.currency || '₹'} {bill.amount || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      bill.type === 'subscription' ? 'badge-blue' :
                      bill.type === 'trial' ? 'badge-amber' :
                      bill.type === 'refund' ? 'badge-green' : 'badge-blue'
                    }`}>
                      {bill.type || 'unknown'}
                    </span>
                  </td>
                  <td style={{ color: '#64748B', textTransform: 'capitalize' }}>
                    {bill.billingCycle || '—'}
                  </td>
                  <td style={{ color: '#64748B' }}>{bill.detectedDate || '—'}</td>
                  <td>
                    {bill.anomalyFlag ? (
                      <span className="badge badge-amber">⚠ {bill.anomalyFlag}</span>
                    ) : (
                      <span className="badge badge-green">✓ Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 12,
        fontSize: 12, color: '#64748B'
      }}>
        <span>{filtered.length} bill{filtered.length !== 1 ? 's' : ''}</span>
        <span>Sorted by {sortField} ({sortDir})</span>
      </div>
    </div>
  );
}
