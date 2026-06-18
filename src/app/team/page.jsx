'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle' }}>{name}</span>;

export default function TeamPage() {
  const { roleLabels, roleColors } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/team').then(r => r.json()).then(d => setMembers(d.members || [])).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="page-content"><div className="skeleton" style={{ height: 300, borderRadius: 12 }} /></div>;

  return (
    <div className="page-content">
      <div className="page-header"><h1><MI name="group" size={26} /> Team</h1><p>{members.length} members</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {members.map(m => (
          <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: roleColors[m.role], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>{m.name?.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{m.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.email}</div>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 20, background: `${roleColors[m.role]}15`, color: roleColors[m.role], fontWeight: 600 }}>{roleLabels[m.role]}</span>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: m.is_active ? '#10b981' : '#ef4444' }}>{m.is_active ? '●' : '○'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
