'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProject } from '@/context/ProjectContext';
import NotificationBell from './NotificationBell';
import { useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isManager, isStaff, logout, roleLabel, roleColor } = useAuth();
  const { projects, activeProject, setActiveProject, createProject } = useProject();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', country: '', color: '#3B82F6' });
  const [creating, setCreating] = useState(false);

  const PROJECT_COLORS = ['#DC2626','#EA580C','#D97706','#16A34A','#0D9488','#2563EB','#7C3AED','#DB2777','#4B5563'];

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', show: true },
    { href: '/messages', label: 'Messages', icon: 'chat', show: true },
    { href: '/tasks', label: 'Tasks', icon: 'task_alt', show: isStaff },
    { href: '/leads', label: 'Lead Management', icon: 'leaderboard', show: isManager },
    { href: '/lead-scraper', label: 'Lead Scraper', icon: 'travel_explore', show: isAdmin },
    { href: '/templates', label: 'Templates', icon: 'description', show: isAdmin },
    { href: '/auto-email', label: 'Auto Email', icon: 'forward_to_inbox', show: isAdmin || user?.role === 'marketing' },
    { href: '/team', label: 'Team', icon: 'group', show: isManager },
    { href: '/marketing', label: 'Marketing', icon: 'campaign', show: isAdmin || user?.role === 'marketing' },
    { href: '/shared-docs', label: 'Documents', icon: 'folder_shared', show: isStaff },
    { href: '/logs', label: 'Activity Logs', icon: 'history', show: isAdmin },
    { href: '/admin', label: 'Admin Panel', icon: 'settings', show: isAdmin },
    { href: '/profile', label: 'My Profile', icon: 'person', show: true },
  ];

  if (!user) return null;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      await createProject(newProject);
      setNewProject({ name: '', country: '', color: '#3B82F6' });
      setShowNewProject(false);
      setShowProjectDropdown(false);
    } catch (err) {
      alert(err.message);
    }
    setCreating(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="TexasGTM" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
        </div>
        <span className="sidebar-title">TexasGTM</span>
      </div>

      {/* ═══ PROJECT SWITCHER ═══ */}
      {isAdmin && (
        <div style={{ padding: '4px 12px 8px', position: 'relative' }}>
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: `2px solid ${activeProject?.color || '#3B82F6'}20`,
              background: `${activeProject?.color || '#3B82F6'}10`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all .15s',
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: activeProject?.color || '#3B82F6',
              flexShrink: 0,
            }} />
            <span style={{
              flex: 1, textAlign: 'left', fontSize: '0.78rem', fontWeight: 700,
              color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeProject?.name || 'Select Project'}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#9ca3af' }}>
              {activeProject?.lead_count || 0}
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>
              {showProjectDropdown ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Dropdown */}
          {showProjectDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 12, right: 12, zIndex: 100,
              background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: 4,
            }}>
              <div style={{ padding: '8px 6px', maxHeight: 240, overflowY: 'auto' }}>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProject(p); setShowProjectDropdown(false); }}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: p.id === activeProject?.id ? `${p.color}15` : 'transparent',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.target.style.background = `${p.color}10`}
                    onMouseLeave={e => e.target.style.background = p.id === activeProject?.id ? `${p.color}15` : 'transparent'}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: p.color,
                      flexShrink: 0, border: p.id === activeProject?.id ? `2px solid ${p.color}` : 'none',
                      boxSizing: 'content-box',
                    }} />
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.76rem', fontWeight: p.id === activeProject?.id ? 700 : 500, color: 'var(--text)' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 500 }}>
                      {p.lead_count} leads
                    </span>
                    {p.country && (
                      <span style={{ fontSize: '0.62rem', color: '#d1d5db' }}>{p.country}</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', padding: 6 }}>
                {!showNewProject ? (
                  <button
                    onClick={() => setShowNewProject(true)}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px dashed #d1d5db',
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.74rem', color: '#6b7280', fontWeight: 600,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    New Project
                  </button>
                ) : (
                  <form onSubmit={handleCreateProject} style={{ padding: '4px 4px' }}>
                    <input
                      autoFocus
                      placeholder="Project name (e.g. Arabic GTM)"
                      value={newProject.name}
                      onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                        fontSize: '0.74rem', marginBottom: 6, outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Country (e.g. Saudi Arabia)"
                      value={newProject.country}
                      onChange={e => setNewProject({ ...newProject, country: e.target.value })}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                        fontSize: '0.74rem', marginBottom: 6, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                      {PROJECT_COLORS.map(c => (
                        <button
                          key={c} type="button"
                          onClick={() => setNewProject({ ...newProject, color: c })}
                          style={{
                            width: 20, height: 20, borderRadius: '50%', background: c, border: newProject.color === c ? '2px solid #1f2937' : '2px solid transparent',
                            cursor: 'pointer', padding: 0,
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="submit" disabled={creating}
                        style={{
                          flex: 1, padding: '6px', borderRadius: 6, border: 'none',
                          background: newProject.color, color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                          cursor: 'pointer', opacity: creating ? 0.6 : 1,
                        }}
                      >
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                      <button
                        type="button" onClick={() => setShowNewProject(false)}
                        style={{
                          padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                          background: '#fff', fontSize: '0.72rem', cursor: 'pointer', color: '#6b7280',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.filter(i => i.show).map(item => (
          <Link key={item.href} href={item.href}
            className={`sidebar-link ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: roleColor }}>
            {user.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-role" style={{ color: roleColor }}>{roleLabel}</span>
          </div>
          <NotificationBell />
        </div>
        <button onClick={logout} className="sidebar-logout">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
