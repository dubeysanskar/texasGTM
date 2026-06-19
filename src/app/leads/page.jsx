'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const SC = {
  not_contacted:   { label: 'Not Contacted',   bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780', row: '#ffffff' },
  touch_1:         { label: 'Touch 1',          bg: '#DBEAFE', text: '#1e40af', dot: '#3b82f6', row: '#eff6ff' },
  touch_2:         { label: 'Touch 2',          bg: '#FEF3C7', text: '#92400e', dot: '#f59e0b', row: '#fffbeb' },
  touch_3:         { label: 'Touch 3',          bg: '#D1FAE5', text: '#065f46', dot: '#10b981', row: '#ecfdf5' },
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
const PC = {
  HOT: { label: '🔥 HOT', bg: '#FCE4D6', text: '#993C1D' },
  HIGH: { label: '⚡ HIGH', bg: '#E2F0D9', text: '#3B6D11' },
  MEDIUM: { label: '● MEDIUM', bg: '#DBEAFE', text: '#185FA5' },
  PARTNER: { label: '🤝 PARTNER', bg: '#EEEDFE', text: '#3C3489' },
};
const SL = { construction:'Construction', manufacturing:'Manufacturing', warehouse_logistics:'Warehouse/Logistics', food_processing:'Food Processing', metallurgy:'Metallurgy', mining:'Mining', chemicals:'Chemicals', automotive:'Automotive', hospitality:'Hospitality', retail:'Retail', agency_partner:'Agency Partner', industry_association:'Industry Association', other:'Other' };
const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

export default function LeadsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sector: '', priority: '', status: '', search: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkLookup, setShowBulkLookup] = useState(false);
  const [bulkLookupText, setBulkLookupText] = useState('');
  const [perPage, setPerPage] = useState(50);

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.sector) p.set('sector', filters.sector);
    if (filters.priority) p.set('priority', filters.priority);
    if (filters.status) p.set('status', filters.status);
    if (filters.search) p.set('search', filters.search);
    p.set('page', page); p.set('limit', perPage);
    try {
      const res = await fetch(`/api/leads?${p}`);
      const d = await res.json();
      setLeads(d.leads || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1);
    } catch { setLeads([]); }
    setLoading(false);
  }, [filters, page, perPage]);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch('/api/leads/stats'); setStats(await r.json()); } catch {}
  }, []);

  useEffect(() => { if (user) { fetchLeads(); fetchStats(); } }, [user, fetchLeads, fetchStats]);
  useEffect(() => { setPage(1); }, [filters, perPage]);

  async function handleStatusChange(id, s) {
    await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) });
    fetchLeads(); fetchStats();
  }
  async function handleDelete(id) {
    if (!confirm('Delete this lead?')) return;
    await fetch(`/api/leads/${id}`, { method: 'DELETE' }); fetchLeads(); fetchStats();
  }
  async function handleBulkStatus() {
    if (!selected.size || !bulkStatus) return;
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], status: bulkStatus }) });
    setSelected(new Set()); setBulkStatus(''); fetchLeads(); fetchStats();
  }
  async function handleExport() {
    setExporting(true);
    try {
      const r = await fetch('/api/leads/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const b = await r.blob(); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = u; a.download = `TexasGTM_Leads_${new Date().toISOString().split('T')[0]}.xlsx`; a.click(); URL.revokeObjectURL(u);
    } catch (e) { alert('Export failed'); }
    setExporting(false);
  }
  function handleBulkLookup() {
    const ids = bulkLookupText.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (ids.length) { setFilters(f => ({ ...f, search: ids.join(' ') })); setShowBulkLookup(false); }
  }
  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleSelectAll() { if (selected.size === leads.length) setSelected(new Set()); else setSelected(new Set(leads.map(l => l.id))); }

  if (authLoading || !user) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom:2, fontSize:'1.3rem' }}>Lead Management</h1>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{total} total leads • Page {page}/{totalPages}</p>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => setShowBulkLookup(!showBulkLookup)} className="btn btn-ghost" style={{ fontSize:'0.75rem' }}><MI name="search" size={14}/> Bulk Lookup</button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ fontSize:'0.75rem' }}><MI name="add" size={14}/> Add Lead</button>
          <button onClick={handleExport} disabled={exporting} className="btn btn-success" style={{ fontSize:'0.75rem' }}><MI name="download" size={14}/> Export</button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8, marginBottom:16 }}>
          {[
            { l:'Total', v:stats.total, c:'#3b82f6', i:'groups' },
            { l:'HOT', v:stats.hot, c:'#ef4444', i:'local_fire_department' },
            { l:'HIGH', v:stats.high, c:'#22c55e', i:'bolt' },
            { l:'Active', v:stats.active, c:'#8b5cf6', i:'trending_up' },
            { l:'Signed', v:stats.signed, c:'#10b981', i:'verified' },
            { l:'Partners', v:stats.partner, c:'#f59e0b', i:'handshake' },
          ].map(s => (
            <div key={s.l} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
              <MI name={s.i} size={18}/><div style={{ fontSize:'1.3rem', fontWeight:800, color:s.c, marginTop:2 }}>{s.v}</div>
              <div style={{ fontSize:'0.65rem', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Lookup Panel */}
      {showBulkLookup && (
        <div style={{ background:'#f8fafc', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:'0.8rem', fontWeight:600, marginBottom:8 }}>Bulk Lookup — paste IDs or company names</div>
          <textarea rows={3} value={bulkLookupText} onChange={e => setBulkLookupText(e.target.value)} placeholder="Paste IDs or names separated by comma, space, or newline..." style={{ width:'100%', padding:8, borderRadius:8, border:'1px solid var(--border)', fontSize:'0.78rem', resize:'vertical' }}/>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button onClick={handleBulkLookup} className="btn btn-primary" style={{ fontSize:'0.72rem' }}>Search</button>
            <button onClick={() => { setShowBulkLookup(false); setBulkLookupText(''); setFilters(f => ({...f, search:''})); }} className="btn btn-ghost" style={{ fontSize:'0.72rem' }}>Clear</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
        <input type="text" placeholder="Search company, city, email, ID…" value={filters.search}
          onChange={e => setFilters(f => ({...f, search: e.target.value}))} style={{ flex:1, minWidth:180, padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.78rem' }}/>
        <select value={filters.priority} onChange={e => setFilters(f => ({...f, priority: e.target.value}))} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.75rem' }}>
          <option value="">All priorities</option>{Object.entries(PC).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filters.sector} onChange={e => setFilters(f => ({...f, sector: e.target.value}))} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.75rem' }}>
          <option value="">All sectors</option>{Object.entries(SL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.75rem' }}>
          <option value="">All statuses</option>{Object.entries(SC).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.75rem', width:80 }}>
          {[25,50,100,200].map(n => <option key={n} value={n}>{n}/pg</option>)}
        </select>
        {(filters.search||filters.priority||filters.sector||filters.status) && (
          <button onClick={() => setFilters({sector:'',priority:'',status:'',search:''})} style={{ fontSize:'0.7rem', color:'#9ca3af', border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px', cursor:'pointer', background:'#fff' }}>✕ Clear</button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'#eff6ff', borderRadius:10, marginBottom:12, border:'1px solid #bfdbfe' }}>
          <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#1e40af' }}>{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #93c5fd', fontSize:'0.75rem' }}>
            <option value="">Set status…</option>{Object.entries(SC).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          <button onClick={handleBulkStatus} disabled={!bulkStatus} className="btn btn-primary" style={{ fontSize:'0.72rem', padding:'5px 14px' }}>Apply</button>
          <button onClick={() => setSelected(new Set())} style={{ fontSize:'0.72rem', color:'#6b7280', background:'none', border:'none', cursor:'pointer' }}>Deselect all</button>
        </div>
      )}

      {/* Table */}
      {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Loading…</div> : leads.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><MI name="groups" size={40}/><p style={{ marginTop:8 }}>No leads found</p></div>
      ) : (
        <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid var(--border)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'2px solid var(--border)' }}>
                <th style={{ padding:'10px 8px', width:36, textAlign:'center' }}>
                  <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleSelectAll} style={{ cursor:'pointer' }}/>
                </th>
                <th style={TH}>ID</th><th style={{...TH, minWidth:180}}>Company</th><th style={TH}>Sector</th>
                <th style={TH}>City</th><th style={{...TH, minWidth:130}}>Priority</th><th style={{...TH, minWidth:160}}>Status</th>
                <th style={TH}>Contact</th><th style={TH}>Phone</th><th style={{width:50}}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => {
                const sc = SC[l.status] || SC.not_contacted;
                const pc = PC[l.priority] || PC.MEDIUM;
                const isSel = selected.has(l.id);
                return (
                  <tr key={l.id} style={{ backgroundColor: isSel ? '#eff6ff' : sc.row, borderBottom:'1px solid #f1f5f9', transition:'background .15s' }}>
                    <td style={{ padding:'8px', textAlign:'center' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(l.id)} style={{ cursor:'pointer' }}/>
                    </td>
                    <td style={{ padding:'8px', fontFamily:'monospace', fontSize:'0.68rem', color:'#9ca3af' }}>{l.id}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <div style={{ fontWeight:600, fontSize:'0.8rem', cursor:'pointer', color:'var(--text)' }} onClick={() => setExpandedId(expandedId===l.id?null:l.id)}>{l.company_name}</div>
                      {l.domain && <div style={{ fontSize:'0.65rem', color:'#9ca3af', marginTop:1 }}>{l.domain}</div>}
                      {expandedId===l.id && (
                        <div style={{ marginTop:8, padding:'8px 10px', background:'#f8fafc', borderRadius:8, fontSize:'0.72rem', lineHeight:1.6, color:'#4b5563', border:'1px solid #e5e7eb' }}>
                          {l.pain_point && <div><strong>Why:</strong> {l.pain_point}</div>}
                          {l.find_instructions && <div><strong>Find:</strong> {l.find_instructions}</div>}
                          {l.notes && <div><strong>Notes:</strong> {l.notes}</div>}
                          {l.email && <div><strong>Email:</strong> <a href={`mailto:${l.email}`} style={{color:'#2563eb'}}>{l.email}</a></div>}
                          {l.company_size && <div><strong>Size:</strong> {l.company_size}</div>}
                          {l.decision_maker_title && <div><strong>Decision maker:</strong> {l.decision_maker_title}</div>}
                        </div>
                      )}
                    </td>
                    <td style={TD}>{SL[l.sector]||l.sector}</td>
                    <td style={TD}>{[l.city,l.region].filter(Boolean).join(', ')}</td>
                    <td style={{...TD, textAlign:'center'}}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:'0.68rem', fontWeight:700, background:pc.bg, color:pc.text, whiteSpace:'nowrap' }}>{pc.label}</span>
                    </td>
                    <td style={TD}>
                      <select value={l.status} onChange={e => handleStatusChange(l.id, e.target.value)}
                        style={{ padding:'4px 8px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:'0.72rem', fontWeight:600, background:sc.bg, color:sc.text, cursor:'pointer', width:'100%' }}>
                        {Object.entries(SC).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
                      </select>
                    </td>
                    <td style={{...TD, fontSize:'0.68rem'}}>
                      {l.contact_method && <div>{l.contact_method}</div>}
                      {l.decision_maker_title && <div style={{color:'#9ca3af', marginTop:1}}>{l.decision_maker_title}</div>}
                    </td>
                    <td style={{...TD, fontFamily:'monospace', fontSize:'0.68rem'}}>{l.phone}</td>
                    <td style={{padding:'8px 4px', textAlign:'center'}}>
                      <button onClick={() => handleDelete(l.id)} title="Delete" style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><MI name="delete" size={15}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6, marginTop:16 }}>
          <button onClick={() => setPage(1)} disabled={page===1} style={PB}>«</button>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={PB}>‹</button>
          {Array.from({length: Math.min(7, totalPages)}, (_, i) => {
            let p; const half = 3;
            if (totalPages <= 7) p = i+1;
            else if (page <= half+1) p = i+1;
            else if (page >= totalPages-half) p = totalPages-6+i;
            else p = page-half+i;
            return <button key={p} onClick={() => setPage(p)} style={{...PB, background: p===page ? 'var(--primary)' : '#fff', color: p===page ? '#fff' : '#374151', fontWeight: p===page ? 700 : 400}}>{p}</button>;
          })}
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={PB}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={PB}>»</button>
        </div>
      )}

      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} onDone={() => { fetchLeads(); fetchStats(); setShowAddModal(false); }} />}
    </div>
  );
}

const TH = { padding:'10px 8px', textAlign:'left', fontSize:'0.7rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' };
const TD = { padding:'8px', fontSize:'0.75rem', color:'#4b5563' };
const PB = { width:32, height:32, borderRadius:8, border:'1px solid var(--border)', background:'#fff', cursor:'pointer', fontSize:'0.78rem', display:'flex', alignItems:'center', justifyContent:'center' };

function AddModal({ onClose, onDone }) {
  const [f, setF] = useState({ company_name:'', domain:'', sector:'manufacturing', priority:'MEDIUM', city:'', region:'', company_size:'', pain_point:'', decision_maker_title:'', phone:'', email:'', contact_method:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  async function save(e) {
    e.preventDefault(); setSaving(true); setErr('');
    const r = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(f) });
    if (r.ok) onDone(); else { const d = await r.json(); setErr(d.error||'Failed'); }
    setSaving(false);
  }
  const SL2 = { construction:'Construction', manufacturing:'Manufacturing', warehouse_logistics:'Warehouse/Logistics', food_processing:'Food Processing', metallurgy:'Metallurgy', mining:'Mining', chemicals:'Chemicals', automotive:'Automotive', hospitality:'Hospitality', retail:'Retail', agency_partner:'Agency Partner', industry_association:'Industry Association', other:'Other' };
  return (
    <div className="leads-modal-overlay" onClick={onClose}>
      <div className="leads-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontSize:'1rem', fontWeight:700 }}>Add New Lead</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>
        {err && <div style={{ background:'#fef2f2', color:'#dc2626', padding:'8px 12px', borderRadius:8, fontSize:'0.78rem', marginBottom:12 }}>{err}</div>}
        <form onSubmit={save}>
          <div className="leads-form-grid">
            <div className="leads-form-field"><label>Company *</label><input required value={f.company_name} onChange={e => setF({...f, company_name:e.target.value})}/></div>
            <div className="leads-form-field"><label>Domain</label><input value={f.domain} onChange={e => setF({...f, domain:e.target.value})}/></div>
            <div className="leads-form-field"><label>Sector</label><select value={f.sector} onChange={e => setF({...f, sector:e.target.value})}>{Object.entries(SL2).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="leads-form-field"><label>Priority</label><select value={f.priority} onChange={e => setF({...f, priority:e.target.value})}><option value="HOT">HOT</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="PARTNER">PARTNER</option></select></div>
            <div className="leads-form-field"><label>City</label><input value={f.city} onChange={e => setF({...f, city:e.target.value})}/></div>
            <div className="leads-form-field"><label>Size</label><input value={f.company_size} onChange={e => setF({...f, company_size:e.target.value})}/></div>
            <div className="leads-form-field"><label>Phone</label><input value={f.phone} onChange={e => setF({...f, phone:e.target.value})}/></div>
            <div className="leads-form-field"><label>Email</label><input value={f.email} onChange={e => setF({...f, email:e.target.value})}/></div>
            <div className="leads-form-field" style={{gridColumn:'1/-1'}}><label>Pain Point</label><textarea rows={2} value={f.pain_point} onChange={e => setF({...f, pain_point:e.target.value})}/></div>
            <div className="leads-form-field" style={{gridColumn:'1/-1'}}><label>Notes</label><textarea rows={2} value={f.notes} onChange={e => setF({...f, notes:e.target.value})}/></div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Add Lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
