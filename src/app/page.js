'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('login'); // login | register | forgot | otp
  const [regName, setRegName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [isAdminOtp, setIsAdminOtp] = useState(false);
  const [projects, setProjects] = useState([]);
  const [regProjectId, setRegProjectId] = useState('');

  useEffect(() => { if (!loading && user) router.push('/dashboard'); }, [user, loading, router]);

  // Load projects for the signup "Project Allotment" dropdown
  useEffect(() => {
    if (mode !== 'register' || projects.length) return;
    fetch('/api/projects/public').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
  }, [mode, projects.length]);

  // Check if email is admin — send OTP directly (no password)
  const checkEmailAndProceed = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setSubmitting(true);

    try {
      // First check if this email is an admin (recognized user)
      const checkRes = await fetch('/api/auth/check-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const checkData = await checkRes.json();

      if (checkData.is_admin) {
        // Admin: send OTP directly, no password needed
        const otpRes = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, purpose: 'admin_login' }) });
        if (otpRes.ok) {
          setOtpEmail(email);
          setIsAdminOtp(true);
          setMode('otp');
          setSuccess('Verification code sent to your email');
        } else {
          const d = await otpRes.json();
          setError(d.error || 'Failed to send OTP');
        }
      } else if (checkData.exists) {
        // Regular user: need password
        setMode('password');
      } else {
        setError('No account found with this email');
      }
    } catch { setError('Network error'); }
    setSubmitting(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Send OTP for 2-step verification
      const otpRes = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, purpose: 'login' }) });
      if (otpRes.ok) {
        setOtpEmail(email);
        setIsAdminOtp(false);
        setMode('otp');
        setSuccess('Verification code sent to your email');
      } else {
        // If OTP fails, proceed with login
        await login(email, password);
        router.push('/dashboard');
      }
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/auth/otp/send', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: otpEmail, otp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('gtm-user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  };

  const resendOtp = async () => {
    setError(''); setSuccess('');
    const res = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: otpEmail }) });
    if (res.ok) setSuccess('New code sent!'); else setError('Failed to resend');
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: regName, email, password, project_id: Number(regProjectId) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await login(email, password);
      router.push('/dashboard');
    } catch (err) { setError(err.message); }
    setSubmitting(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) setSuccess('If that email exists, a reset link has been sent.');
    } catch { setError('Network error'); }
    setSubmitting(false);
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (user) return null;

  return (
    <div className="login-page">
      {/* ═══ Branded panel ═══ */}
      <div className="login-brand">
        <div className="login-brand-top">
          <img src="/logo.png" alt="TexasGTM" />
          <span>TexasGTM</span>
        </div>
        <div className="login-brand-hero">
          <h2>Go-to-market intelligence,<br />built for every region.</h2>
          <p>Manage leads, campaigns, and your team across Arabic, Russian, and global markets — all in one workspace.</p>
          <div className="login-brand-features">
            <div className="login-brand-feature"><span className="material-symbols-outlined">leaderboard</span> Track and score leads by region</div>
            <div className="login-brand-feature"><span className="material-symbols-outlined">forward_to_inbox</span> Automate multilingual outreach</div>
            <div className="login-brand-feature"><span className="material-symbols-outlined">groups</span> Role-based access for your whole team</div>
          </div>
        </div>
        <div className="login-brand-footer">© {new Date().getFullYear()} Taha Airwaves · TexasGTM CRM</div>
      </div>

      {/* ═══ Form panel ═══ */}
      <div className="login-form-panel">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="TexasGTM" />
          <h1>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
          <p>{mode === 'login' ? 'Enter your email to continue' : mode === 'password' ? 'Enter your password' : mode === 'register' ? 'Join your team workspace' : mode === 'forgot' ? 'Reset your password' : isAdminOtp ? 'Admin verification' : 'Enter verification code'}</p>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 16, textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#10b981', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 16, textAlign: 'center' }}>{success}</div>}

        {/* STEP 1: Email check */}
        {mode === 'login' && (
          <form onSubmit={checkEmailAndProceed}>
            <div className="form-group"><label>Email</label><input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem', marginTop: 8 }}>
              {submitting ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {/* STEP 2: Password (non-admin users) */}
        {mode === 'password' && (
          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.82rem', color: '#6366f1', fontWeight: 600 }}>{email}</span>
              <button type="button" onClick={() => { setMode('login'); setError(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer' }}>Change</button>
            </div>
            <div className="form-group"><label>Password</label><input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></div>
            <div style={{ textAlign: 'right', marginBottom: 12 }}>
              <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Forgot password?</button>
            </div>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* OTP VERIFICATION */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpVerify}>
            <p style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'center', marginBottom: 16 }}>
              {isAdminOtp ? '🔐 Admin login — ' : ''}We sent a 6-digit code to <strong>{otpEmail}</strong>
            </p>
            <div className="form-group">
              <label>Verification Code</label>
              <input className="form-input" type="text" placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required maxLength={6} style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: 8, fontWeight: 700 }} autoFocus />
            </div>
            <button type="submit" disabled={submitting || otp.length !== 6} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }}>
              {submitting ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.78rem' }}>
              <button type="button" onClick={resendOtp} style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 600, cursor: 'pointer' }}>Resend Code</button>
              <span style={{ margin: '0 8px', color: '#e2e8f0' }}>|</span>
              <button type="button" onClick={() => { setMode('login'); setOtp(''); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Back</button>
            </div>
          </form>
        )}

        {/* REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group"><label>Full Name</label><input className="form-input" placeholder="John Doe" value={regName} onChange={e => setRegName(e.target.value)} required /></div>
            <div className="form-group"><label>Email</label><input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="form-group"><label>Password</label><input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <div className="form-group">
              <label>Project Allotment</label>
              <select className="form-input" value={regProjectId} onChange={e => setRegProjectId(e.target.value)} required>
                <option value="">Select your project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.country ? ` — ${p.country}` : ''}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting || !regProjectId} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem', marginTop: 8 }}>
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <div className="form-group"><label>Email</label><input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem', marginTop: 8 }}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* Toggle links */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.82rem', color: '#94a3b8' }}>
          {(mode === 'login' || mode === 'password') && <>Don't have an account? <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }} style={{ color: '#6366f1', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Sign Up</button></>}
          {mode === 'register' && <>Already have an account? <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{ color: '#6366f1', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Sign In</button></>}
          {mode === 'forgot' && <><button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{ color: '#6366f1', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>← Back to Sign In</button></>}
        </div>
      </div>
      </div>
    </div>
  );
}
