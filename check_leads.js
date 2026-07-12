// Test each scraping source directly to diagnose failures
const scraper = require('./src/lib/scraper');

async function testAll() {
  console.log('=== TESTING ALL SCRAPE SOURCES ===\n');

  // 1. Test hh.ru API
  console.log('--- 1. hh.ru API ---');
  try {
    const res = await fetch('https://api.hh.ru/vacancies?text=%D1%80%D0%B0%D0%B1%D0%BE%D1%87%D0%B8%D0%B9+%D0%BD%D0%B0+%D0%BF%D1%80%D0%BE%D0%B8%D0%B7%D0%B2%D0%BE%D0%B4%D1%81%D1%82%D0%B2%D0%BE&area=1&per_page=5', {
      headers: { 'User-Agent': 'TahaAirwavesCRM/1.0 (info@tahaairwaves.com)' }
    });
    console.log('  Status:', res.status, res.statusText);
    const data = await res.json();
    console.log('  Found items:', data.items?.length || 0);
    console.log('  Total available:', data.found || 0);
    if (data.items?.[0]) console.log('  Sample employer:', data.items[0].employer?.name);
    if (data.errors) console.log('  ERRORS:', JSON.stringify(data.errors));
  } catch(e) { console.log('  ERROR:', e.message); }

  // 2. Test 2GIS API
  console.log('\n--- 2. 2GIS API ---');
  const apiKey = process.env.TWOGIS_API_KEY;
  console.log('  API Key set:', !!apiKey, apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING');
  if (apiKey) {
    try {
      const { items } = await scraper.search2GIS('строительная компания Москва', apiKey);
      console.log('  Found items:', items.length);
      if (items[0]) console.log('  Sample:', items[0].org?.name || items[0].name);
    } catch(e) { console.log('  ERROR:', e.message); }
  }

  // 3. Test DuckDuckGo (used by web_search and dorking)
  console.log('\n--- 3. DuckDuckGo Search ---');
  try {
    const urls = await scraper.searchWebForCompanies('производственное предприятие москва контакты', 5);
    console.log('  Found URLs:', urls.length);
    urls.slice(0, 3).forEach(u => console.log('  -', u));
  } catch(e) { console.log('  ERROR:', e.message); }

  // 4. Test Google Dorking
  console.log('\n--- 4. Google Dorking ---');
  try {
    const leads = await scraper.googleDorkSearch('companies_with_email', { city: 'Москва', industry: 'строительная' }, '', 5);
    console.log('  Found leads:', leads.length);
    if (leads[0]) console.log('  Sample:', leads[0].company_name, leads[0].email);
  } catch(e) { console.log('  ERROR:', e.message); }

  // 5. Test SuperJob
  console.log('\n--- 5. SuperJob ---');
  const sjKey = process.env.SUPERJOB_API_KEY;
  console.log('  API Key set:', !!sjKey);
  if (sjKey) {
    try {
      const res = await fetch('https://api.superjob.ru/2.0/vacancies/?keyword=рабочий&count=3', {
        headers: { 'X-Api-App-Id': sjKey }
      });
      console.log('  Status:', res.status);
      const data = await res.json();
      console.log('  Found objects:', data.objects?.length || 0);
    } catch(e) { console.log('  ERROR:', e.message); }
  } else {
    console.log('  SKIPPED - no API key');
  }

  process.exit(0);
}

testAll().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
