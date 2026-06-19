'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG = {
  not_contacted:   { label: 'Not Contacted',   bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780', row: '#ffffff' },
  email_sent:      { label: 'Email Sent',       bg: '#DBEAFE', text: '#185FA5', dot: '#378ADD', row: '#eff6ff' },
  call_made:       { label: 'Call Made',         bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD', row: '#f5f3ff' },
  replied:         { label: 'Replied',           bg: '#E1F5EE', text: '#0F6E56', dot: '#1D9E75', row: '#f0fdf4' },
  meeting_booked:  { label: 'Meeting Booked',    bg: '#EAF3DE', text: '#3B6D11', dot: '#639922', row: '#ecfdf5' },
  proposal_sent:   { label: 'Proposal Sent',     bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27', row: '#fffbeb' },
  negotiating:     { label: 'Negotiating',       bg: '#FCE4D6', text: '#993C1D', dot: '#D85A30', row: '#fff7ed' },
  contract_signed: { label: 'Contract Signed ✓', bg: '#9FE1CB', text: '#085041', dot: '#1D9E75', row: '#d1fae5' },
  not_interested:  { label: 'Not Interested',    bg: '#FCEBEB', text: '#A32D2D', dot: '#E24B4A', row: '#fef2f2' },
  follow_up_later: { label: 'Follow Up Later',   bg: '#FFF2CC', text: '#7D6608', dot: '#EF9F27', row: '#fefce8' },
};
const PRIORITY_CONFIG = {
  HOT:     { label: '🔥 HOT',     bg: '#FCE4D6', text: '#993C1D' },
  HIGH:    { label: '⚡ HIGH',    bg: '#E2F0D9', text: '#3B6D11' },
  MEDIUM:  { label: '● MEDIUM',   bg: '#DBEAFE', text: '#185FA5' },
  PARTNER: { label: '🤝 PARTNER', bg: '#EEEDFE', text: '#3C3489' },
};
const SECTOR_LABELS = {
  construction: 'Construction', manufacturing: 'Manufacturing',
  warehouse_logistics: 'Warehouse/Logistics', food_processing: 'Food Processing',
  metallurgy: 'Metallurgy', mining: 'Mining', chemicals: 'Chemicals',
  automotive: 'Automotive', hospitality: 'Hospitality', retail: 'Retail',
  agency_partner: 'Agency Partner', industry_association: 'Industry Association', other: 'Other',
};
const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

export default function LeadsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sector: '', priority: '', status: '', search: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && user && !isAdmin) router.push('/dashboard');
  }, [user, authLoading, router, isAdmin]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sector) params.set('sector', filters.sector);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
    } catch { setLeads([]); }
    setLoading(false);
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try { const res = await fetch('/api/leads/stats'); setStats(await res.json()); } catch {}
  }, []);

  useEffect(() => { if (user && isAdmin) { fetchLeads(); fetchStats(); } }, [user, isAdmin, fetchLeads, fetchStats]);

  async function handleStatusChange(leadId, newStatus) {
    await fetch(`/api/leads/${leadId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    fetchLeads(); fetchStats();
  }

  async function handleDelete(leadId) {
    if (!confirm('Delete this lead permanently?')) return;
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    fetchLeads(); fetchStats();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/leads/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: leads.map(l => l.id) }) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `TexasGTM_Leads_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Export failed: ' + e.message); }
    setExporting(false);
  }



  function AddLeadModal() {
    const [form, setForm] = useState({ company_name: '', domain: '', sector: 'manufacturing', priority: 'MEDIUM', city: '', region: '', company_size: '', pain_point: '', decision_maker_title: '', phone: '', email: '', contact_method: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
      e.preventDefault(); setSaving(true); setError('');
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setShowAddModal(false); fetchLeads(); fetchStats(); }
      else setError(data.error || 'Failed');
      setSaving(false);
    }

    return (
      <div className="leads-modal-overlay" onClick={() => setShowAddModal(false)}>
        <div className="leads-modal" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Add New Lead</h3>
            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', marginBottom: 12 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="leads-form-grid">
              <div className="leads-form-field"><label>Company Name *</label><input required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
              <div className="leads-form-field"><label>Domain</label><input placeholder="e.g. ozon.ru" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} /></div>
              <div className="leads-form-field"><label>Sector</label>
                <select value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}>
                  {Object.entries(SECTOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="leads-form-field"><label>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div className="leads-form-field"><label>City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div className="leads-form-field"><label>Region</label><input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} /></div>
              <div className="leads-form-field"><label>Company Size</label><input placeholder="e.g. 10,000+" value={form.company_size} onChange={e => setForm({ ...form, company_size: e.target.value })} /></div>
              <div className="leads-form-field"><label>Decision Maker</label><input value={form.decision_maker_title} onChange={e => setForm({ ...form, decision_maker_title: e.target.value })} /></div>
              <div className="leads-form-field"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="leads-form-field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="leads-form-field" style={{ gridColumn: '1 / -1' }}><label>Why They Need Workers</label><textarea rows={2} value={form.pain_point} onChange={e => setForm({ ...form, pain_point: e.target.value })} /></div>
              <div className="leads-form-field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Add Lead'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (authLoading || !user || !isAdmin) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Lead Management</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2B targets — Lead scraping & management</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MI name="add" size={16} /> Add Lead
          </button>
          <button onClick={handleExport} disabled={exporting || !leads.length} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MI name="download" size={16} /> {exporting ? 'Exporting…' : `Export ${leads.length}`}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="leads-stats-grid">
          {[
            { label: 'Total Leads', value: stats.total, color: '#378ADD', icon: 'groups' },
            { label: 'HOT (act now)', value: stats.hot, color: '#D85A30', icon: 'local_fire_department' },
            { label: 'HIGH priority', value: stats.high, color: '#1A7A4A', icon: 'bolt' },
            { label: 'Active pipeline', value: stats.active, color: '#7F77DD', icon: 'trending_up' },
            { label: 'Contracts signed', value: stats.signed, color: '#1D9E75', icon: 'verified' },
            { label: 'Partners', value: stats.partner, color: '#EF9F27', icon: 'handshake' },
          ].map(c => (
            <div key={c.label} className="leads-stat-card">
              <MI name={c.icon} size={22} />
              <div className="leads-stat-value" style={{ color: c.color }}>{c.value}</div>
              <div className="leads-stat-label">{c.label}</div>
            </div>
          ))}
        </div>
      )}



      {/* Filters */}
      <div className="leads-filter-bar">
        <input type="text" placeholder="Search company, city, email…" value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="leads-input" style={{ flex: 1, minWidth: 180 }} />
        <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className="leads-select">
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))} className="leads-select">
          <option value="">All sectors</option>
          {Object.entries(SECTOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="leads-select">
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        {(filters.search || filters.priority || filters.sector || filters.status) && (
          <button onClick={() => setFilters({ sector: '', priority: '', status: '', search: '' })} style={{ fontSize: '0.72rem', color: '#9ca3af', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', background: '#fff' }}>Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading leads…</div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <MI name="groups" size={40} /><p style={{ marginTop: 8, fontSize: '0.95rem' }}>No leads found</p>
          <p style={{ fontSize: '0.78rem', marginTop: 4 }}>Add leads manually or run a scrape job</p>
        </div>
      ) : (
        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>#</th>
                <th style={{ minWidth: 200 }}>Company</th>
                <th>Sector</th>
                <th>City</th>
                <th style={{ minWidth: 180 }}>Why They Need Us</th>
                <th>Contact</th>
                <th style={{ width: 100, textAlign: 'center' }}>Priority</th>
                <th style={{ minWidth: 170 }}>Status</th>
                <th>Phone</th>
                <th>Email</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.not_contacted;
                const pc = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.MEDIUM;
                return (
                  <tr key={lead.id} style={{ backgroundColor: sc.row }} className="leads-row">
                    <td style={{ textAlign: 'center', color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.72rem' }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>{lead.company_name}</div>
                      {lead.domain && <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 2 }}>{lead.domain}</div>}
                      {expandedId === lead.id && (
                        <div className="leads-expanded">
                          {lead.pain_point && <div><strong>Pain point:</strong> {lead.pain_point}</div>}
                          {lead.find_instructions && <div><strong>Where to find:</strong> {lead.find_instructions}</div>}
                          {lead.notes && <div><strong>Notes:</strong> {lead.notes}</div>}
                          {lead.source_url && <div><strong>Source:</strong> <a href={lead.source_url} target="_blank" rel="noopener noreferrer">{lead.source_url}</a></div>}
                          {lead.last_contacted_at && <div><strong>Last contacted:</strong> {new Date(lead.last_contacted_at).toLocaleDateString()}</div>}
                          <div style={{ marginTop: 6 }}><strong>Scraped from:</strong> {lead.scraped_from || 'manual'}</div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.72rem', color: '#6b7280' }}>{SECTOR_LABELS[lead.sector] || lead.sector}</td>
                    <td style={{ fontSize: '0.72rem', color: '#6b7280' }}>{[lead.city, lead.region].filter(Boolean).join(', ')}</td>
                    <td><p style={{ fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lead.pain_point}</p></td>
                    <td style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                      {lead.contact_method}
                      {lead.decision_maker_title && <div style={{ color: '#9ca3af', marginTop: 2 }}>{lead.decision_maker_title}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="leads-priority-badge" style={{ background: pc.bg, color: pc.text }}>{pc.label}</span>
                    </td>
                    <td>
                      <div style={{ position: 'relative' }}>
                        <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                          className="leads-status-select" style={{ background: sc.bg, color: sc.text }}>
                          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                        </select>
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 7, height: 7, borderRadius: '50%', background: sc.dot, pointerEvents: 'none' }} />
                      </div>
                    </td>
                    <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#6b7280' }}>{lead.phone}</td>
                    <td style={{ fontSize: '0.72rem' }}>{lead.email && <a href={`mailto:${lead.email}`} style={{ color: '#2563eb' }}>{lead.email}</a>}</td>
                    <td>
                      <button onClick={() => handleDelete(lead.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.7rem', padding: 4 }}>
                        <MI name="delete" size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && <AddLeadModal />}
    </div>
  );
}
