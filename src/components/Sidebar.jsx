'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isManager, isStaff, logout, roleLabel, roleColor } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', show: true },
    { href: '/messages', label: 'Messages', icon: 'chat', show: true },
    { href: '/tasks', label: 'Tasks', icon: 'task_alt', show: isStaff },
    { href: '/leads', label: 'Lead Management', icon: 'leaderboard', show: isManager },
    { href: '/lead-scraper', label: 'Lead Scraper', icon: 'travel_explore', show: isAdmin },
    { href: '/team', label: 'Team', icon: 'group', show: isManager },
    { href: '/marketing', label: 'Marketing', icon: 'campaign', show: isAdmin || user?.role === 'marketing' },
    { href: '/shared-docs', label: 'Documents', icon: 'folder_shared', show: isStaff },
    { href: '/logs', label: 'Activity Logs', icon: 'history', show: isAdmin },
    { href: '/admin', label: 'Admin Panel', icon: 'settings', show: isAdmin },
    { href: '/profile', label: 'My Profile', icon: 'person', show: true },
  ];

  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="TexasGTM" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
        </div>
        <span className="sidebar-title">TexasGTM</span>
      </div>

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
