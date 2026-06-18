'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle' }}>{name}</span>;

const SECTORS = ['logistics','manufacturing','oil_gas','construction','mining','agriculture','telecom','food','pharma','retail','other'];
const PRIORITIES = ['HOT','WARM','MEDIUM','COLD'];
const STATUSES = ['not_contacted','email_sent','called','meeting_set','proposal_sent','negotiation','won','lost','not_relevant'];
const STATUS_COLORS = { not_contacted:'#94a3b8', email_sent:'#3b82f6', called:'#8b5cf6', meeting_set:'#f59e0b', proposal_sent:'#06b6d4', negotiation:'#a855f7', won:'#10b981', lost:'#ef4444', not_relevant:'#6b7280' };
const PRIORITY_COLORS = { HOT:'#ef4444', WARM:'#f59e0b', MEDIUM:'#3b82f6', COLD:'#94a3b8' };
const ROW_BG = { HOT:'#fff5f5', WARM:'#fffbeb', MEDIUM:'#f0f9ff', COLD:'#f8fafc' };

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', sector: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ company_name:'',domain:'',sector:'other',priority:'MEDIUM',city:'',region:'',country:'',phone:'',email:'',decision_maker_title:'',pain_point:'',notes:'' });
  const [expandedId, setExpandedId] = useState(null);

  const fetchLeads = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if (v) p.set(k, v); });
    fetch(`/api/leads?${p}`).then(r => r.json()).then(d => setLeads(d.leads || [])).finally(() => setLoading(false));
  };
  const fetchStats = () => { fetch('/api/leads/stats').then(r => r.json()).then(setStats); };
  useEffect(() => { fetchLeads(); fetchStats(); }, [filters]);

  const addLead = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setForm({ company_name:'',domain:'',sector:'other',priority:'MEDIUM',city:'',region:'',country:'',phone:'',email:'',decision_maker_title:'',pain_point:'',notes:'' }); fetchLeads(); fetchStats(); }
    else { const d = await res.json(); alert(d.error); }
  };

  const updateLead = async (id, updates) => {
    await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    fetchLeads(); fetchStats();
  };

  const deleteLead = async (id) => { if (!confirm('Delete this lead?')) return; await fetch(`/api/leads/${id}`, { method: 'DELETE' }); fetchLeads(); fetchStats(); };

  if (loading) return <div className="page-content"><div className="skeleton" style={{ height: 500, borderRadius: 12 }} /></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1><MI name="leaderboard" size={26} /> Lead Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><MI name="add" size={16} /> Add Lead</button>
      </div>

      {/* Stats */}
      <div className="leads-stats-grid">
        {[
          { label: 'Total Leads', value: stats.total||0, color: '#6366f1' },
          { label: 'HOT', value: stats.hot||0, color: '#ef4444' },
          { label: 'WARM', value: stats.warm||0, color: '#f59e0b' },
          { label: 'Contacted', value: stats.contacted||0, color: '#3b82f6' },
          { label: 'Meetings', value: stats.meetings||0, color: '#8b5cf6' },
          { label: 'Won', value: stats.won||0, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="leads-stat-card"><div className="leads-stat-value" style={{ color: s.color }}>{s.value}</div><div className="leads-stat-label">{s.label}</div></div>
        ))}
      </div>

      {/* Filters */}
      <div className="leads-filter-bar">
        <input className="leads-input" placeholder="Search..." value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} style={{ flex: 1, minWidth: 150 }} />
        <select className="leads-select" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}><option value="">All Status</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>
        <select className="leads-select" value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}><option value="">All Priority</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
        <select className="leads-select" value={filters.sector} onChange={e => setFilters(p => ({ ...p, sector: e.target.value }))}><option value="">All Sectors</option>{SECTORS.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* Table */}
      <div className="leads-table-wrap">
        <table className="leads-table">
          <thead><tr><th>Company</th><th>Sector</th><th>City</th><th>Contact</th><th>Priority</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="leads-row" style={{ background: ROW_BG[l.priority] || '#fff' }}>
                <td><strong style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>{l.company_name}</strong>
                  {expandedId === l.id && <div className="leads-expanded"><p><strong>Domain:</strong> {l.domain || '—'}</p><p><strong>Decision Maker:</strong> {l.decision_maker_title || '—'}</p><p><strong>Pain Point:</strong> {l.pain_point || '—'}</p><p><strong>Notes:</strong> {l.notes || '—'}</p></div>}
                </td>
                <td>{l.sector}</td><td>{l.city || '—'}</td>
                <td style={{ fontSize: '0.75rem' }}>{l.email && <div>{l.email}</div>}{l.phone && <div>{l.phone}</div>}</td>
                <td><span className="leads-priority-badge" style={{ background: `${PRIORITY_COLORS[l.priority]}20`, color: PRIORITY_COLORS[l.priority] }}>{l.priority}</span></td>
                <td><select className="leads-status-select" value={l.status} onChange={e => updateLead(l.id, { status: e.target.value })} style={{ background: `${STATUS_COLORS[l.status]}15`, color: STATUS_COLORS[l.status] }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select></td>
                <td><button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={() => deleteLead(l.id)}><MI name="delete" size={14} /></button></td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan="7" className="no-data">No leads found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add Lead Modal */}
      {showModal && (
        <div className="leads-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="leads-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><MI name="add_business" size={22} /> Add New Lead</h2>
            <form onSubmit={addLead}>
              <div className="leads-form-grid">
                <div className="leads-form-field"><label>Company Name *</label><input value={form.company_name} onChange={e => setForm(p => ({...p, company_name: e.target.value}))} required /></div>
                <div className="leads-form-field"><label>Domain</label><input value={form.domain} onChange={e => setForm(p => ({...p, domain: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Sector</label><select value={form.sector} onChange={e => setForm(p => ({...p, sector: e.target.value}))}>{SECTORS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="leads-form-field"><label>Priority</label><select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div className="leads-form-field"><label>City</label><input value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Country</label><input value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Email</label><input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Decision Maker</label><input value={form.decision_maker_title} onChange={e => setForm(p => ({...p, decision_maker_title: e.target.value}))} /></div>
                <div className="leads-form-field"><label>Pain Point</label><input value={form.pain_point} onChange={e => setForm(p => ({...p, pain_point: e.target.value}))} /></div>
              </div>
              <div className="leads-form-field" style={{ marginTop: 12 }}><label>Notes</label><textarea rows={3} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit" className="btn btn-success"><MI name="check" size={16} /> Save Lead</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
