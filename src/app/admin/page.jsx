'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle' }}>{name}</span>;

const TABS = [
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'settings', label: 'Settings', icon: 'tune' },
];

const ROLES = ['super_admin', 'manager', 'staff', 'marketing', 'viewer'];

export default function AdminPage() {
  const { user, isAdmin, roleLabels, roleColors } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [editUser, setEditUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Settings
  const [roleLabelEdits, setRoleLabelEdits] = useState({});
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchUsers = () => { fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).finally(() => setLoading(false)); };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { setRoleLabelEdits({ ...roleLabels }); }, [roleLabels]);

  if (!isAdmin) return <div className="page-content"><p>Access denied</p></div>;

  const createUser = async (e) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setForm({ name: '', email: '', password: '', role: 'staff' }); setShowForm(false); setSuccess('User created!'); fetchUsers(); setTimeout(() => setSuccess(''), 3000); }
    else { const d = await res.json(); setError(d.error); setTimeout(() => setError(''), 3000); }
  };

  const updateUser = async (id, updates) => {
    await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    fetchUsers(); setEditUser(null); setSuccess('Updated!'); setTimeout(() => setSuccess(''), 3000);
  };

  const saveRoleLabels = async () => {
    const settings = {};
    for (const [role, label] of Object.entries(roleLabelEdits)) {
      settings[`role_label_${role}`] = label;
    }
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
    if (res.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1><MI name="settings" size={26} /> Admin Panel</h1><p>Manage users, roles, and system settings</p></div>
        {activeTab === 'users' && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><MI name={showForm ? 'close' : 'person_add'} size={16} /> {showForm ? 'Cancel' : 'Add User'}</button>}
      </div>

      {success && <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#10b981', borderRadius: 10, marginBottom: 12, fontSize: '0.82rem' }}>{success}</div>}
      {error && <div style={{ padding: '10px 16px', background: '#fef2f2', color: '#ef4444', borderRadius: 10, marginBottom: 12, fontSize: '0.82rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 18px', border: 'none', background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-dim)',
            fontWeight: activeTab === tab.id ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer',
            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            <MI name={tab.icon} size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ════ USERS TAB ════ */}
      {activeTab === 'users' && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${ROLES.length}, 1fr)`, marginBottom: 20 }}>
            {ROLES.map(r => (
              <div key={r} className="stat-card" style={{ borderTopColor: roleColors[r] }}>
                <div className="stat-value" style={{ color: roleColors[r] }}>{users.filter(u => u.role === r).length}</div>
                <div className="stat-label">{roleLabels[r] || r}</div>
              </div>
            ))}
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: 16, animation: 'slideUp 0.2s ease' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 16 }}>Create New User</h3>
              <form onSubmit={createUser}>
                <div className="form-row">
                  <div className="form-group"><label>Full Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="form-group"><label>Email *</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Password *</label><input type="password" className="form-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required /></div>
                  <div className="form-group"><label>Role</label><select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{roleLabels[r] || r}</option>)}</select></div>
                </div>
                <button type="submit" className="btn btn-success"><MI name="check" size={16} /> Create</button>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ fontSize: '0.78rem' }}>{u.email}</td>
                      <td>
                        {editUser === u.id ? (
                          <select defaultValue={u.role} onChange={e => updateUser(u.id, { role: e.target.value })} style={{ fontSize: '0.75rem', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 8 }}>
                            {ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: `${roleColors[u.role]}15`, color: roleColors[u.role] }}>{roleLabels[u.role] || u.role}</span>
                        )}
                      </td>
                      <td><span style={{ fontSize: '0.72rem', fontWeight: 600, color: u.is_active ? '#10b981' : '#ef4444' }}>{u.is_active ? '● Active' : '○ Disabled'}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditUser(editUser === u.id ? null : u.id)} title="Edit role"><MI name="edit" size={14} /></button>
                          {u.id !== user.id && (
                            <>
                              <button className="btn btn-sm btn-ghost" style={{ color: u.is_active ? '#ef4444' : '#10b981' }} onClick={() => updateUser(u.id, { is_active: !u.is_active })} title={u.is_active ? 'Disable' : 'Enable'}>
                                <MI name={u.is_active ? 'block' : 'check_circle'} size={14} />
                              </button>
                              <button className="btn btn-sm btn-ghost" onClick={() => updateUser(u.id, { password: prompt('New password:') })} title="Reset password"><MI name="lock_reset" size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════ SETTINGS TAB ════ */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><MI name="badge" size={20} /> Role Labels</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 20 }}>Rename roles to match your organization. Changes apply across the entire app.</p>
          {settingsSaved && <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#10b981', borderRadius: 10, marginBottom: 16, fontSize: '0.82rem' }}>✅ Role labels saved!</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {ROLES.map(role => (
              <div className="form-group" key={role}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{role.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>role: {role}</span>
                </label>
                <input className="form-input" value={roleLabelEdits[role] || ''} onChange={e => setRoleLabelEdits(p => ({ ...p, [role]: e.target.value }))} placeholder={`Display name for ${role}`} />
              </div>
            ))}
          </div>
          <button className="btn btn-success" onClick={saveRoleLabels}><MI name="save" size={18} /> Save Role Labels</button>
        </div>
      )}
    </div>
  );
}
