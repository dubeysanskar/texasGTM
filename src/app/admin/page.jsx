'use client';
import { useState, useEffect } from 'react';
import { useAuth, DEFAULT_NAV_FEATURES } from '@/context/AuthContext';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle' }}>{name}</span>;

const TABS = [
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'project_access', label: 'Project Access', icon: 'lock_person' },
  { id: 'features', label: 'Features', icon: 'toggle_on' },
  { id: 'settings', label: 'Settings', icon: 'tune' },
];

const ROLES = ['super_admin', 'manager', 'staff', 'marketing', 'viewer'];
const FEATURE_ROLES = ['manager', 'staff', 'marketing', 'viewer'];

// Side-nav features that can be toggled per role. Admin Panel and My Profile are not gated.
const NAV_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'messages', label: 'Messages', icon: 'chat' },
  { key: 'tasks', label: 'Tasks', icon: 'task_alt' },
  { key: 'leads', label: 'Lead Management', icon: 'leaderboard' },
  { key: 'lead_scraper', label: 'Lead Scraper', icon: 'travel_explore' },
  { key: 'templates', label: 'Templates', icon: 'description' },
  { key: 'auto_email', label: 'Auto Email', icon: 'forward_to_inbox' },
  { key: 'team', label: 'Team', icon: 'group' },
  { key: 'marketing', label: 'Marketing', icon: 'campaign' },
  { key: 'documents', label: 'Documents', icon: 'folder_shared' },
  { key: 'logs', label: 'Activity Logs', icon: 'history' },
];

export default function AdminPage() {
  const { user, isAdmin, roleLabels, roleColors } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', project_ids: [], project_role: 'member' });
  const [editUser, setEditUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Settings
  const [roleLabelEdits, setRoleLabelEdits] = useState({});
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Features matrix: { role: [feature keys] }
  const [featureMatrix, setFeatureMatrix] = useState(DEFAULT_NAV_FEATURES);
  const [featuresSaved, setFeaturesSaved] = useState(false);

  // Project Access
  const [projects, setProjects] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allMemberships, setAllMemberships] = useState([]);

  const fetchUsers = () => { fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).finally(() => setLoading(false)); };
  const fetchAllMemberships = () => { fetch('/api/projects/members').then(r => r.json()).then(d => setAllMemberships(d.memberships || [])).catch(() => {}); };

  useEffect(() => {
    fetchUsers(); fetchProjects(); fetchAllMemberships();
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings?.nav_features) {
        try { setFeatureMatrix({ ...DEFAULT_NAV_FEATURES, ...JSON.parse(d.settings.nav_features) }); } catch {}
      }
    }).catch(() => {});
  }, []);
  useEffect(() => { setRoleLabelEdits({ ...roleLabels }); }, [roleLabels]);
  useEffect(() => { if (selectedProject) fetchProjectMembers(selectedProject); }, [selectedProject]);

  const fetchProjects = () => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      setProjects(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0 && !selectedProject) setSelectedProject(d[0].id);
    });
  };

  const fetchProjectMembers = (projectId) => {
    setLoadingMembers(true);
    fetch(`/api/projects/members?project_id=${projectId}`).then(r => r.json()).then(d => setMemberships(d.members || [])).finally(() => setLoadingMembers(false));
  };

  const addMember = async () => {
    if (!selectedUserId || !selectedProject) return;
    setError('');
    const res = await fetch('/api/projects/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(selectedUserId), project_id: selectedProject, role: memberRole }),
    });
    if (res.ok) {
      setSuccess('Member added!'); setTimeout(() => setSuccess(''), 3000);
      fetchProjectMembers(selectedProject);
      fetchAllMemberships();
      setSelectedUserId('');
    } else { const d = await res.json(); setError(d.error); setTimeout(() => setError(''), 3000); }
  };

  const removeMember = async (userId) => {
    if (!confirm('Remove this user from the project?')) return;
    await fetch('/api/projects/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, project_id: selectedProject }),
    });
    setSuccess('Member removed'); setTimeout(() => setSuccess(''), 3000);
    fetchProjectMembers(selectedProject);
    fetchAllMemberships();
  };

  if (!isAdmin) return <div className="page-content"><p>Access denied</p></div>;

  const createUser = async (e) => {
    e.preventDefault(); setError('');
    const payload = { ...form, project_ids: form.role === 'super_admin' ? [] : form.project_ids.map(Number) };
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { setForm({ name: '', email: '', password: '', role: 'staff', project_ids: [], project_role: 'member' }); setShowForm(false); setSuccess('User created!'); fetchUsers(); fetchAllMemberships(); setTimeout(() => setSuccess(''), 3000); }
    else { const d = await res.json(); setError(d.error); setTimeout(() => setError(''), 3000); }
  };

  // Inline project mapping from the Users table
  const addUserToProject = async (userId, projectId) => {
    if (!projectId) return;
    setError('');
    const res = await fetch('/api/projects/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, project_id: Number(projectId), role: 'member' }),
    });
    if (res.ok) { setSuccess('Project assigned!'); setTimeout(() => setSuccess(''), 2000); fetchAllMemberships(); if (selectedProject) fetchProjectMembers(selectedProject); }
    else { const d = await res.json(); setError(d.error); setTimeout(() => setError(''), 3000); }
  };

  const removeUserFromProject = async (userId, projectId, projectName) => {
    if (!confirm(`Remove this user from ${projectName}?`)) return;
    await fetch('/api/projects/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, project_id: projectId }),
    });
    setSuccess('Project removed'); setTimeout(() => setSuccess(''), 2000);
    fetchAllMemberships(); if (selectedProject) fetchProjectMembers(selectedProject);
  };

  const updateUser = async (id, updates) => {
    await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    fetchUsers(); setEditUser(null); setSuccess('Updated!'); setTimeout(() => setSuccess(''), 3000);
  };

  const toggleFeature = (role, featureKey) => {
    setFeatureMatrix(prev => {
      const current = prev[role] || [];
      return {
        ...prev,
        [role]: current.includes(featureKey) ? current.filter(k => k !== featureKey) : [...current, featureKey],
      };
    });
  };

  const saveFeatures = async () => {
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { nav_features: JSON.stringify(featureMatrix) } }),
    });
    if (res.ok) { setFeaturesSaved(true); setTimeout(() => setFeaturesSaved(false), 3000); }
    else { const d = await res.json(); setError(d.error); setTimeout(() => setError(''), 3000); }
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
                {form.role !== 'super_admin' ? (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Projects * (select one or more)</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
                        {projects.map(p => {
                          const checked = form.project_ids.includes(String(p.id)) || form.project_ids.includes(p.id);
                          return (
                            <label key={p.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                              border: checked ? `2px solid ${p.color || '#3b82f6'}` : '1px solid var(--border)',
                              background: checked ? `${p.color || '#3b82f6'}10` : 'transparent',
                              fontSize: '0.8rem', fontWeight: checked ? 700 : 500,
                              color: checked ? (p.color || '#3b82f6') : 'var(--text-dim)',
                            }}>
                              <input
                                type="checkbox" checked={checked} style={{ accentColor: p.color || '#3b82f6' }}
                                onChange={e => setForm(prev => ({
                                  ...prev,
                                  project_ids: e.target.checked
                                    ? [...prev.project_ids, p.id]
                                    : prev.project_ids.filter(id => Number(id) !== p.id),
                                }))}
                              />
                              {p.name}{p.country ? ` — ${p.country}` : ''}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Project Role</label>
                      <select className="form-input" value={form.project_role} onChange={e => setForm(p => ({ ...p, project_role: e.target.value }))}>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    <MI name="info" size={14} /> Super Admins automatically have access to all projects — no project mapping needed.
                  </p>
                )}
                <button type="submit" className="btn btn-success"><MI name="check" size={16} /> Create</button>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Projects</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
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
                      <td>
                        {u.role === 'super_admin' ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8b5cf6' }}>All projects</span>
                        ) : (() => {
                          const userProjects = allMemberships.filter(m => m.user_id === u.id);
                          const available = projects.filter(p => !userProjects.find(m => m.project_id === p.id));
                          return (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                              {userProjects.map(m => (
                                <span key={m.id} style={{ fontSize: '0.68rem', padding: '2px 4px 2px 8px', borderRadius: 12, fontWeight: 600, background: `${m.project_color || '#3b82f6'}15`, color: m.project_color || '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {m.project_name} · {m.role}
                                  <button
                                    onClick={() => removeUserFromProject(u.id, m.project_id, m.project_name)}
                                    title={`Remove from ${m.project_name}`}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 3px', fontSize: '0.75rem', lineHeight: 1, opacity: 0.7 }}
                                  >✕</button>
                                </span>
                              ))}
                              {userProjects.length === 0 && (
                                <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>No project</span>
                              )}
                              {available.length > 0 && (
                                <select
                                  value=""
                                  onChange={e => addUserToProject(u.id, e.target.value)}
                                  title="Assign to project"
                                  style={{ fontSize: '0.68rem', padding: '2px 4px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', maxWidth: 70 }}
                                >
                                  <option value="">+ Add</option>
                                  {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              )}
                            </div>
                          );
                        })()}
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

      {/* ════ PROJECT ACCESS TAB ════ */}
      {activeTab === 'project_access' && (
        <div>
          {/* Project selector */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MI name="folder" size={20} /> Select Project
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: selectedProject === p.id ? `2px solid ${p.color || '#3b82f6'}` : '1px solid #e5e7eb',
                    background: selectedProject === p.id ? `${p.color || '#3b82f6'}10` : '#fff',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: selectedProject === p.id ? 700 : 500,
                    color: selectedProject === p.id ? (p.color || '#3b82f6') : '#6b7280',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || '#3b82f6' }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {selectedProject && (
            <>
              {/* Add member */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MI name="person_add" size={20} /> Add Member
                </h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                    <label>User</label>
                    <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                      <option value="">Select user...</option>
                      {users.filter(u => u.role !== 'super_admin' && !memberships.find(m => m.user_id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Role</label>
                    <select className="form-input" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={addMember} disabled={!selectedUserId}>
                    <MI name="add" size={16} /> Add
                  </button>
                </div>
              </div>

              {/* Members list */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MI name="groups" size={20} /> Members ({memberships.length})
                  </h3>
                </div>
                {loadingMembers ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
                ) : memberships.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
                    <MI name="group_off" size={32} />
                    <div style={{ marginTop: 8 }}>No members assigned to this project yet</div>
                  </div>
                ) : (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table>
                      <thead><tr><th>User</th><th>Email</th><th>System Role</th><th>Project Role</th><th>Added</th><th>Actions</th></tr></thead>
                      <tbody>
                        {memberships.map(m => (
                          <tr key={m.id}>
                            <td><strong>{m.user_name}</strong></td>
                            <td style={{ fontSize: '0.78rem' }}>{m.user_email}</td>
                            <td>
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, background: `${roleColors[m.user_role] || '#6b7280'}15`, color: roleColors[m.user_role] || '#6b7280', fontWeight: 600 }}>
                                {roleLabels[m.user_role] || m.user_role}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, background: '#eff6ff', color: '#1e40af', fontWeight: 600, textTransform: 'capitalize' }}>
                                {m.role}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                            <td>
                              <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={() => removeMember(m.user_id)} title="Remove from project">
                                <MI name="person_remove" size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════ FEATURES TAB ════ */}
      {activeTab === 'features' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><MI name="toggle_on" size={20} /> Feature Access by Role</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6 }}>
            Control which side-nav features each role can see. Changes apply to everyone with that role after their next page refresh.
          </p>
          <p style={{ fontSize: '0.74rem', color: '#8b5cf6', fontWeight: 600, marginBottom: 16 }}>
            <MI name="shield_person" size={14} /> Super Admins always see all features — they are not listed here. Admin Panel and My Profile are never gated.
          </p>
          {featuresSaved && <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#10b981', borderRadius: 10, marginBottom: 16, fontSize: '0.82rem' }}>✅ Feature access saved!</div>}

          <div className="table-container" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Feature</th>
                  {FEATURE_ROLES.map(role => (
                    <th key={role} style={{ textAlign: 'center' }}>
                      <span style={{ color: roleColors[role], fontWeight: 700 }}>{roleLabels[role] || role}</span>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {(featureMatrix[role] || []).length}/{NAV_FEATURES.length} features
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NAV_FEATURES.map(f => (
                  <tr key={f.key}>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      <MI name={f.icon} size={16} /> {f.label}
                    </td>
                    {FEATURE_ROLES.map(role => {
                      const checked = (featureMatrix[role] || []).includes(f.key);
                      return (
                        <td key={role} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeature(role, f.key)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: roleColors[role] }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-success" onClick={saveFeatures}><MI name="save" size={18} /> Save Feature Access</button>
            <button className="btn btn-ghost" onClick={() => setFeatureMatrix(DEFAULT_NAV_FEATURES)} title="Restore the default visibility rules">
              <MI name="restart_alt" size={18} /> Reset to Defaults
            </button>
          </div>
        </div>
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
