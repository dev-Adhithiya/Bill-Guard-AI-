import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';
import SetupWizard from './components/SetupWizard';

export default function App() {
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Check authentication status on mount */
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await axios.get('/auth/status');
      setAuthStatus(res.data);
    } catch (err) {
      setAuthStatus({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }

  // Show loading skeleton while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0F1E'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#F1F5F9' }}>
            BillGuard<span style={{ color: '#10B981' }}>AI</span>
          </div>
          <div style={{ color: '#64748B', marginTop: 8, fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    );
  }

  const isAuthenticated = authStatus?.authenticated;

  // Check if setup wizard should show (first login redirect)
  const params = new URLSearchParams(window.location.search);
  const showSetup = params.get('setup') === 'true' && isAuthenticated;

  if (showSetup) {
    return <SetupWizard user={authStatus.user} onComplete={() => {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E' }}>
      {isAuthenticated && <Navbar user={authStatus.user} onLogout={checkAuth} />}
      <Routes>
        <Route path="/" element={
          isAuthenticated ? <Home user={authStatus.user} /> : <Navigate to="/login" />
        } />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <Login />
        } />
        <Route path="/settings" element={
          isAuthenticated ? <Settings user={authStatus.user} onLogout={checkAuth} /> : <Navigate to="/login" />
        } />
      </Routes>
    </div>
  );
}
