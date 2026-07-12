import { NextResponse } from 'next/server';
const { queryOne, queryAll, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { search2GIS, parse2GISItem, scrapeWebsiteContacts, INDUSTRY_KEYWORDS, RUSSIAN_CITIES, INDUSTRY_OPTIONS } = require('@/lib/scraper');

function makeDedupKey(companyName, domain) {
  const name = (companyName || '').toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '');
  const dom = (domain || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return name + dom;
}

function inferSector(jobTitle = '', industry = '') {
  const t = (jobTitle + ' ' + JSON.stringify(industry)).toLowerCase();
  if (/строитель|монолит|каменщик|прораб|отделочник/.test(t)) return 'construction';
  if (/сварщик|металл|сталь|плавильщик|литейщик/.test(t)) return 'metallurgy';
  if (/склад|комплектовщик|грузчик|логистик/.test(t)) return 'warehouse_logistics';
  if (/пищев|мясо|рыба|молоко|хлеб|кондитер/.test(t)) return 'food_processing';
  if (/шахт|горнодобыв|добыча/.test(t)) return 'mining';
  if (/химическ|нефтехим|нефтеперераб/.test(t)) return 'chemicals';
  if (/автомобил|машиностроен/.test(t)) return 'automotive';
  if (/ресторан|кофе|бариста|гостиниц|отель/.test(t)) return 'hospitality';
  if (/магазин|розниц|торговл/.test(t)) return 'retail';
  return 'manufacturing';
}

// ─── POST: Run a scrape job ──────────────────────────────────
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { source, query: searchQuery, industry, cities } = await request.json();
  if (!source) return NextResponse.json({ error: 'source is required' }, { status: 400 });

  const jobLabel = source === '2gis' ? `${industry || 'all'} in ${(cities || []).join(', ') || 'all cities'}` : searchQuery;
  const job = await query(
    "INSERT INTO gtm_scrape_jobs (source, query, status, started_at, created_by) VALUES ($1, $2, 'running', NOW(), $3) RETURNING id",
    [source, jobLabel || null, user.id]
  );
  const jobId = job.rows[0].id;

  try {
    let leads = [];

    if (source === 'hh.ru') {
      leads = await scrapeHHRu(searchQuery || 'рабочий на производство');

    } else if (source === 'superjob') {
      const apiKey = process.env.SUPERJOB_API_KEY;
      if (!apiKey) {
        await query("UPDATE gtm_scrape_jobs SET status = 'failed', error_message = 'SUPERJOB_API_KEY not set', completed_at = NOW() WHERE id = $1", [jobId]);
        return NextResponse.json({ error: 'SUPERJOB_API_KEY not configured' }, { status: 400 });
      }
      leads = await scrapeSuperjob(searchQuery || 'рабочий завод', apiKey);

    } else if (source === '2gis') {
      const apiKey = process.env.TWOGIS_API_KEY;
      if (!apiKey) {
        await query("UPDATE gtm_scrape_jobs SET status = 'failed', error_message = 'TWOGIS_API_KEY not set', completed_at = NOW() WHERE id = $1", [jobId]);
        return NextResponse.json({ error: 'TWOGIS_API_KEY not configured' }, { status: 400 });
      }
      leads = await scrape2GIS(industry || 'all', cities || [], apiKey);

    } else {
      await query("UPDATE gtm_scrape_jobs SET status = 'failed', error_message = 'Unknown source', completed_at = NOW() WHERE id = $1", [jobId]);
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    // Insert leads with dedup
    let added = 0, skipped = 0;
    for (const lead of leads) {
      if (!lead.company_name?.trim()) { skipped++; continue; }
      const dedupKey = makeDedupKey(lead.company_name, lead.domain);
      const existing = await queryOne('SELECT id FROM gtm_leads WHERE dedup_key = $1', [dedupKey]);
      if (existing) { skipped++; continue; }
      try {
        await query(
          `INSERT INTO gtm_leads (company_name, domain, sector, priority, status, city, company_size, pain_point, decision_maker_title, phone, email, source_url, find_instructions, notes, scraped_from, dedup_key, created_by) VALUES ($1,$2,$3,$4,'not_contacted',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [lead.company_name, lead.domain || '', lead.sector || 'manufacturing', lead.priority || 'MEDIUM', lead.city || '', lead.company_size || '', lead.pain_point || '', lead.decision_maker_title || '', lead.phone || '', lead.email || '', lead.source_url || '', lead.find_instructions || '', lead.notes || '', lead.scraped_from || source, dedupKey, user.id]
        );
        added++;
      } catch (e) {
        if (e.message?.includes('duplicate') || e.message?.includes('unique')) skipped++;
        else console.error('[scrape] insert error:', e.message);
      }
    }

    await query("UPDATE gtm_scrape_jobs SET status = 'completed', leads_found = $1, leads_added = $2, leads_skipped = $3, completed_at = NOW() WHERE id = $4",
      [leads.length, added, skipped, jobId]);

    return NextResponse.json({ jobId, leads_found: leads.length, added, skipped });

  } catch (err) {
    console.error('[scrape] job failed:', err);
    await query("UPDATE gtm_scrape_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2", [err.message, jobId]);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── 2GIS SCRAPER (multi-keyword, multi-city) ────────────────
async function scrape2GIS(industry, selectedCities, apiKey) {
  // Get keywords for selected industry
  let keywords = [];
  if (industry === 'all') {
    keywords = Object.values(INDUSTRY_KEYWORDS).flat();
  } else if (INDUSTRY_KEYWORDS[industry]) {
    keywords = INDUSTRY_KEYWORDS[industry];
  } else {
    keywords = [industry]; // custom query
  }

  // Get cities
  let citiesToSearch = RUSSIAN_CITIES;
  if (selectedCities && selectedCities.length > 0 && !selectedCities.includes('all')) {
    citiesToSearch = RUSSIAN_CITIES.filter(c => selectedCities.includes(c.key));
  }

  const seenCompanies = new Set();
  const leads = [];
  let apiCalls = 0;

  for (const city of citiesToSearch) {
    for (const keyword of keywords) {
      if (apiCalls >= 200) break; // Safety limit per job to preserve API quota

      try {
        const queryStr = `${keyword} ${city.name}`;
        const { items } = await search2GIS(queryStr, apiKey);
        apiCalls++;

        for (const item of items) {
          const companyName = item.org?.name || item.name || '';
          if (!companyName || seenCompanies.has(companyName.toLowerCase())) continue;
          seenCompanies.add(companyName.toLowerCase());

          const lead = parse2GISItem(item, city.name);
          if (lead.company_name) leads.push(lead);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`[2gis] "${keyword}" in ${city.name} error:`, e.message);
      }
    }
    if (apiCalls >= 200) break;
  }

  console.log(`[2gis] Used ${apiCalls} API calls, found ${leads.length} unique companies`);
  return leads;
}

// ─── HH.RU SCRAPER ──────────────────────────────────────────
async function scrapeHHRu(searchQuery) {
  const areas = ['1', '2', '3', '66'];
  const seenEmployers = new Set();
  const leads = [];

  for (const area of areas) {
    try {
      const params = new URLSearchParams({ text: searchQuery, area, per_page: '50', only_with_salary: 'false', employment: 'full' });
      const res = await fetch(`https://api.hh.ru/vacancies?${params}`, {
        headers: { 'User-Agent': 'TahaAirwavesCRM/1.0 (info@tahaairwaves.com)' },
      });
      if (!res.ok) { console.error(`[scrape] hh.ru area ${area} HTTP ${res.status}`); continue; }
      const data = await res.json();
      if (!data.items) continue;

      for (const vacancy of data.items) {
        const employer = vacancy.employer;
        if (!employer || seenEmployers.has(employer.id)) continue;
        seenEmployers.add(employer.id);

        let empDetails = {};
        try {
          const empRes = await fetch(`https://api.hh.ru/employers/${employer.id}`, {
            headers: { 'User-Agent': 'TahaAirwavesCRM/1.0 (info@tahaairwaves.com)' },
          });
          if (empRes.ok) empDetails = await empRes.json();
        } catch {}

        leads.push({
          company_name: employer.name,
          domain: empDetails.site_url?.replace(/^https?:\/\//, '').split('/')[0] || null,
          sector: inferSector(vacancy.name, empDetails.industry),
          priority: 'MEDIUM',
          city: vacancy.area?.name || null,
          company_size: empDetails.size || null,
          pain_point: `Actively hiring "${vacancy.name}" on hh.ru. ${vacancy.open_vacancies || ''} open vacancies.`,
          decision_maker_title: 'HR Manager / Директор по персоналу',
          source_url: `https://hh.ru/employer/${employer.id}`,
          find_instructions: `hh.ru employer: https://hh.ru/employer/${employer.id}`,
          notes: `Found via hh.ru search: "${searchQuery}" in area ${vacancy.area?.name || area}`,
          scraped_from: 'hh.ru',
        });
      }
    } catch (e) { console.error(`[scrape] hh.ru area ${area} error:`, e.message); }
  }
  return leads;
}

// ─── SUPERJOB SCRAPER ────────────────────────────────────────
async function scrapeSuperjob(searchQuery, apiKey) {
  const params = new URLSearchParams({ keyword: searchQuery, count: '50', no_agreement: '1' });
  const res = await fetch(`https://api.superjob.ru/2.0/vacancies/?${params}`, {
    headers: { 'X-Api-App-Id': apiKey },
  });
  const data = await res.json();
  if (!data.objects) return [];

  const seenEmployers = new Set();
  const leads = [];

  for (const vacancy of data.objects) {
    const client = vacancy.client;
    if (!client || seenEmployers.has(String(client.id))) continue;
    seenEmployers.add(String(client.id));

    leads.push({
      company_name: client.title,
      domain: client.url?.replace(/^https?:\/\//, '').split('/')[0] || null,
      sector: inferSector(vacancy.profession, client.industry),
      priority: 'MEDIUM',
      city: vacancy.town?.title || null,
      phone: client.phones?.[0]?.number || null,
      company_size: client.staff_count ? `~${client.staff_count}` : null,
      pain_point: `Actively hiring "${vacancy.profession}" on SuperJob.ru.`,
      decision_maker_title: 'HR Manager / Директор по персоналу',
      source_url: `https://www.superjob.ru/clients/${client.id}/`,
      find_instructions: `SuperJob employer: https://www.superjob.ru/clients/${client.id}/`,
      notes: `Found via SuperJob search: "${searchQuery}"`,
      scraped_from: 'superjob',
    });
  }
  return leads;
}

// ─── GET: Fetch scrape job history + config ──────────────────
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get('config') === '1') {
    // Return available cities, industries for the UI
    return NextResponse.json({
      cities: RUSSIAN_CITIES,
      industries: INDUSTRY_OPTIONS,
      has2gisKey: !!process.env.TWOGIS_API_KEY,
      hasSuperjobKey: !!process.env.SUPERJOB_API_KEY,
    });
  }

  const jobs = await queryAll('SELECT * FROM gtm_scrape_jobs ORDER BY created_at DESC LIMIT 20');
  return NextResponse.json(jobs);
}
