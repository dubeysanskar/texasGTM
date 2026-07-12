'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

const PRESET_QUERIES_HH = [
  'рабочий на производство', 'сварщик завод', 'грузчик склад',
  'разнорабочий строительство', 'комплектовщик', 'складской рабочий',
];

const PRESET_QUERIES_WEB = [
  'производственное предприятие москва контакты email',
  'строительная компания россия email телефон',
  'завод набор персонала контакты',
  'металлургический завод email директор',
  'пищевое производство вакансии рабочие email',
];

export default function LeadScraperPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  // Scraper state
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [scrapeSource, setScrapeSource] = useState('2gis');
  const [scrapeQuery, setScrapeQuery] = useState('рабочий на производство');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedCities, setSelectedCities] = useState(['all']);
  const [maxLeads, setMaxLeads] = useState(100);

  // Google Dorking state
  const [dorkType, setDorkType] = useState('companies_with_email');
  const [dorkCity, setDorkCity] = useState('Москва');
  const [dorkIndustry, setDorkIndustry] = useState('производство');
  const [customDork, setCustomDork] = useState('');

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);
  const [enrichStats, setEnrichStats] = useState(null);
  const [enrichMode, setEnrichMode] = useState('force_all');
  const [enrichMaxLeads, setEnrichMaxLeads] = useState(200);

  // Config & history
  const [config, setConfig] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && user && !isAdmin) router.push('/dashboard');
  }, [user, authLoading, router, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetch('/api/leads/scrape?config=1').then(r => r.json()).then(setConfig).catch(() => {});
    }
  }, [user, isAdmin]);

  const fetchJobs = useCallback(async () => {
    try { const res = await fetch('/api/leads/scrape'); if (res.ok) setJobs(await res.json()); } catch {}
    setLoadingJobs(false);
  }, []);

  const fetchEnrichStats = useCallback(async () => {
    try { const res = await fetch('/api/leads/enrich'); if (res.ok) setEnrichStats(await res.json()); } catch {}
  }, []);

  useEffect(() => { if (user && isAdmin) { fetchJobs(); fetchEnrichStats(); } }, [user, isAdmin, fetchJobs, fetchEnrichStats]);

  // ─── Scrape Handler ────────────────────────────────────
  async function handleScrape() {
    setScraping(true); setScrapeResult(null);
    try {
      const body = { source: scrapeSource, maxLeads };

      if (scrapeSource === '2gis') {
        body.industry = selectedIndustry;
        body.cities = selectedCities.includes('all') ? [] : selectedCities;
      } else if (scrapeSource === 'google_dork') {
        body.dorkType = dorkType;
        body.dorkVars = { city: dorkCity, industry: dorkIndustry };
        body.customDork = customDork;
      } else {
        body.query = scrapeQuery;
      }

      const res = await fetch('/api/leads/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { setScrapeResult({ ok: true, added: data.added, skipped: data.skipped, found: data.leads_found }); fetchJobs(); fetchEnrichStats(); }
      else { setScrapeResult({ ok: false, error: data.error }); }
    } catch (e) { setScrapeResult({ ok: false, error: e.message }); }
    setScraping(false);
  }

  // ─── Enrich Handler ────────────────────────────────────
  async function handleEnrich() {
    setEnriching(true); setEnrichResult(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: enrichMode, maxLeads: enrichMaxLeads }),
      });
      const data = await res.json();
      if (res.ok) { setEnrichResult({ ok: true, ...data }); fetchEnrichStats(); fetchJobs(); }
      else { setEnrichResult({ ok: false, error: data.error }); }
    } catch (e) { setEnrichResult({ ok: false, error: e.message }); }
    setEnriching(false);
  }

  // ─── City toggle ───────────────────────────────────────
  function toggleCity(key) {
    if (key === 'all') { setSelectedCities(['all']); return; }
    setSelectedCities(prev => {
      const without = prev.filter(c => c !== 'all' && c !== key);
      if (prev.includes(key)) return without.length ? without : ['all'];
      return [...without, key];
    });
  }

  if (authLoading || !user || !isAdmin) return <div className="page-loading">Loading...</div>;

  const sourceIcon = { '2gis': '🗺️', 'hh.ru': '💼', 'superjob': '📋', 'web_search': '🌐', 'google_dork': '🔍' };
  const sourceLabel = { '2gis': '2GIS', 'hh.ru': 'hh.ru', 'superjob': 'SuperJob', 'web_search': 'Web Search', 'google_dork': 'Google Dorking', 'enrichment': '🔄 Enrichment' };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1><MI name="travel_explore" size={26} /> Lead Scraper</h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
          5 sources: 2GIS · hh.ru · SuperJob · Web Search · Google Dorking
        </p>
      </div>

      {/* ═══ SCRAPE PANEL ═══ */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Scrape New Leads</span>
        </div>

        {/* Row 1: Source + MaxLeads + Run */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ minWidth: 180 }}>
            <label className="scraper-label">Source</label>
            <select value={scrapeSource} onChange={e => setScrapeSource(e.target.value)} className="leads-select" style={{ width: '100%' }}>
              <option value="2gis">🗺️ 2GIS (Business Directory)</option>
              <option value="google_dork">🔍 Google Dorking (Advanced)</option>
              <option value="web_search">🌐 Web Search (Keyword → Site Crawl)</option>
              <option value="hh.ru">💼 hh.ru (Job Board)</option>
              <option value="superjob">📋 SuperJob (Job Board)</option>
            </select>
          </div>

          <div style={{ minWidth: 100 }}>
            <label className="scraper-label">Max Leads</label>
            <select value={maxLeads} onChange={e => setMaxLeads(Number(e.target.value))} className="leads-select" style={{ width: '100%' }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* 2GIS: Industry selector */}
          {scrapeSource === '2gis' && config && (
            <div style={{ minWidth: 180 }}>
              <label className="scraper-label">Industry</label>
              <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} className="leads-select" style={{ width: '100%' }}>
                {config.industries.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          )}

          {/* Google Dorking: Dork type */}
          {scrapeSource === 'google_dork' && config && (
            <div style={{ minWidth: 220 }}>
              <label className="scraper-label">Dork Type</label>
              <select value={dorkType} onChange={e => setDorkType(e.target.value)} className="leads-select" style={{ width: '100%' }}>
                {config.dorkPresets?.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          {/* Web Search / hh.ru / SuperJob: Query */}
          {(scrapeSource === 'web_search' || scrapeSource === 'hh.ru' || scrapeSource === 'superjob') && (
            <div style={{ flex: 1, minWidth: 250 }}>
              <label className="scraper-label">Search Query (Russian)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="Enter search keywords..." />
                <select onChange={e => setScrapeQuery(e.target.value)} className="leads-select" style={{ fontSize: '0.72rem', maxWidth: 180 }}>
                  <option value="">Presets...</option>
                  {(scrapeSource === 'web_search' ? PRESET_QUERIES_WEB : PRESET_QUERIES_HH).map(q => (
                    <option key={q} value={q}>{q.length > 35 ? q.slice(0, 35) + '…' : q}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button onClick={handleScrape} disabled={scraping} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}>
            {scraping ? <><span className="spinner-sm" /> Scraping…</> : <><MI name="play_arrow" size={16} /> Run Scrape</>}
          </button>
        </div>

        {/* Google Dorking: Variables */}
        {scrapeSource === 'google_dork' && (
          <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
              <div style={{ minWidth: 160 }}>
                <label className="scraper-label">City</label>
                <input value={dorkCity} onChange={e => setDorkCity(e.target.value)} className="form-input" placeholder="e.g. Москва" />
              </div>
              <div style={{ minWidth: 160 }}>
                <label className="scraper-label">Industry (Russian)</label>
                <input value={dorkIndustry} onChange={e => setDorkIndustry(e.target.value)} className="form-input" placeholder="e.g. производство" />
              </div>
              {dorkType === 'custom' && (
                <div style={{ flex: 1, minWidth: 280 }}>
                  <label className="scraper-label">Custom Dork Query</label>
                  <input value={customDork} onChange={e => setCustomDork(e.target.value)} className="form-input" placeholder='e.g. intitle:контакты "строительная компания" "@" site:.ru' />
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              💡 <strong>Operators:</strong> <code>site:.ru</code> (Russian sites only) · <code>intitle:контакты</code> (contact pages) · <code>"@domain.ru"</code> (find emails) · <code>"exact phrase"</code> (exact match)
            </div>
          </div>
        )}

        {/* 2GIS: City selector chips */}
        {scrapeSource === '2gis' && config && (
          <div style={{ marginBottom: 8 }}>
            <label className="scraper-label">Cities (click to toggle)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <CityChip label="All Cities" active={selectedCities.includes('all')} onClick={() => toggleCity('all')} />
              {config.cities.map(c => (
                <CityChip key={c.key} label={`${c.nameEn || c.name}`} active={selectedCities.includes(c.key)} onClick={() => toggleCity(c.key)} />
              ))}
            </div>
            {!selectedCities.includes('all') && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                ⚡ Est. API usage: ~{(selectedCities.length * (selectedIndustry === 'all' ? 30 : 3))} of 1000 requests
              </div>
            )}
          </div>
        )}

        {/* Scrape result */}
        {scrapeResult && (
          <div style={{ marginTop: 14, fontSize: '0.82rem', padding: '10px 16px', borderRadius: 10, background: scrapeResult.ok ? '#f0fdf4' : '#fef2f2', color: scrapeResult.ok ? '#166534' : '#dc2626', border: `1px solid ${scrapeResult.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {scrapeResult.ok
              ? `✓ Done: ${scrapeResult.added} new leads added, ${scrapeResult.skipped} duplicates skipped (${scrapeResult.found} total found)`
              : `✗ Failed: ${scrapeResult.error}`}
          </div>
        )}
      </div>

      {/* ═══ ENRICHMENT PANEL ═══ */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Enrich Leads (Fix Emails & Phones)</span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Uses <strong>4 fallback sources</strong> to find correct contacts: Website crawling → 2GIS lookup → hh.ru employer search → Email pattern guessing
        </div>

        {/* Enrichment stats */}
        {enrichStats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <StatCard value={enrichStats.total} label="Total Leads" bg="#f0f9ff" border="#bae6fd" color="#0369a1" />
            <StatCard value={enrichStats.has_email} label="Have Email" bg="#f0fdf4" border="#bbf7d0" color="#166534" />
            <StatCard value={enrichStats.missing_email} label="Missing Email" bg="#fef2f2" border="#fecaca" color="#dc2626" />
            <StatCard value={enrichStats.has_phone} label="Have Phone" bg="#f0fdf4" border="#bbf7d0" color="#166534" />
            <StatCard value={enrichStats.missing_phone} label="Missing Phone" bg="#fef3c7" border="#fde68a" color="#d97706" />
          </div>
        )}

        {/* Enrich controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <label className="scraper-label">Enrichment Mode</label>
            <select value={enrichMode} onChange={e => setEnrichMode(e.target.value)} className="leads-select" style={{ width: '100%' }}>
              <option value="force_all">🔄 Force Re-enrich All (overwrite wrong data)</option>
              <option value="missing">📭 Only Missing (empty email/phone)</option>
            </select>
          </div>

          <div style={{ minWidth: 100 }}>
            <label className="scraper-label">Max Leads</label>
            <select value={enrichMaxLeads} onChange={e => setEnrichMaxLeads(Number(e.target.value))} className="leads-select" style={{ width: '100%' }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <button onClick={handleEnrich} disabled={enriching} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            {enriching
              ? <><span className="spinner-sm" /> Enriching…</>
              : <><MI name="auto_fix_high" size={16} /> {enrichMode === 'force_all' ? `Re-enrich (up to ${enrichMaxLeads})` : `Enrich Missing (${enrichStats?.missing_email || 0})`}</>
            }
          </button>
        </div>

        {enrichMode === 'force_all' && (
          <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#d97706', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, border: '1px solid #fde68a' }}>
            ⚠️ Force mode will <strong>overwrite existing emails & phones</strong> with freshly scraped data. Use this to fix leads with wrong/old contact info.
          </div>
        )}

        {enrichResult && (
          <div style={{ marginTop: 14, fontSize: '0.82rem', padding: '12px 16px', borderRadius: 10, background: enrichResult.ok ? '#f0fdf4' : '#fef2f2', color: enrichResult.ok ? '#166534' : '#dc2626', border: `1px solid ${enrichResult.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {enrichResult.ok ? (
              <>
                ✓ Enrichment complete<br />
                <strong>{enrichResult.enriched}</strong> of {enrichResult.total} leads updated<br />
                📧 {enrichResult.emails_found} emails found &nbsp;|&nbsp; 📞 {enrichResult.phones_found} phones found &nbsp;|&nbsp; ❌ {enrichResult.failed} failed
              </>
            ) : `✗ Failed: ${enrichResult.error}`}
          </div>
        )}
      </div>

      {/* ═══ JOB HISTORY ═══ */}
      <div className="card">
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 16 }}>Scrape & Enrichment History</h3>
        {loadingJobs ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <MI name="history" size={36} />
            <p style={{ marginTop: 8 }}>No scrape jobs yet. Run your first scrape above.</p>
          </div>
        ) : (
          <div className="leads-table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Found</th>
                  <th>Added</th>
                  <th>Skipped</th>
                  <th>Started</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="leads-row">
                    <td style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {sourceIcon[j.source] || '📊'} {sourceLabel[j.source] || j.source}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#6b7280', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.query || '—'}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                        background: j.status === 'completed' ? '#dcfce7' : j.status === 'failed' ? '#fee2e2' : j.status === 'running' ? '#dbeafe' : '#f3f4f6',
                        color: j.status === 'completed' ? '#166534' : j.status === 'failed' ? '#991b1b' : j.status === 'running' ? '#1e40af' : '#6b7280',
                      }}>{j.status}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{j.leads_found ?? 0}</td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{j.leads_added ?? 0}</td>
                    <td style={{ textAlign: 'center', color: '#f59e0b' }}>{j.leads_skipped ?? 0}</td>
                    <td style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────
function CityChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-muted)',
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function StatCard({ value, label, bg, border, color }) {
  return (
    <div style={{ padding: '8px 16px', borderRadius: 10, background: bg, border: `1px solid ${border}`, textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value ?? 0}</div>
      <div style={{ fontSize: '0.68rem', color }}>{label}</div>
    </div>
  );
}
