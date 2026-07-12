'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;
const PRESET_QUERIES = ['рабочий на производство', 'сварщик завод', 'грузчик склад', 'разнорабочий строительство', 'комплектовщик', 'складской рабочий'];

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

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);
  const [enrichStats, setEnrichStats] = useState(null);

  // Config & history
  const [config, setConfig] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && user && !isAdmin) router.push('/dashboard');
  }, [user, authLoading, router, isAdmin]);

  // Fetch config (cities, industries)
  useEffect(() => {
    if (user && isAdmin) {
      fetch('/api/leads/scrape?config=1').then(r => r.json()).then(setConfig).catch(() => {});
    }
  }, [user, isAdmin]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/scrape');
      if (res.ok) setJobs(await res.json());
    } catch {}
    setLoadingJobs(false);
  }, []);

  const fetchEnrichStats = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/enrich');
      if (res.ok) setEnrichStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { if (user && isAdmin) { fetchJobs(); fetchEnrichStats(); } }, [user, isAdmin, fetchJobs, fetchEnrichStats]);

  // ─── Scrape Handler ────────────────────────────────────
  async function handleScrape() {
    setScraping(true); setScrapeResult(null);
    try {
      const body = { source: scrapeSource };
      if (scrapeSource === '2gis') {
        body.industry = selectedIndustry;
        body.cities = selectedCities.includes('all') ? [] : selectedCities;
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
      const res = await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'all_missing' }) });
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

  return (
    <div className="page-content">
      <div className="page-header">
        <h1><MI name="travel_explore" size={26} /> Lead Scraper</h1>
      </div>

      {/* ═══ Scrape Panel ═══ */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Scrape New Leads</span>
        </div>

        {/* Source selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ minWidth: 140 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Source</label>
            <select value={scrapeSource} onChange={e => setScrapeSource(e.target.value)} className="leads-select" style={{ width: '100%' }}>
              <option value="2gis">🗺️ 2GIS (Business Directory)</option>
              <option value="hh.ru">💼 hh.ru (Job Board)</option>
              <option value="superjob">📋 SuperJob</option>
            </select>
          </div>

          {/* 2GIS: Industry selector */}
          {scrapeSource === '2gis' && config && (
            <div style={{ minWidth: 220 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Industry</label>
              <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} className="leads-select" style={{ width: '100%' }}>
                {config.industries.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          )}

          {/* hh.ru / SuperJob: Query input */}
          {scrapeSource !== '2gis' && (
            <div style={{ flex: 1, minWidth: 250 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Search query (Russian)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="рабочий на производство" />
                <select onChange={e => setScrapeQuery(e.target.value)} className="leads-select" style={{ fontSize: '0.72rem', maxWidth: 200 }}>
                  {PRESET_QUERIES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>
          )}

          <button onClick={handleScrape} disabled={scraping} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}>
            {scraping ? <><span className="spinner-sm" /> Scraping…</> : <><MI name="play_arrow" size={16} /> Run Scrape</>}
          </button>
        </div>

        {/* 2GIS: City selector chips */}
        {scrapeSource === '2gis' && config && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Cities (click to toggle)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                onClick={() => toggleCity('all')}
                style={{
                  padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                  background: selectedCities.includes('all') ? 'var(--primary)' : 'transparent',
                  color: selectedCities.includes('all') ? '#fff' : 'var(--text-muted)',
                }}>All Cities</button>
              {config.cities.map(c => (
                <button
                  key={c.key}
                  onClick={() => toggleCity(c.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem',
                    background: selectedCities.includes(c.key) ? 'var(--primary)' : 'transparent',
                    color: selectedCities.includes(c.key) ? '#fff' : 'var(--text-muted)',
                  }}>{c.name}</button>
              ))}
            </div>
            {!selectedCities.includes('all') && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                ⚡ Estimated API usage: ~{(selectedCities.length * (selectedIndustry === 'all' ? 30 : 3))} of 1000 requests
              </div>
            )}
          </div>
        )}

        {/* Scrape result */}
        {scrapeResult && (
          <div style={{ marginTop: 14, fontSize: '0.82rem', padding: '10px 16px', borderRadius: 10, background: scrapeResult.ok ? '#f0fdf4' : '#fef2f2', color: scrapeResult.ok ? '#166534' : '#dc2626', border: `1px solid ${scrapeResult.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {scrapeResult.ok ? `✓ Done: ${scrapeResult.added} new leads added, ${scrapeResult.skipped} duplicates skipped (${scrapeResult.found} found)` : `✗ Failed: ${scrapeResult.error}`}
          </div>
        )}
      </div>

      {/* ═══ Enrichment Panel ═══ */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Enrich Leads (Fix Missing Emails & Phones)</span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Uses <strong>4 fallback sources</strong> to find correct contact info:
          Website crawling → 2GIS lookup → hh.ru employer search → Email pattern guessing
        </div>

        {/* Enrichment stats */}
        {enrichStats && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{enrichStats.total}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Total Leads</div>
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>{enrichStats.missing_email}</div>
              <div style={{ fontSize: '0.68rem', color: '#dc2626' }}>Missing Email</div>
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>{enrichStats.missing_phone}</div>
              <div style={{ fontSize: '0.68rem', color: '#d97706' }}>Missing Phone</div>
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 10, background: '#fee2e2', border: '1px solid #fca5a5', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#991b1b' }}>{enrichStats.missing_both}</div>
              <div style={{ fontSize: '0.68rem', color: '#991b1b' }}>Missing Both</div>
            </div>
          </div>
        )}

        <button onClick={handleEnrich} disabled={enriching || !enrichStats?.missing_email} className="btn btn-primary" style={{ padding: '10px 24px' }}>
          {enriching ? <><span className="spinner-sm" /> Enriching…</> : <><MI name="auto_fix_high" size={16} /> Enrich All Missing ({enrichStats?.missing_email || 0} leads)</>}
        </button>

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

      {/* ═══ Job History ═══ */}
      <div className="card">
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 16 }}>Scrape & Enrichment History</h3>
        {loadingJobs ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <MI name="history" size={36} />
            <p style={{ marginTop: 8 }}>No scrape jobs yet</p>
            <p style={{ fontSize: '0.78rem' }}>Run your first scrape above</p>
          </div>
        ) : (
          <div className="leads-table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Query</th>
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
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {j.source === '2gis' ? '🗺️' : j.source === 'enrichment' ? '🔍' : '💼'} {j.source}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.query || '—'}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                        background: j.status === 'completed' ? '#dcfce7' : j.status === 'failed' ? '#fee2e2' : j.status === 'running' ? '#dbeafe' : '#f3f4f6',
                        color: j.status === 'completed' ? '#166534' : j.status === 'failed' ? '#991b1b' : j.status === 'running' ? '#1e40af' : '#6b7280',
                      }}>{j.status}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{j.leads_found || 0}</td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{j.leads_added || 0}</td>
                    <td style={{ textAlign: 'center', color: '#f59e0b' }}>{j.leads_skipped || 0}</td>
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
