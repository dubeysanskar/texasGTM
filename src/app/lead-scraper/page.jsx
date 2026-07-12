'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

const PRESET_QUERIES_HH = ['рабочий на производство', 'сварщик завод', 'грузчик склад', 'разнорабочий строительство', 'комплектовщик', 'складской рабочий'];
const PRESET_QUERIES_WEB = ['производственное предприятие москва контакты email', 'строительная компания россия email телефон', 'завод набор персонала контакты', 'металлургический завод email директор', 'пищевое производство вакансии рабочие email'];

export default function LeadScraperPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  // Scraper
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [scrapeSource, setScrapeSource] = useState('2gis');
  const [scrapeQuery, setScrapeQuery] = useState('рабочий на производство');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedCities, setSelectedCities] = useState(['all']);
  const [maxLeads, setMaxLeads] = useState(100);
  const [dorkType, setDorkType] = useState('companies_with_email');
  const [dorkCity, setDorkCity] = useState('Москва');
  const [dorkIndustry, setDorkIndustry] = useState('производство');
  const [customDork, setCustomDork] = useState('');

  // Enrichment
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);
  const [enrichStats, setEnrichStats] = useState(null);
  const [enrichMode, setEnrichMode] = useState('force_all');
  const [enrichMaxLeads, setEnrichMaxLeads] = useState(100);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  // Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyStats, setVerifyStats] = useState(null);
  const [deepVerifying, setDeepVerifying] = useState(false);
  const [deepVerifyResult, setDeepVerifyResult] = useState(null);

  // Config & history
  const [config, setConfig] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.push('/'); if (!authLoading && user && !isAdmin) router.push('/dashboard'); }, [user, authLoading, router, isAdmin]);
  useEffect(() => { if (user && isAdmin) fetch('/api/leads/scrape?config=1').then(r => r.json()).then(setConfig).catch(() => {}); }, [user, isAdmin]);

  const fetchJobs = useCallback(async () => { try { const r = await fetch('/api/leads/scrape'); if (r.ok) setJobs(await r.json()); } catch {} setLoadingJobs(false); }, []);
  const fetchEnrichStats = useCallback(async () => { try { const r = await fetch('/api/leads/enrich'); if (r.ok) { const d = await r.json(); setEnrichStats(d); if (!rangeFrom) setRangeFrom(String(d.min_id || 1)); if (!rangeTo) setRangeTo(String(d.max_id || 100)); } } catch {} }, []);
  const fetchVerifyStats = useCallback(async () => { setVerifying(true); try { const r = await fetch('/api/leads/verify'); if (r.ok) setVerifyStats(await r.json()); } catch {} setVerifying(false); }, []);

  useEffect(() => { if (user && isAdmin) { fetchJobs(); fetchEnrichStats(); fetchVerifyStats(); } }, [user, isAdmin, fetchJobs, fetchEnrichStats, fetchVerifyStats]);

  // ─── Handlers ──────────────────────────────────────────
  async function handleScrape() {
    setScraping(true); setScrapeResult(null);
    try {
      const body = { source: scrapeSource, maxLeads };
      if (scrapeSource === '2gis') { body.industry = selectedIndustry; body.cities = selectedCities.includes('all') ? [] : selectedCities; }
      else if (scrapeSource === 'google_dork') { body.dorkType = dorkType; body.dorkVars = { city: dorkCity, industry: dorkIndustry }; body.customDork = customDork; }
      else body.query = scrapeQuery;
      const res = await fetch('/api/leads/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { setScrapeResult({ ok: true, added: data.added, skipped: data.skipped, found: data.leads_found }); fetchJobs(); fetchEnrichStats(); fetchVerifyStats(); }
      else setScrapeResult({ ok: false, error: data.error });
    } catch (e) { setScrapeResult({ ok: false, error: e.message }); }
    setScraping(false);
  }

  async function handleEnrich() {
    setEnriching(true); setEnrichResult(null);
    try {
      const body = { mode: enrichMode, maxLeads: enrichMaxLeads };
      if (rangeFrom && rangeTo) { body.rangeFrom = parseInt(rangeFrom); body.rangeTo = parseInt(rangeTo); }
      const res = await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { setEnrichResult({ ok: true, ...data }); fetchEnrichStats(); fetchJobs(); fetchVerifyStats(); }
      else setEnrichResult({ ok: false, error: data.error });
    } catch (e) { setEnrichResult({ ok: false, error: e.message }); }
    setEnriching(false);
  }

  async function handleDeepVerify(smtpCheck = false) {
    setDeepVerifying(true); setDeepVerifyResult(null);
    try {
      const res = await fetch('/api/leads/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxLeads: 200, smtpCheck }) });
      if (res.ok) setDeepVerifyResult(await res.json());
    } catch {}
    setDeepVerifying(false);
  }

  async function handleEnrichBadOnly() {
    if (!verifyStats?.bad_lead_ids?.length) return;
    setEnriching(true); setEnrichResult(null);
    try {
      const res = await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'selected', leadIds: verifyStats.bad_lead_ids.slice(0, enrichMaxLeads) }) });
      const data = await res.json();
      if (res.ok) { setEnrichResult({ ok: true, ...data }); fetchEnrichStats(); fetchVerifyStats(); fetchJobs(); }
      else setEnrichResult({ ok: false, error: data.error });
    } catch (e) { setEnrichResult({ ok: false, error: e.message }); }
    setEnriching(false);
  }

  function toggleCity(key) {
    if (key === 'all') { setSelectedCities(['all']); return; }
    setSelectedCities(prev => { const w = prev.filter(c => c !== 'all' && c !== key); return prev.includes(key) ? (w.length ? w : ['all']) : [...w, key]; });
  }

  if (authLoading || !user || !isAdmin) return <div className="page-loading">Loading...</div>;

  const srcIcon = { '2gis': '🗺️', 'hh.ru': '💼', 'superjob': '📋', 'web_search': '🌐', 'google_dork': '🔍', 'enrichment': '🔄' };
  const srcLabel = { '2gis': '2GIS', 'hh.ru': 'hh.ru', 'superjob': 'SuperJob', 'web_search': 'Web Search', 'google_dork': 'Dorking', 'enrichment': 'Enrichment' };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1><MI name="travel_explore" size={26} /> Lead Scraper</h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>5 sources · Email verification · Smart enrichment with range filtering</p>
      </div>

      {/* ═══ SCRAPE PANEL ═══ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle color="#1D9E75" title="Scrape New Leads" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
          <Field label="Source">
            <select value={scrapeSource} onChange={e => setScrapeSource(e.target.value)} className="leads-select" style={{ width: '100%', minWidth: 180 }}>
              <option value="2gis">🗺️ 2GIS (Business Directory)</option>
              <option value="google_dork">🔍 Google Dorking (Advanced)</option>
              <option value="web_search">🌐 Web Search (Crawl Sites)</option>
              <option value="hh.ru">💼 hh.ru (Job Board)</option>
              <option value="superjob">📋 SuperJob (Job Board)</option>
            </select>
          </Field>
          <Field label="Max Leads">
            <select value={maxLeads} onChange={e => setMaxLeads(Number(e.target.value))} className="leads-select" style={{ width: 90 }}>
              {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          {scrapeSource === '2gis' && config && (
            <Field label="Industry">
              <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} className="leads-select" style={{ width: '100%', minWidth: 160 }}>
                {config.industries.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </Field>
          )}
          {scrapeSource === 'google_dork' && config && (
            <Field label="Dork Type">
              <select value={dorkType} onChange={e => setDorkType(e.target.value)} className="leads-select" style={{ width: '100%', minWidth: 200 }}>
                {config.dorkPresets?.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
          )}
          {['web_search', 'hh.ru', 'superjob'].includes(scrapeSource) && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="scraper-label">Search Query</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="Enter keywords..." />
                <select onChange={e => e.target.value && setScrapeQuery(e.target.value)} className="leads-select" style={{ fontSize: '0.7rem', maxWidth: 150 }}>
                  <option value="">Presets</option>
                  {(scrapeSource === 'web_search' ? PRESET_QUERIES_WEB : PRESET_QUERIES_HH).map(q => <option key={q} value={q}>{q.slice(0, 30)}…</option>)}
                </select>
              </div>
            </div>
          )}
          <button onClick={handleScrape} disabled={scraping} className="btn btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            {scraping ? <><span className="spinner-sm" /> Scraping…</> : <><MI name="play_arrow" size={16} /> Run Scrape</>}
          </button>
        </div>

        {scrapeSource === 'google_dork' && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <Field label="City"><input value={dorkCity} onChange={e => setDorkCity(e.target.value)} className="form-input" style={{ width: 140 }} /></Field>
              <Field label="Industry"><input value={dorkIndustry} onChange={e => setDorkIndustry(e.target.value)} className="form-input" style={{ width: 140 }} /></Field>
              {dorkType === 'custom' && <div style={{ flex: 1, minWidth: 260 }}><label className="scraper-label">Custom Dork</label><input value={customDork} onChange={e => setCustomDork(e.target.value)} className="form-input" style={{ width: '100%' }} placeholder='intitle:контакты "строительная" "@" site:.ru' /></div>}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>💡 <code>site:.ru</code> · <code>intitle:контакты</code> · <code>"@domain.ru"</code> · <code>"exact phrase"</code></div>
          </div>
        )}

        {scrapeSource === '2gis' && config && (
          <div style={{ marginBottom: 8 }}>
            <label className="scraper-label">Cities</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              <Chip label="All Cities" active={selectedCities.includes('all')} onClick={() => toggleCity('all')} />
              {config.cities.map(c => <Chip key={c.key} label={c.nameEn || c.name} active={selectedCities.includes(c.key)} onClick={() => toggleCity(c.key)} />)}
            </div>
          </div>
        )}

        <ResultBanner result={scrapeResult} successMsg={r => `✓ ${r.added} new leads added, ${r.skipped} duplicates skipped (${r.found} found)`} />
      </div>

      {/* ═══ WARNING BANNER — ALL EMAILS ARE WRONG ═══ */}
      {enrichStats && enrichStats.total > 0 && (
        <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: '#fff', boxShadow: '0 4px 20px rgba(220,38,38,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.6rem' }}>🚨</span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                ALL {enrichStats.total} LEADS HAVE WRONG EMAILS
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: 2 }}>
                Emails were auto-generated by job boards (hh.ru) and do NOT belong to the actual companies.
                You must re-enrich to get real company contacts from websites & 2GIS.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <button onClick={() => { setEnrichMode('force_all'); setEnrichMaxLeads(enrichStats.total); handleEnrich(); }} disabled={enriching} style={{ padding: '10px 28px', borderRadius: 8, border: '2px solid #fff', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: enriching ? 'not-allowed' : 'pointer', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {enriching ? <><span className="spinner-sm" /> RE-ENRICHING…</> : <>🔄 RE-ENRICH ALL {enrichStats.total} LEADS NOW</>}
            </button>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>
              This will scrape real emails from company websites, 2GIS, and hh.ru employer profiles
            </span>
          </div>
        </div>
      )}

      {/* ═══ EMAIL VERIFICATION PANEL ═══ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle color="#8B5CF6" title="Email Quality Verification" />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Checks format, placeholder detection, and DNS MX records. <strong style={{ color: '#dc2626' }}>Note: Even "valid format" emails may be WRONG — they look like emails but belong to the wrong companies.</strong>
        </p>

        {verifying ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid #e9d5ff', borderTop: '3px solid #8B5CF6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ marginTop: 10, fontWeight: 600, color: '#6b21a8', fontSize: '0.85rem' }}>Scanning {enrichStats?.total || '...'} leads for email quality...</div>
            <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#9ca3af' }}>Checking format, placeholder patterns, and domain validity</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : verifyStats ? (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <StatCard value={verifyStats.total} label="Total Leads" color="#0369a1" bg="#f0f9ff" border="#bae6fd" />
              <StatCard value={verifyStats.valid_format} label="Valid Format ≠ Correct" color="#d97706" bg="#fffbeb" border="#fde68a" />
              <StatCard value={verifyStats.invalid_format} label="❌ Bad Format" color="#dc2626" bg="#fef2f2" border="#fecaca" />
              <StatCard value={verifyStats.placeholder} label="🗑️ Placeholder" color="#9333ea" bg="#faf5ff" border="#e9d5ff" />
              <StatCard value={verifyStats.empty} label="📭 Empty" color="#6b7280" bg="#f9fafb" border="#e5e7eb" />
            </div>

            {/* Explicit warning that valid format ≠ correct email */}
            {verifyStats.valid_format > 0 && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#fef3c7', border: '1px solid #f59e0b', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚠️</span>
                <div style={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.5 }}>
                  <strong>{verifyStats.valid_format} emails pass format check</strong> but this does NOT mean they are correct.
                  These emails were scraped from hh.ru job postings and likely belong to recruitment accounts, not the actual companies.
                  <strong> Use "Re-enrich" above to replace them with real company emails.</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => handleDeepVerify(false)} disabled={deepVerifying} className="btn" style={{ padding: '8px 16px', fontSize: '0.78rem', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8 }}>
                {deepVerifying ? <><span className="spinner-sm" /> Verifying…</> : <><MI name="dns" size={14} /> Check MX Records</>}
              </button>
              <button onClick={() => handleDeepVerify(true)} disabled={deepVerifying} className="btn" style={{ padding: '8px 16px', fontSize: '0.78rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8 }}>
                {deepVerifying ? <><span className="spinner-sm" /> Connecting to mail servers…</> : <><MI name="mark_email_read" size={14} /> Verify Mailboxes Exist (SMTP)</>}
              </button>
              {verifyStats.bad_total > 0 && (
                <button onClick={handleEnrichBadOnly} disabled={enriching} className="btn" style={{ padding: '8px 16px', fontSize: '0.78rem', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8 }}>
                  {enriching ? <><span className="spinner-sm" /> Fixing…</> : <><MI name="build" size={14} /> Fix {verifyStats.bad_total} Bad Format</>}
                </button>
              )}
              <button onClick={fetchVerifyStats} className="btn" style={{ padding: '8px 10px', fontSize: '0.78rem', background: 'transparent', color: '#8B5CF6', border: '1px solid #8B5CF6', borderRadius: 8 }}>
                <MI name="refresh" size={14} />
              </button>
            </div>
          </>
        ) : null}

        {/* Deep verify progress */}
        {deepVerifying && (
          <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #e9d5ff', borderTop: '2px solid #8B5CF6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#6b21a8' }}>Deep verification in progress...</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>Checking DNS MX records for each email domain — verifying mail servers actually exist. This can take 30-60 seconds.</div>
              </div>
            </div>
            <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: '#e9d5ff', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#8B5CF6', borderRadius: 2, animation: 'progress 2s ease-in-out infinite', width: '60%' }} />
            </div>
            <style>{`@keyframes progress { 0% { width: 10%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 10%; margin-left: 90%; } }`}</style>
          </div>
        )}

        {/* Deep verify results */}
        {deepVerifyResult && !deepVerifying && (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 8 }}>🔬 Verification Results ({deepVerifyResult.total_checked} emails checked)</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <MiniStat label="✅ MX Valid" value={deepVerifyResult.valid} color="#166534" />
              <MiniStat label="❌ Bad Format" value={deepVerifyResult.invalid_format} color="#dc2626" />
              <MiniStat label="🚫 No Mail Server" value={deepVerifyResult.no_mx} color="#991b1b" />
              <MiniStat label="🗑️ Placeholder" value={deepVerifyResult.placeholder} color="#9333ea" />
              <MiniStat label="🔀 Wrong Domain" value={deepVerifyResult.domain_mismatch} color="#d97706" />
              <MiniStat label="🤔 Suspicious" value={deepVerifyResult.suspicious} color="#ea580c" />
              {(deepVerifyResult.smtp_exists > 0 || deepVerifyResult.smtp_not_exists > 0) && (
                <>
                  <span style={{ borderLeft: '2px solid #e9d5ff', paddingLeft: 10, display: 'flex', gap: 10 }}>
                    <MiniStat label="📬 Mailbox Exists" value={deepVerifyResult.smtp_exists} color="#166534" />
                    <MiniStat label="📭 Mailbox NOT Exists" value={deepVerifyResult.smtp_not_exists} color="#dc2626" />
                    <MiniStat label="❓ Unknown" value={deepVerifyResult.smtp_unknown} color="#6b7280" />
                  </span>
                </>
              )}
            </div>
            {deepVerifyResult.details?.length > 0 && (
              <details style={{ fontSize: '0.72rem' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#6b21a8' }}>Show {deepVerifyResult.details.length} problematic emails</summary>
                <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                    <thead><tr style={{ borderBottom: '2px solid #e9d5ff', background: '#f5f3ff' }}><th style={{ textAlign: 'left', padding: '6px 4px' }}>ID</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>Company</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>Current Email</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>Problem</th></tr></thead>
                    <tbody>
                      {deepVerifyResult.details.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #f3e8ff' }}>
                          <td style={{ padding: '4px', color: '#6b7280' }}>#{d.id}</td>
                          <td style={{ padding: '4px', fontWeight: 500 }}>{d.company?.slice(0, 28)}</td>
                          <td style={{ padding: '4px', color: '#dc2626', fontFamily: 'monospace', fontSize: '0.68rem' }}>{d.email || '(empty)'}</td>
                          <td style={{ padding: '4px', color: '#9333ea', fontSize: '0.68rem' }}>{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </div>


      {/* ═══ ENRICHMENT PANEL ═══ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle color="#3B82F6" title="Enrich Leads (Fix Emails & Phones)" />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
          4 fallback sources: Website crawling → 2GIS lookup → hh.ru search → Email guessing
        </p>

        {enrichStats && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <StatCard value={enrichStats.total} label="Total" color="#0369a1" bg="#f0f9ff" border="#bae6fd" />
            <StatCard value={enrichStats.has_email} label="Have Email" color="#166534" bg="#f0fdf4" border="#bbf7d0" />
            <StatCard value={enrichStats.missing_email} label="No Email" color="#dc2626" bg="#fef2f2" border="#fecaca" />
            <StatCard value={enrichStats.has_phone} label="Have Phone" color="#166534" bg="#f0fdf4" border="#bbf7d0" />
            <StatCard value={enrichStats.missing_phone} label="No Phone" color="#d97706" bg="#fffbeb" border="#fde68a" />
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <Field label="Mode">
            <select value={enrichMode} onChange={e => setEnrichMode(e.target.value)} className="leads-select" style={{ minWidth: 220 }}>
              <option value="force_all">🔄 Force Re-enrich (overwrite wrong data)</option>
              <option value="missing">📭 Only Missing (empty email/phone)</option>
            </select>
          </Field>
          <Field label="Max Leads">
            <select value={enrichMaxLeads} onChange={e => setEnrichMaxLeads(Number(e.target.value))} className="leads-select" style={{ width: 90 }}>
              {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label={`From ID ${enrichStats ? `(min: ${enrichStats.min_id})` : ''}`}>
            <input type="number" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="form-input" style={{ width: 90 }} placeholder="From" />
          </Field>
          <Field label={`To ID ${enrichStats ? `(max: ${enrichStats.max_id})` : ''}`}>
            <input type="number" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="form-input" style={{ width: 90 }} placeholder="To" />
          </Field>
          <button onClick={handleEnrich} disabled={enriching} className="btn btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            {enriching ? <><span className="spinner-sm" /> Enriching…</> : <><MI name="auto_fix_high" size={16} /> Run Enrichment</>}
          </button>
        </div>

        {enrichMode === 'force_all' && (
          <div style={{ fontSize: '0.7rem', color: '#d97706', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a', marginBottom: 10 }}>
            ⚠️ Force mode <strong>overwrites existing emails & phones</strong> with freshly scraped data.
          </div>
        )}

        <ResultBanner result={enrichResult} successMsg={r => `✓ ${r.enriched}/${r.total} updated — 📧 ${r.emails_found} emails · 📞 ${r.phones_found} phones · ❌ ${r.failed} failed`} />

        {/* Change log */}
        {enrichResult?.ok && enrichResult.changes?.length > 0 && (
          <details style={{ marginTop: 10, fontSize: '0.72rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#1e40af' }}>📋 View {enrichResult.changes.length} changes</summary>
            <div style={{ maxHeight: 250, overflow: 'auto', marginTop: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead><tr style={{ borderBottom: '1px solid #dbeafe' }}><th style={{ textAlign: 'left', padding: 4 }}>ID</th><th style={{ textAlign: 'left', padding: 4 }}>Company</th><th style={{ textAlign: 'left', padding: 4 }}>Old Email</th><th style={{ textAlign: 'left', padding: 4 }}>→ New Email</th><th style={{ textAlign: 'left', padding: 4 }}>Source</th></tr></thead>
                <tbody>
                  {enrichResult.changes.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eff6ff' }}>
                      <td style={{ padding: 4, color: '#6b7280' }}>#{c.id}</td>
                      <td style={{ padding: 4 }}>{c.company?.slice(0, 22)}</td>
                      <td style={{ padding: 4, color: '#dc2626', fontFamily: 'monospace', fontSize: '0.68rem', textDecoration: 'line-through' }}>{c.old_email}</td>
                      <td style={{ padding: 4, color: '#166534', fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 600 }}>{c.new_email}</td>
                      <td style={{ padding: 4, color: '#6b7280' }}>{c.sources?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* ═══ JOB HISTORY ═══ */}
      <div className="card">
        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 14 }}>History</h3>
        {loadingJobs ? <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Loading...</div> : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}><MI name="history" size={32} /><p style={{ marginTop: 6, fontSize: '0.78rem' }}>No jobs yet</p></div>
        ) : (
          <div className="leads-table-wrap"><table className="leads-table"><thead><tr><th>Source</th><th>Details</th><th>Status</th><th>Found</th><th>Added</th><th>Skip</th><th>Started</th></tr></thead><tbody>
            {jobs.map(j => (
              <tr key={j.id} className="leads-row">
                <td style={{ fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{srcIcon[j.source] || '📊'} {srcLabel[j.source] || j.source}</td>
                <td style={{ fontSize: '0.72rem', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.query || '—'}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 16, fontSize: '0.68rem', fontWeight: 600, background: j.status === 'completed' ? '#dcfce7' : j.status === 'failed' ? '#fee2e2' : '#dbeafe', color: j.status === 'completed' ? '#166534' : j.status === 'failed' ? '#991b1b' : '#1e40af' }}>{j.status}</span></td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{j.leads_found ?? 0}</td>
                <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{j.leads_added ?? 0}</td>
                <td style={{ textAlign: 'center', color: '#f59e0b' }}>{j.leads_skipped ?? 0}</td>
                <td style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}

// ─── Small Components ────────────────────────────────────────
function SectionTitle({ color, title }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} /><span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{title}</span></div>;
}
function Field({ label, children }) {
  return <div><label className="scraper-label">{label}</label>{children}</div>;
}
function Chip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: '3px 10px', borderRadius: 16, border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>{label}</button>;
}
function StatCard({ value, label, color, bg, border }) {
  return <div style={{ padding: '6px 14px', borderRadius: 8, background: bg, border: `1px solid ${border}`, textAlign: 'center', minWidth: 70 }}><div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value ?? 0}</div><div style={{ fontSize: '0.65rem', color }}>{label}</div></div>;
}
function MiniStat({ label, value, color }) {
  return <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}: {value ?? 0}</span>;
}
function ResultBanner({ result, successMsg }) {
  if (!result) return null;
  return <div style={{ marginTop: 10, fontSize: '0.8rem', padding: '8px 14px', borderRadius: 8, background: result.ok ? '#f0fdf4' : '#fef2f2', color: result.ok ? '#166534' : '#dc2626', border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}` }}>
    {result.ok ? successMsg(result) : `✗ ${result.error}`}
  </div>;
}
