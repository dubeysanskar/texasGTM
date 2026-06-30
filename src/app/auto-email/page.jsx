'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

const SECTORS = { construction:'Construction', manufacturing:'Manufacturing', warehouse_logistics:'Warehouse/Logistics', food_processing:'Food Processing', metallurgy:'Metallurgy', mining:'Mining', chemicals:'Chemicals', automotive:'Automotive', hospitality:'Hospitality', retail:'Retail', agency_partner:'Agency Partner', industry_association:'Industry Association', other:'Other' };
const PRIORITIES = { HOT:'🔥 HOT', HIGH:'⚡ HIGH', MEDIUM:'● MEDIUM', PARTNER:'🤝 PARTNER' };
const LEAD_STATUSES = { not_contacted:'Not Contacted', touch_1:'Touch 1', touch_2:'Touch 2', touch_3:'Touch 3', email_sent:'Email Sent', call_made:'Call Made', replied:'Replied', meeting_booked:'Meeting Booked', proposal_sent:'Proposal Sent', negotiating:'Negotiating', contract_signed:'Contract Signed', not_interested:'Not Interested', follow_up_later:'Follow Up Later' };
const LANGS = [{ code:'en', label:'English', flag:'🇬🇧' }, { code:'ru', label:'Russian', flag:'🇷🇺' }, { code:'de', label:'German', flag:'🇩🇪' }, { code:'ar', label:'Arabic', flag:'🇦🇪' }];

const CAMP_STATUS = {
  draft: { bg:'#f3f4f6', text:'#6b7280', label:'Draft', icon:'edit_note' },
  active: { bg:'#dbeafe', text:'#1e40af', label:'Active', icon:'play_circle' },
  paused: { bg:'#fef3c7', text:'#92400e', label:'Paused', icon:'pause_circle' },
  completed: { bg:'#dcfce7', text:'#166534', label:'Completed', icon:'check_circle' },
};

const SEND_STATUS = {
  queued: { bg:'#f3f4f6', text:'#6b7280', label:'Queued' },
  sending: { bg:'#dbeafe', text:'#1e40af', label:'Sending' },
  sent: { bg:'#e0e7ff', text:'#3730a3', label:'Sent' },
  delivered: { bg:'#d1fae5', text:'#065f46', label:'Delivered' },
  opened: { bg:'#dcfce7', text:'#166534', label:'Opened' },
  replied: { bg:'#a7f3d0', text:'#064e3b', label:'Replied' },
  bounced: { bg:'#fee2e2', text:'#991b1b', label:'Bounced' },
  failed: { bg:'#fecaca', text:'#7f1d1d', label:'Failed' },
  unsubscribed: { bg:'#fef3c7', text:'#92400e', label:'Unsub' },
};

export default function AutoEmailPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sends, setSends] = useState([]);
  const [sendsLoading, setSendsLoading] = useState(false);
  const [sendFilter, setSendFilter] = useState('');
  const [showPreview, setShowPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [stats, setStats] = useState({ total_sent:0, total_opened:0, total_replied:0, total_bounced:0, total_campaigns:0 });

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/auto-email/campaigns');
      if (r.ok) setCampaigns(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/templates');
      if (r.ok) setTemplates(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (user) { fetchCampaigns(); fetchTemplates(); }
  }, [user, fetchCampaigns, fetchTemplates]);

  // Compute stats from campaigns
  useEffect(() => {
    const s = { total_sent:0, total_opened:0, total_replied:0, total_bounced:0, total_campaigns: campaigns.length, total_unsubscribed:0 };
    campaigns.forEach(c => {
      s.total_sent += c.total_sent || 0;
      s.total_opened += c.total_opened || 0;
      s.total_replied += c.total_replied || 0;
      s.total_bounced += c.total_bounced || 0;
      s.total_unsubscribed += c.total_unsubscribed || 0;
    });
    setStats(s);
  }, [campaigns]);

  async function fetchSends(campaignId) {
    setSendsLoading(true);
    try {
      const url = `/api/auto-email/sends?campaign_id=${campaignId}&limit=100${sendFilter ? `&status=${sendFilter}` : ''}`;
      const r = await fetch(url);
      if (r.ok) { const d = await r.json(); setSends(d.sends || []); }
    } catch {}
    setSendsLoading(false);
  }

  useEffect(() => {
    if (expandedId) fetchSends(expandedId);
  }, [expandedId, sendFilter]);

  async function handleSend(campaignId) {
    if (!confirm('Start sending emails for this campaign? This will send real emails to leads.')) return;
    setSendingCampaign(campaignId);
    setSendResult(null);
    try {
      const r = await fetch(`/api/auto-email/campaigns/${campaignId}/send`, { method: 'POST' });
      const d = await r.json();
      setSendResult(d);
      fetchCampaigns();
      if (expandedId === campaignId) fetchSends(campaignId);
    } catch (err) {
      setSendResult({ error: err.message });
    }
    setSendingCampaign(null);
  }

  async function handlePause(campaignId) {
    await fetch(`/api/auto-email/campaigns/${campaignId}`, {
      method: 'PUT', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ status: 'paused' })
    });
    fetchCampaigns();
  }

  async function handleDelete(campaignId) {
    if (!confirm('Delete this campaign and all its send history? This cannot be undone.')) return;
    await fetch(`/api/auto-email/campaigns/${campaignId}`, { method: 'DELETE' });
    if (expandedId === campaignId) { setExpandedId(null); setSends([]); }
    fetchCampaigns();
  }

  async function handlePreview(campaignId, leadId) {
    setPreviewLoading(true);
    try {
      const r = await fetch(`/api/auto-email/campaigns/${campaignId}/preview`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ lead_id: leadId })
      });
      if (r.ok) setPreviewData(await r.json());
    } catch {}
    setPreviewLoading(false);
  }

  const openRate = stats.total_sent > 0 ? ((stats.total_opened / stats.total_sent) * 100).toFixed(1) : '0.0';
  const replyRate = stats.total_sent > 0 ? ((stats.total_replied / stats.total_sent) * 100).toFixed(1) : '0.0';

  if (authLoading || !user) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom:2, fontSize:'1.3rem', display:'flex', alignItems:'center', gap:8 }}>
            <MI name="forward_to_inbox" size={26} /> Auto Email
          </h1>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
            Automated outreach pipeline • {stats.total_campaigns} campaigns • {stats.total_sent} emails sent
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ fontSize:'0.78rem' }}>
          <MI name="add" size={15} /> New Campaign
        </button>
      </div>

      {/* Stats Cards */}
      <div className="ae-stats-grid">
        {[
          { label:'Total Sent', value:stats.total_sent, icon:'send', color:'#3b82f6' },
          { label:'Opened', value:stats.total_opened, icon:'visibility', color:'#10b981' },
          { label:'Replied', value:stats.total_replied, icon:'reply', color:'#8b5cf6' },
          { label:'Bounced', value:stats.total_bounced, icon:'error', color:'#ef4444' },
          { label:'Open Rate', value:`${openRate}%`, icon:'trending_up', color:'#f59e0b' },
          { label:'Reply Rate', value:`${replyRate}%`, icon:'thumb_up', color:'#06b6d4' },
        ].map(s => (
          <div key={s.label} className="ae-stat-card">
            <MI name={s.icon} size={20} />
            <div className="ae-stat-value" style={{ color:s.color }}>{s.value}</div>
            <div className="ae-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Send Result Toast */}
      {sendResult && (
        <div style={{
          padding:'12px 18px', borderRadius:10, marginBottom:16, fontSize:'0.82rem', fontWeight:600,
          background: sendResult.error ? '#fef2f2' : '#f0fdf4',
          color: sendResult.error ? '#dc2626' : '#166534',
          border: `1px solid ${sendResult.error ? '#fecaca' : '#bbf7d0'}`,
          display:'flex', justifyContent:'space-between', alignItems:'center'
        }}>
          <span>
            {sendResult.error
              ? `✗ Error: ${sendResult.error}`
              : `✓ Campaign batch complete — ${sendResult.sent} sent, ${sendResult.failed} failed, ${sendResult.skipped} skipped`
            }
          </span>
          <button onClick={() => setSendResult(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'inherit' }}>✕</button>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
          <MI name="forward_to_inbox" size={48} />
          <h3 style={{ marginTop:12, color:'var(--text-dim)' }}>No Campaigns Yet</h3>
          <p style={{ fontSize:'0.82rem', marginTop:8 }}>Create your first automated email campaign to get started.</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ marginTop:16 }}>
            <MI name="add" size={15} /> Create Campaign
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {campaigns.map(c => {
            const st = CAMP_STATUS[c.status] || CAMP_STATUS.draft;
            const isExpanded = expandedId === c.id;
            const campOpenRate = c.total_sent > 0 ? ((c.total_opened / c.total_sent) * 100).toFixed(1) : '0';
            const campReplyRate = c.total_sent > 0 ? ((c.total_replied / c.total_sent) * 100).toFixed(1) : '0';
            const progress = c.total_leads > 0 ? Math.round((c.total_sent / c.total_leads) * 100) : 0;

            return (
              <div key={c.id} className="ae-campaign-card" style={{ borderLeftColor: st.text }}>
                {/* Campaign Header */}
                <div className="ae-campaign-header" onClick={() => { setExpandedId(isExpanded ? null : c.id); setSendFilter(''); }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                    <div className="ae-campaign-icon" style={{ background:st.bg, color:st.text }}>
                      <MI name={st.icon} size={18} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text)' }}>{c.name}</div>
                      <div style={{ fontSize:'0.68rem', color:'#9ca3af', marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                        {c.template_name && <span>📄 {c.template_name}</span>}
                        <span>👥 {c.total_leads} leads</span>
                        <span>📬 {c.total_sent} sent</span>
                        {c.daily_limit && <span>⏱ {c.daily_limit}/day</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    {/* Mini stats */}
                    <div style={{ display:'flex', gap:12, fontSize:'0.7rem', fontWeight:600, marginRight:8 }}>
                      <span style={{ color:'#10b981' }}>📖 {campOpenRate}%</span>
                      <span style={{ color:'#8b5cf6' }}>💬 {campReplyRate}%</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ width:60, height:6, borderRadius:3, background:'#e5e7eb', overflow:'hidden' }}>
                      <div style={{ width:`${progress}%`, height:'100%', borderRadius:3, background: progress === 100 ? '#10b981' : '#3b82f6', transition:'width .3s' }} />
                    </div>
                    <span style={{ fontSize:'0.66rem', color:'#9ca3af', width:30 }}>{progress}%</span>

                    {/* Status badge */}
                    <span className="ae-status-badge" style={{ background:st.bg, color:st.text }}>{st.label}</span>

                    <MI name={isExpanded ? 'expand_less' : 'expand_more'} size={20} />
                  </div>
                </div>

                {/* Expanded: Actions + Send Log */}
                {isExpanded && (
                  <div className="ae-campaign-body">
                    {/* Action bar */}
                    <div className="ae-action-bar">
                      {c.status !== 'active' && (
                        <button onClick={() => handleSend(c.id)} disabled={sendingCampaign === c.id} className="btn btn-primary btn-sm">
                          {sendingCampaign === c.id ? <><span className="spinner-sm" /> Sending…</> : <><MI name="send" size={14} /> Start Sending</>}
                        </button>
                      )}
                      {c.status === 'active' && (
                        <button onClick={() => handlePause(c.id)} className="btn btn-sm" style={{ background:'#fef3c7', color:'#92400e', border:'none' }}>
                          <MI name="pause" size={14} /> Pause
                        </button>
                      )}
                      <button onClick={() => { setShowPreview(c.id); }} className="btn btn-ghost btn-sm">
                        <MI name="preview" size={14} /> Preview
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="btn btn-sm" style={{ background:'#fee2e2', color:'#dc2626', border:'none' }}>
                        <MI name="delete" size={14} /> Delete
                      </button>
                      <div style={{ flex:1 }} />
                      {/* Send status filter */}
                      <select value={sendFilter} onChange={e => setSendFilter(e.target.value)}
                        style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.72rem' }}>
                        <option value="">All statuses</option>
                        {Object.entries(SEND_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>

                    {/* Campaign details */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:8, padding:'0 16px 12px' }}>
                      {[
                        { l:'Sent', v:c.total_sent, c:'#3b82f6' },
                        { l:'Opened', v:c.total_opened, c:'#10b981' },
                        { l:'Replied', v:c.total_replied, c:'#8b5cf6' },
                        { l:'Bounced', v:c.total_bounced, c:'#ef4444' },
                        { l:'Unsubs', v:c.total_unsubscribed, c:'#f59e0b' },
                      ].map(s => (
                        <div key={s.l} style={{ textAlign:'center', padding:'8px 0' }}>
                          <div style={{ fontSize:'1.1rem', fontWeight:800, color:s.c }}>{s.v}</div>
                          <div style={{ fontSize:'0.62rem', color:'#9ca3af', textTransform:'uppercase' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Send log table */}
                    {sendsLoading ? (
                      <div style={{ textAlign:'center', padding:20, color:'var(--text-muted)', fontSize:'0.82rem' }}>Loading sends…</div>
                    ) : sends.length === 0 ? (
                      <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:'0.82rem' }}>
                        No emails sent yet for this campaign
                      </div>
                    ) : (
                      <div style={{ overflowX:'auto', borderTop:'1px solid var(--border)' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.74rem' }}>
                          <thead>
                            <tr style={{ background:'#f8fafc' }}>
                              <th style={TH}>#</th>
                              <th style={TH}>Company</th>
                              <th style={TH}>Email</th>
                              <th style={TH}>Subject</th>
                              <th style={TH}>Status</th>
                              <th style={TH}>Sent</th>
                              <th style={TH}>Opened</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sends.map(s => {
                              const ss = SEND_STATUS[s.status] || SEND_STATUS.queued;
                              return (
                                <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                                  <td style={TD}>{s.id}</td>
                                  <td style={TD}>
                                    <div style={{ fontWeight:600 }}>{s.company_name || '—'}</div>
                                    {s.sector && <div style={{ fontSize:'0.62rem', color:'#9ca3af' }}>{s.sector}</div>}
                                  </td>
                                  <td style={{ ...TD, fontSize:'0.7rem' }}>{s.to_email}</td>
                                  <td style={{ ...TD, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.subject}</td>
                                  <td style={TD}>
                                    <span style={{ padding:'2px 8px', borderRadius:12, fontSize:'0.66rem', fontWeight:600, background:ss.bg, color:ss.text }}>{ss.label}</span>
                                  </td>
                                  <td style={{ ...TD, fontSize:'0.68rem', color:'#9ca3af' }}>{s.sent_at ? new Date(s.sent_at).toLocaleString() : '—'}</td>
                                  <td style={{ ...TD, fontSize:'0.68rem', color: s.opened_at ? '#10b981' : '#9ca3af' }}>
                                    {s.opened_at ? new Date(s.opened_at).toLocaleString() : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && <CreateCampaignModal templates={templates} onClose={() => setShowCreate(false)} onDone={() => { fetchCampaigns(); setShowCreate(false); }} />}

      {/* Preview Modal */}
      {showPreview && <PreviewModal campaignId={showPreview} onClose={() => { setShowPreview(null); setPreviewData(null); }} />}
    </div>
  );
}

// ─── Table Styles ───────────────────────────────────────────────────────────
const TH = { padding:'8px 10px', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.3px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' };
const TD = { padding:'7px 10px', fontSize:'0.76rem', color:'#1f2937', verticalAlign:'top' };

// ─── Create Campaign Modal ─────────────────────────────────────────────────
function CreateCampaignModal({ templates, onClose, onDone }) {
  const [form, setForm] = useState({
    name: '', template_id: '', language: 'en', daily_limit: 50,
    llm_personalize: true, send_window_start: '09:00', send_window_end: '18:00',
    filters: { sector: '', priority: '', status: '', region: '', country: '' }
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [leadCount, setLeadCount] = useState(null);
  const [counting, setCounting] = useState(false);

  // Email-only templates
  const emailTemplates = templates.filter(t => t.platform === 'email' && t.status === 'active');

  async function countLeads() {
    setCounting(true);
    try {
      // We use the campaign creation to count — for now, just create and count
      // Actually, let's just submit filters as a dry-run count
      const r = await fetch('/api/auto-email/campaigns', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, name: form.name || 'count-check' })
      });
      if (r.ok) {
        const d = await r.json();
        setLeadCount(d.total_leads || 0);
        // Delete the test campaign if name was auto
        if (!form.name) await fetch(`/api/auto-email/campaigns/${d.id}`, { method: 'DELETE' });
        else { onDone(); return; }
      }
    } catch {}
    setCounting(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Campaign name required'); return; }
    if (!form.template_id) { setErr('Select a template'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/auto-email/campaigns', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, template_id: parseInt(form.template_id) })
      });
      if (r.ok) onDone();
      else { const d = await r.json(); setErr(d.error || 'Failed'); }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  const updateFilter = (key, val) => setForm(f => ({ ...f, filters: { ...f.filters, [key]: val } }));

  return (
    <div className="leads-modal-overlay" onClick={onClose}>
      <div className="leads-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:620, width:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontSize:'1rem', fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            <MI name="campaign" size={20} /> New Campaign
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        {err && <div style={{ background:'#fef2f2', color:'#dc2626', padding:'8px 12px', borderRadius:8, fontSize:'0.78rem', marginBottom:12 }}>{err}</div>}

        <form onSubmit={save}>
          {/* Name & Template */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div className="leads-form-field">
              <label>Campaign Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Russia Q3 Outreach" />
            </div>
            <div className="leads-form-field">
              <label>Template *</label>
              <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}>
                <option value="">Select template…</option>
                {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Language & Limits */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
            <div className="leads-form-field">
              <label>Language</label>
              <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>
            <div className="leads-form-field">
              <label>Daily Limit</label>
              <input type="number" min={1} max={500} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: parseInt(e.target.value) || 50 }))} />
            </div>
            <div className="leads-form-field">
              <label>LLM Personalization</label>
              <select value={form.llm_personalize ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, llm_personalize: e.target.value === 'yes' }))}>
                <option value="yes">✨ Enabled (AI)</option>
                <option value="no">Off (template only)</option>
              </select>
            </div>
          </div>

          {/* Send Window */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div className="leads-form-field">
              <label>Send Window Start</label>
              <input type="time" value={form.send_window_start} onChange={e => setForm(f => ({ ...f, send_window_start: e.target.value }))} />
            </div>
            <div className="leads-form-field">
              <label>Send Window End</label>
              <input type="time" value={form.send_window_end} onChange={e => setForm(f => ({ ...f, send_window_end: e.target.value }))} />
            </div>
          </div>

          {/* Lead Filters */}
          <div style={{ background:'#f8fafc', borderRadius:10, padding:14, marginBottom:16, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:'0.78rem', fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <MI name="filter_alt" size={16} /> Lead Filters
              <span style={{ fontSize:'0.68rem', fontWeight:400, color:'#9ca3af' }}>— narrow which leads receive this campaign</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <div className="leads-form-field">
                <label>Sector</label>
                <select value={form.filters.sector} onChange={e => updateFilter('sector', e.target.value)}>
                  <option value="">All sectors</option>
                  {Object.entries(SECTORS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="leads-form-field">
                <label>Priority</label>
                <select value={form.filters.priority} onChange={e => updateFilter('priority', e.target.value)}>
                  <option value="">All priorities</option>
                  {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="leads-form-field">
                <label>Lead Status</label>
                <select value={form.filters.status} onChange={e => updateFilter('status', e.target.value)}>
                  <option value="">All statuses</option>
                  {Object.entries(LEAD_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="leads-form-field">
                <label>Region</label>
                <input value={form.filters.region} onChange={e => updateFilter('region', e.target.value)} placeholder="e.g. Moscow" />
              </div>
              <div className="leads-form-field">
                <label>Country</label>
                <input value={form.filters.country} onChange={e => updateFilter('country', e.target.value)} placeholder="e.g. Russia" />
              </div>
            </div>
          </div>

          {leadCount !== null && (
            <div style={{ background:'#eff6ff', padding:'8px 14px', borderRadius:8, fontSize:'0.78rem', color:'#1e40af', fontWeight:600, marginBottom:14 }}>
              <MI name="groups" size={14} /> {leadCount} leads match these filters
            </div>
          )}

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Creating…' : 'Create Campaign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────
function PreviewModal({ campaignId, onClose }) {
  const [leadId, setLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  async function loadPreview() {
    if (!leadId) { setErr('Enter a lead ID'); return; }
    setLoading(true); setErr(''); setData(null);
    try {
      const r = await fetch(`/api/auto-email/campaigns/${campaignId}/preview`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ lead_id: parseInt(leadId) })
      });
      if (r.ok) setData(await r.json());
      else { const d = await r.json(); setErr(d.error || 'Failed'); }
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div className="leads-modal-overlay" onClick={onClose}>
      <div className="leads-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:700, width:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontSize:'1rem', fontWeight:700 }}>📧 Email Preview</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input type="number" placeholder="Enter Lead ID…" value={leadId} onChange={e => setLeadId(e.target.value)}
            style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.82rem' }} />
          <button onClick={loadPreview} disabled={loading} className="btn btn-primary btn-sm">
            {loading ? 'Loading…' : 'Preview'}
          </button>
        </div>

        {err && <div style={{ background:'#fef2f2', color:'#dc2626', padding:'8px 12px', borderRadius:8, fontSize:'0.78rem', marginBottom:12 }}>{err}</div>}

        {data && (
          <div>
            {/* Lead info */}
            <div style={{ background:'#f8fafc', borderRadius:8, padding:12, marginBottom:12, fontSize:'0.78rem', display:'flex', gap:16, flexWrap:'wrap' }}>
              <span><strong>Company:</strong> {data.lead?.company_name}</span>
              <span><strong>Email:</strong> {data.to}</span>
              <span><strong>Sector:</strong> {data.lead?.sector}</span>
              <span><strong>City:</strong> {data.lead?.city}</span>
            </div>

            {/* Personalization slots */}
            {(data.opener || data.valueProp) && (
              <div style={{ marginBottom:12 }}>
                {data.opener && (
                  <div style={{ background:'#eff6ff', borderRadius:8, padding:'8px 12px', fontSize:'0.78rem', marginBottom:6, borderLeft:'3px solid #3b82f6' }}>
                    <strong style={{ color:'#3b82f6' }}>AI Opener:</strong> {data.opener}
                  </div>
                )}
                {data.valueProp && (
                  <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px', fontSize:'0.78rem', borderLeft:'3px solid #10b981' }}>
                    <strong style={{ color:'#10b981' }}>AI Value Prop:</strong> {data.valueProp}
                  </div>
                )}
              </div>
            )}

            {/* Subject */}
            <div style={{ fontSize:'0.78rem', marginBottom:8 }}>
              <strong>Subject:</strong> {data.subject}
            </div>

            {/* Email body preview */}
            <div style={{ background:'#fff', borderRadius:10, padding:20, border:'1px solid #e5e7eb', fontSize:'0.82rem', lineHeight:1.7, whiteSpace:'pre-wrap', maxHeight:400, overflowY:'auto' }}>
              {data.body}
            </div>

            {/* HTML preview iframe */}
            <details style={{ marginTop:12 }}>
              <summary style={{ fontSize:'0.72rem', color:'#6b7280', cursor:'pointer' }}>View HTML Preview</summary>
              <iframe srcDoc={data.html} style={{ width:'100%', height:400, border:'1px solid var(--border)', borderRadius:8, marginTop:8 }} title="Email Preview" />
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
