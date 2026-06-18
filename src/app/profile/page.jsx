'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle' }}>{name}</span>;

export default function ProfilePage() {
  const { roleLabel, roleColor } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { fetch('/api/profile').then(r => r.json()).then(d => { setProfile(d.profile); setForm(d.profile || {}); }); }, []);

  const save = async () => {
    await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(false); setMsg('Profile updated'); setTimeout(() => setMsg(''), 3000);
  };

  const changePw = async () => {
    const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pwForm) });
    if (res.ok) { setMsg('Password changed'); setPwForm({ current_password: '', new_password: '' }); } else { const d = await res.json(); setMsg(d.error); }
    setTimeout(() => setMsg(''), 3000);
  };

  if (!profile) return <div className="page-content"><div className="skeleton" style={{ height: 300, borderRadius: 12 }} /></div>;

  return (
    <div className="page-content">
      <div className="page-header"><h1><MI name="person" size={26} /> My Profile</h1></div>
      {msg && <div style={{ padding: '10px 16px', background: msg.includes('error') || msg.includes('incorrect') ? '#fef2f2' : '#f0fdf4', color: msg.includes('error') || msg.includes('incorrect') ? '#ef4444' : '#10b981', borderRadius: 10, marginBottom: 16, fontSize: '0.82rem' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: roleColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>{profile.name?.charAt(0)}</div>
            <div><h2 style={{ fontSize: '1.1rem' }}>{profile.name}</h2><span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: 20, background: `${roleColor}15`, color: roleColor, fontWeight: 600 }}>{roleLabel}</span></div>
          </div>
          {editing ? (
            <>
              <div className="form-group"><label>Name</label><input className="form-input" value={form.name || ''} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="form-group"><label>Company</label><input className="form-input" value={form.company || ''} onChange={e => setForm(p => ({...p, company: e.target.value}))} /></div>
              <div className="form-group"><label>Phone</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="form-group"><label>Bio</label><textarea className="form-input" rows={3} value={form.bio || ''} onChange={e => setForm(p => ({...p, bio: e.target.value}))} /></div>
              <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-success" onClick={save}>Save</button><button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button></div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', lineHeight: 2 }}><p><strong>Email:</strong> {profile.email}</p><p><strong>Company:</strong> {profile.company || '—'}</p><p><strong>Phone:</strong> {profile.phone || '—'}</p><p><strong>Bio:</strong> {profile.bio || '—'}</p><p><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</p></div>
              <button className="btn btn-info" style={{ marginTop: 12 }} onClick={() => setEditing(true)}><MI name="edit" size={14} /> Edit Profile</button>
            </>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 16 }}><MI name="lock" size={18} /> Change Password</h3>
          <div className="form-group"><label>Current Password</label><input type="password" className="form-input" value={pwForm.current_password} onChange={e => setPwForm(p => ({...p, current_password: e.target.value}))} /></div>
          <div className="form-group"><label>New Password</label><input type="password" className="form-input" value={pwForm.new_password} onChange={e => setPwForm(p => ({...p, new_password: e.target.value}))} /></div>
          <button className="btn btn-primary" onClick={changePw} disabled={!pwForm.current_password || !pwForm.new_password}>Update Password</button>
        </div>
      </div>
    </div>
  );
}
