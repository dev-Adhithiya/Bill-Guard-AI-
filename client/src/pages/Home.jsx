import React from 'react';
import Dashboard from '../components/Dashboard';
import ScanStatus from '../components/ScanStatus';
import AlertFeed from '../components/AlertFeed';
import BillLedger from '../components/BillLedger';

export default function Home() {
  return (
    <main className="page-container">
      <Dashboard />
      <ScanStatus />
      <AlertFeed />
      <BillLedger />
    </main>
  );
}
