'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;
const PRESET_QUERIES = ['рабочий на производство', 'сварщик завод', 'грузчик склад', 'разнорабочий строительство', 'комплектовщик', 'складской рабочий'];

export default function LeadScraperPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [scrapeSource, setScrapeSource] = useState('hh.ru');
  const [scrapeQuery, setScrapeQuery] = useState('рабочий на производство');
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && user && !isAdmin) router.push('/dashboard');
  }, [user, authLoading, router, isAdmin]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/scrape');
      if (res.ok) setJobs(await res.json());
    } catch {}
    setLoadingJobs(false);
  }, []);

  useEffect(() => { if (user && isAdmin) fetchJobs(); }, [user, isAdmin, fetchJobs]);

  async function handleScrape() {
    setScraping(true); setScrapeResult(null);
    try {
      const res = await fetch('/api/leads/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: scrapeSource, query: scrapeQuery }) });
      const data = await res.json();
      if (res.ok) { setScrapeResult({ ok: true, added: data.added, skipped: data.skipped, found: data.leads_found }); fetchJobs(); }
      else { setScrapeResult({ ok: false, error: data.error }); }
    } catch (e) { setScrapeResult({ ok: false, error: e.message }); }
    setScraping(false);
  }

  if (authLoading || !user || !isAdmin) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1><MI name="travel_explore" size={26} /> Lead Scraper</h1>
      </div>

      {/* Scrape Panel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Scrape New Leads</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 120 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Source</label>
            <select value={scrapeSource} onChange={e => setScrapeSource(e.target.value)} className="leads-select" style={{ width: '100%' }}>
              <option value="hh.ru">hh.ru</option>
              <option value="superjob">SuperJob</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 250 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Search query (Russian)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="рабочий на производство" />
              <select onChange={e => setScrapeQuery(e.target.value)} className="leads-select" style={{ fontSize: '0.72rem', maxWidth: 200 }}>
                {PRESET_QUERIES.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleScrape} disabled={scraping} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}>
            {scraping ? <><span className="spinner-sm" /> Scraping…</> : <><MI name="play_arrow" size={16} /> Run Scrape</>}
          </button>
        </div>
        {scrapeResult && (
          <div style={{ marginTop: 14, fontSize: '0.82rem', padding: '10px 16px', borderRadius: 10, background: scrapeResult.ok ? '#f0fdf4' : '#fef2f2', color: scrapeResult.ok ? '#166534' : '#dc2626', border: `1px solid ${scrapeResult.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {scrapeResult.ok ? `✓ Done: ${scrapeResult.added} new leads added, ${scrapeResult.skipped} duplicates skipped (${scrapeResult.found} found)` : `✗ Failed: ${scrapeResult.error}`}
          </div>
        )}
      </div>

      {/* Job History */}
      <div className="card">
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 16 }}>Scrape History</h3>
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
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{j.source}</td>
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
