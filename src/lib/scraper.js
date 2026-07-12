/**
 * Scraper Utilities for Taha Airwaves Marketing CRM
 * 
 * 5 Scraping Sources:
 *   1. 2GIS Catalog API — Russian business directory (API key)
 *   2. hh.ru — Free job board API
 *   3. SuperJob — Job board API (needs key)
 *   4. Web Search — DuckDuckGo search → crawl found websites (no key needed)
 *   5. Website crawling (cheerio) — extract contacts from company sites
 * 
 * 4 Enrichment Fallbacks:
 *   1. Website crawling (cheerio/Beautiful Soup)
 *   2. 2GIS lookup
 *   3. hh.ru employer lookup
 *   4. Email pattern guessing
 */

const cheerio = require('cheerio');

// ─── Russian Cities (with English names) ───────────────────
const RUSSIAN_CITIES = [
  { name: 'Москва', nameEn: 'Moscow', key: 'moscow' },
  { name: 'Санкт-Петербург', nameEn: 'Saint Petersburg', key: 'spb' },
  { name: 'Новосибирск', nameEn: 'Novosibirsk', key: 'novosibirsk' },
  { name: 'Екатеринбург', nameEn: 'Yekaterinburg', key: 'yekaterinburg' },
  { name: 'Казань', nameEn: 'Kazan', key: 'kazan' },
  { name: 'Челябинск', nameEn: 'Chelyabinsk', key: 'chelyabinsk' },
  { name: 'Нижний Новгород', nameEn: 'Nizhny Novgorod', key: 'nn' },
  { name: 'Самара', nameEn: 'Samara', key: 'samara' },
  { name: 'Красноярск', nameEn: 'Krasnoyarsk', key: 'krasnoyarsk' },
  { name: 'Уфа', nameEn: 'Ufa', key: 'ufa' },
  { name: 'Ростов-на-Дону', nameEn: 'Rostov-on-Don', key: 'rostov' },
  { name: 'Краснодар', nameEn: 'Krasnodar', key: 'krasnodar' },
];

// ─── Industry Keywords (Russian) ────────────────────────────
const INDUSTRY_KEYWORDS = {
  manufacturing: ['производственное предприятие', 'завод производство', 'промышленное предприятие'],
  construction: ['строительная компания', 'генподрядчик строительство', 'строительный трест'],
  metallurgy: ['металлургический завод', 'металлообработка', 'литейное производство'],
  food_processing: ['пищевое производство', 'мясокомбинат', 'молочный завод', 'хлебозавод'],
  warehouse_logistics: ['складской комплекс', 'логистический центр', 'транспортная компания'],
  mining: ['горнодобывающая компания', 'добыча полезных ископаемых', 'карьер'],
  chemicals: ['химический завод', 'нефтеперерабатывающий завод', 'нефтехимия'],
  automotive: ['автомобильный завод', 'машиностроительный завод', 'автозапчасти производство'],
  woodworking: ['деревообработка', 'лесопереработка', 'мебельное производство'],
  textiles: ['текстильное производство', 'швейная фабрика'],
  energy: ['электростанция', 'энергетическая компания'],
  agriculture: ['агрохолдинг', 'сельскохозяйственное предприятие', 'тепличный комплекс'],
};

// Industry options for the UI
const INDUSTRY_OPTIONS = [
  { value: 'all', label: 'All Industries' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'metallurgy', label: 'Metallurgy' },
  { value: 'food_processing', label: 'Food Processing' },
  { value: 'warehouse_logistics', label: 'Warehouse & Logistics' },
  { value: 'mining', label: 'Mining' },
  { value: 'chemicals', label: 'Chemicals & Oil' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'woodworking', label: 'Woodworking' },
  { value: 'textiles', label: 'Textiles' },
  { value: 'energy', label: 'Energy' },
  { value: 'agriculture', label: 'Agriculture' },
];

// ─── Sector inference from 2GIS rubrics ──────────────────────
function inferSectorFrom2GIS(rubrics = []) {
  const text = rubrics.map(r => (r.name || '')).join(' ').toLowerCase();
  if (/строител|монтаж|ремонт зданий/.test(text)) return 'construction';
  if (/металл|сталь|литей|прокат/.test(text)) return 'metallurgy';
  if (/склад|логист|грузоперевоз|транспорт/.test(text)) return 'warehouse_logistics';
  if (/пищев|мясо|молоч|хлеб|кондитер|продукт/.test(text)) return 'food_processing';
  if (/горнодобыв|добыча|шахт|карьер/.test(text)) return 'mining';
  if (/химическ|нефт|газ|полимер/.test(text)) return 'chemicals';
  if (/автомобил|машиностроен|двигател/.test(text)) return 'automotive';
  if (/дерев|мебел|лесо/.test(text)) return 'woodworking';
  if (/текстил|швей/.test(text)) return 'textiles';
  if (/электр|энерг|станци/.test(text)) return 'energy';
  if (/сельскохоз|агро|теплиц|ферм/.test(text)) return 'agriculture';
  if (/производств|завод|фабрик|промышлен/.test(text)) return 'manufacturing';
  return 'manufacturing';
}

function inferSectorFromText(text = '') {
  const t = text.toLowerCase();
  if (/construct|строител|build/.test(t)) return 'construction';
  if (/metal|металл|steel|сталь/.test(t)) return 'metallurgy';
  if (/warehouse|склад|logist|логист/.test(t)) return 'warehouse_logistics';
  if (/food|пищев|meat|мясо|dairy|молоч/.test(t)) return 'food_processing';
  if (/min|горн|добыч|шахт/.test(t)) return 'mining';
  if (/chem|хим|oil|нефт/.test(t)) return 'chemicals';
  if (/auto|авто|machine|машиностр/.test(t)) return 'automotive';
  if (/wood|дерев|furniture|мебел/.test(t)) return 'woodworking';
  if (/textile|текстил|sew|швей/.test(t)) return 'textiles';
  if (/energy|энерг|power|электр/.test(t)) return 'energy';
  if (/agri|сельск|farm|ферм/.test(t)) return 'agriculture';
  if (/manufactur|производств|завод|factory|фабрик/.test(t)) return 'manufacturing';
  return 'other';
}

// ─── 1. 2GIS CATALOG API ─────────────────────────────────────
async function search2GIS(query, apiKey, page = 1) {
  const params = new URLSearchParams({
    q: query,
    key: apiKey,
    type: 'branch',
    page_size: '50',
    page: String(page),
    fields: 'items.contact_groups,items.org,items.rubrics,items.schedule,items.address',
  });

  const res = await fetch(`https://catalog.api.2gis.com/3.0/items?${params}`, {
    headers: { 'User-Agent': 'TahaAirwavesCRM/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`2GIS API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    items: data.result?.items || [],
    total: data.result?.total || 0,
  };
}

/** Parse a 2GIS item into a lead object */
function parse2GISItem(item, queryCity) {
  let phone = '', email = '', website = '';

  if (item.contact_groups) {
    for (const group of item.contact_groups) {
      for (const c of group.contacts || []) {
        if (c.type === 'phone' && !phone) phone = c.value || '';
        if (c.type === 'email' && !email) email = c.value || '';
        if (c.type === 'website' && !website) website = c.value || '';
      }
    }
  }

  const domain = website.replace(/^https?:\/\//, '').split('/')[0] || '';
  const city = item.address_name ? (item.address_name.split(',')[0] || queryCity) : queryCity;
  const sector = inferSectorFrom2GIS(item.rubrics || []);
  const rubricNames = (item.rubrics || []).map(r => r.name).filter(Boolean).join(', ');
  const branchCount = item.org?.branch_count;

  return {
    company_name: item.org?.name || item.name || '',
    domain,
    sector,
    priority: 'MEDIUM',
    city: city || '',
    company_size: branchCount ? `${branchCount} branches` : '',
    pain_point: rubricNames ? `Industry: ${rubricNames}` : '',
    decision_maker_title: 'CEO / HR Director',
    phone,
    email,
    source_url: `https://2gis.ru/search/${encodeURIComponent(item.org?.name || item.name || '')}`,
    find_instructions: `2GIS: ${item.full_name || item.name || ''}. Address: ${item.address_name || ''}`,
    notes: `Found via 2GIS. ${rubricNames ? 'Category: ' + rubricNames : ''}`.trim(),
    scraped_from: '2gis',
  };
}

// ─── 2. WEBSITE CRAWLING (CHEERIO / Beautiful Soup style) ────
const CONTACT_PATHS = ['/contacts', '/kontakty', '/contact', '/about', '/o-kompanii', '/about-us', '/kontakt', '/'];
const EMAIL_REGEX = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g;
const RU_PHONE_REGEX = /(?:\+7|8)[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/g;
const JUNK_EMAIL_PATTERNS = ['example.com', 'wixpress', 'sentry.io', 'schema.org', 'w3.org', 'googleapis', 'facebook', 'twitter', 'instagram', 'vk.com', 'mail.ru', '.png', '.jpg', '.svg', '.css', '.js', 'jquery', 'bootstrap', 'webpack', 'noreply', 'no-reply'];

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeWebsiteContacts(domain) {
  if (!domain) return { emails: [], phones: [] };

  const contacts = { emails: [], phones: [] };
  const tried = new Set();

  for (const path of CONTACT_PATHS) {
    const url = `https://${domain}${path}`;
    if (tried.has(url)) continue;
    tried.add(url);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      extractContactsFromHTML(cheerio.load(html), contacts);

      if (contacts.emails.length > 0 && contacts.phones.length > 0) break;
    } catch { /* timeout or network error, try next path */ }
  }

  // Also try http:// if https:// found nothing
  if (contacts.emails.length === 0 && contacts.phones.length === 0) {
    try {
      const res = await fetch(`http://${domain}/`, {
        headers: { 'User-Agent': BROWSER_UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const html = await res.text();
        extractContactsFromHTML(cheerio.load(html), contacts);
      }
    } catch {}
  }

  return contacts;
}

function extractContactsFromHTML($, contacts = { emails: [], phones: [] }) {
  // Extract from mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const email = $(el).attr('href').replace('mailto:', '').split('?')[0].trim().toLowerCase();
    if (email && !isJunkEmail(email) && !contacts.emails.includes(email)) contacts.emails.push(email);
  });

  // Extract from tel: links
  $('a[href^="tel:"]').each((_, el) => {
    const phone = cleanPhone($(el).attr('href').replace('tel:', ''));
    if (phone && phone.length >= 10 && !contacts.phones.includes(phone)) contacts.phones.push(phone);
  });

  // Regex scan
  const bodyText = $('body').text();
  const foundEmails = bodyText.match(EMAIL_REGEX) || [];
  for (const e of foundEmails) {
    const email = e.toLowerCase();
    if (!isJunkEmail(email) && !contacts.emails.includes(email)) contacts.emails.push(email);
  }

  const foundPhones = bodyText.match(RU_PHONE_REGEX) || [];
  for (const p of foundPhones) {
    const phone = cleanPhone(p);
    if (phone && phone.length >= 10 && !contacts.phones.includes(phone)) contacts.phones.push(phone);
  }

  return contacts;
}

function isJunkEmail(email) {
  return JUNK_EMAIL_PATTERNS.some(p => email.includes(p)) || email.length > 60 || email.length < 5;
}

function cleanPhone(phone) {
  return (phone || '').replace(/[\s\-\.\(\)]/g, '').trim();
}

// ─── 3. WEB SEARCH SCRAPER (DuckDuckGo + Website Crawling) ──
/**
 * Searches DuckDuckGo for company keywords, then crawls each found website
 * to extract company info, emails, and phones. No API key needed.
 */
async function searchWebForCompanies(searchQuery, maxResults = 20) {
  const resultUrls = [];

  // Search DuckDuckGo HTML (scraping-friendly)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(ddgUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // DuckDuckGo HTML results
      $('a.result__a').each((_, el) => {
        let href = $(el).attr('href') || '';
        // DuckDuckGo uses redirect URLs with uddg= parameter
        if (href.includes('uddg=')) {
          const match = href.match(/uddg=([^&]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }
        if (href.startsWith('http') && !href.includes('duckduckgo.com') && !href.includes('wikipedia') && !href.includes('youtube')) {
          resultUrls.push(href);
        }
      });

      // Also try regular links as fallback
      if (resultUrls.length === 0) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') || '';
          if (href.startsWith('http') && !href.includes('duckduckgo') && href.includes('.ru')) {
            resultUrls.push(href);
          }
        });
      }
    }
  } catch (e) {
    console.error('[web-search] DuckDuckGo search error:', e.message);
  }

  // Deduplicate by domain
  const seenDomains = new Set();
  const uniqueUrls = [];
  for (const url of resultUrls) {
    try {
      const domain = new URL(url).hostname;
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        uniqueUrls.push(url);
      }
    } catch {}
  }

  return uniqueUrls.slice(0, maxResults);
}

/** Extract company lead data from a website URL */
async function extractLeadFromWebsite(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Get company name from title or meta
    let companyName = $('meta[property="og:site_name"]').attr('content')
      || $('meta[name="application-name"]').attr('content')
      || $('title').text().trim();

    // Clean company name — take first part before separators
    companyName = companyName.split(/[|–—\-\/:]/)[0].trim();
    if (!companyName || companyName.length > 100) return null;

    // Extract domain
    const domain = new URL(url).hostname;

    // Extract contacts from this page
    const contacts = { emails: [], phones: [] };
    extractContactsFromHTML($, contacts);

    // Try contact page if we didn't find contacts on homepage
    if (contacts.emails.length === 0) {
      // Look for contact page link
      const contactLinks = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        if (/контакт|contact|связат|обратн/.test(text) || /контакт|contact/.test(href)) {
          let contactUrl = href;
          if (contactUrl.startsWith('/')) contactUrl = `https://${domain}${contactUrl}`;
          if (contactUrl.startsWith('http')) contactLinks.push(contactUrl);
        }
      });

      for (const cUrl of contactLinks.slice(0, 2)) {
        try {
          const cRes = await fetch(cUrl, {
            headers: { 'User-Agent': BROWSER_UA },
            signal: AbortSignal.timeout(5000),
          });
          if (cRes.ok) {
            const cHtml = await cRes.text();
            extractContactsFromHTML(cheerio.load(cHtml), contacts);
            if (contacts.emails.length > 0) break;
          }
        } catch {}
      }
    }

    // Get description for sector inference
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const bodyText = $('body').text().slice(0, 2000);
    const sector = inferSectorFromText(companyName + ' ' + description + ' ' + bodyText);

    // Detect city from page content
    let city = '';
    const cityMatch = bodyText.match(/(?:г\.\s*|город\s+)([\wа-яА-ЯёЁ-]+)/i);
    if (cityMatch) city = cityMatch[1];

    return {
      company_name: companyName,
      domain,
      sector: sector !== 'other' ? sector : 'manufacturing',
      priority: 'MEDIUM',
      city,
      phone: contacts.phones[0] || '',
      email: contacts.emails[0] || '',
      source_url: url,
      decision_maker_title: 'CEO / HR Director',
      find_instructions: `Found via web search. Website: ${url}`,
      notes: `Web search result. ${description.slice(0, 200)}`,
      scraped_from: 'web_search',
    };
  } catch (e) {
    console.error('[web-search] Failed to extract from', url, e.message);
    return null;
  }
}

// ─── 4. EMAIL PATTERN GUESSING ───────────────────────────────
function guessEmails(domain) {
  if (!domain) return [];
  return [`info@${domain}`, `office@${domain}`, `hr@${domain}`, `mail@${domain}`, `sales@${domain}`];
}

// ─── 5. HH.RU EMPLOYER LOOKUP ────────────────────────────────
async function lookupHHRuEmployer(companyName) {
  try {
    const params = new URLSearchParams({ text: companyName, per_page: '5' });
    const res = await fetch(`https://api.hh.ru/employers?${params}`, {
      headers: { 'User-Agent': 'TahaAirwavesCRM/1.0 (info@tahaairwaves.com)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.items?.[0];
    if (!match) return null;

    const detailRes = await fetch(`https://api.hh.ru/employers/${match.id}`, {
      headers: { 'User-Agent': 'TahaAirwavesCRM/1.0 (info@tahaairwaves.com)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!detailRes.ok) return null;
    return await detailRes.json();
  } catch { return null; }
}

// ─── ENRICHMENT PIPELINE (Fallback Chain) ────────────────────
/**
 * Tries multiple sources to find contacts for a lead.
 * Fallback order:
 *   1. Website crawling (free, unlimited)
 *   2. 2GIS lookup by company name (uses API quota)
 *   3. hh.ru employer lookup (free)
 *   4. Email pattern guessing (offline)
 *
 * @param {object} lead - The lead to enrich
 * @param {string|null} apiKey2GIS - 2GIS API key
 * @param {boolean} force - If true, overwrite existing email/phone
 */
async function enrichLeadContacts(lead, apiKey2GIS, force = false) {
  const result = {
    email: force ? '' : (lead.email || ''),
    phone: force ? '' : (lead.phone || ''),
    domain: lead.domain || '',
    decision_maker_title: lead.decision_maker_title || '',
    company_size: lead.company_size || '',
    source_used: [],
  };

  // === Fallback 1: Website crawling ===
  if (result.domain && (!result.email || !result.phone)) {
    try {
      const webContacts = await scrapeWebsiteContacts(result.domain);
      if (webContacts.emails.length > 0 && !result.email) {
        result.email = webContacts.emails[0];
        result.source_used.push('website');
      }
      if (webContacts.phones.length > 0 && !result.phone) {
        result.phone = webContacts.phones[0];
        result.source_used.push('website');
      }
    } catch {}
  }

  // === Fallback 2: 2GIS lookup ===
  if ((!result.email || !result.phone) && apiKey2GIS) {
    try {
      const query = `${lead.company_name} ${lead.city || ''}`.trim();
      const { items } = await search2GIS(query, apiKey2GIS);
      if (items.length > 0) {
        const parsed = parse2GISItem(items[0], lead.city);
        if (!result.email && parsed.email) { result.email = parsed.email; result.source_used.push('2gis'); }
        if (!result.phone && parsed.phone) { result.phone = parsed.phone; result.source_used.push('2gis'); }
        if (!result.domain && parsed.domain) { result.domain = parsed.domain; result.source_used.push('2gis'); }
        if (!result.company_size && parsed.company_size) result.company_size = parsed.company_size;
      }
    } catch {}
  }

  // === Fallback 3: hh.ru employer lookup ===
  if ((!result.email || !result.domain) && lead.company_name) {
    try {
      const employer = await lookupHHRuEmployer(lead.company_name);
      if (employer) {
        if (!result.domain && employer.site_url) {
          result.domain = employer.site_url.replace(/^https?:\/\//, '').split('/')[0];
          result.source_used.push('hh.ru');
        }
        if (!result.company_size && employer.size) result.company_size = employer.size;

        // If we got a domain from hh.ru, try crawling it
        if (result.domain && !result.email) {
          const webContacts = await scrapeWebsiteContacts(result.domain);
          if (webContacts.emails.length > 0) { result.email = webContacts.emails[0]; result.source_used.push('website-via-hh'); }
          if (webContacts.phones.length > 0 && !result.phone) { result.phone = webContacts.phones[0]; result.source_used.push('website-via-hh'); }
        }
      }
    } catch {}
  }

  // === Fallback 4: Email pattern guessing ===
  if (!result.email && result.domain) {
    const guesses = guessEmails(result.domain);
    result.email = guesses[0] || '';
    result.source_used.push('guessed');
  }

  return result;
}

// ─── 6. GOOGLE DORKING (Advanced Search Operators) ───────────
/**
 * Predefined dork templates for finding Russian companies.
 * Uses Google-style operators via DuckDuckGo (which supports most of them).
 * 
 * Variables: {city}, {industry}, {domain}, {company}
 */
const DORK_TEMPLATES = {
  // Find companies with contact info
  companies_with_email: [
    '"{industry}" "{city}" контакты email site:.ru',
    '"{industry}" "{city}" "@" телефон site:.ru',
    'intitle:контакты "{industry}" "{city}" site:.ru',
    '"{industry}" "{city}" "генеральный директор" email',
  ],
  // Find emails for a known domain
  domain_emails: [
    '"@{domain}"',
    'site:{domain} контакты email телефон',
    'site:{domain} "mailto:"',
  ],
  // Find decision makers
  decision_makers: [
    '"{company}" директор email',
    '"{company}" "генеральный директор" контакты',
    '"{company}" HR директор email телефон',
    '"{company}" linkedin руководитель',
  ],
  // Find companies hiring workers (Taha Airwaves specific)
  hiring_companies: [
    '"{city}" "набор персонала" "рабочие" контакты email site:.ru',
    '"{city}" "требуются рабочие" "{industry}" email site:.ru',
    '"{city}" "вакансии" "{industry}" "@" site:.ru',
    '"{industry}" "{city}" "отдел кадров" email телефон',
  ],
};

const DORK_PRESET_OPTIONS = [
  { value: 'companies_with_email', label: 'Find Companies with Email' },
  { value: 'hiring_companies', label: 'Find Companies Hiring Workers' },
  { value: 'decision_makers', label: 'Find Decision Makers' },
  { value: 'domain_emails', label: 'Find Emails by Domain' },
  { value: 'custom', label: 'Custom Dork Query' },
];

/**
 * Build a dork query from a template with variable substitution.
 */
function buildDorkQuery(template, vars = {}) {
  let q = template;
  for (const [key, val] of Object.entries(vars)) {
    q = q.replaceAll(`{${key}}`, val || '');
  }
  // Clean up empty placeholders
  q = q.replace(/"\s*"/g, '').replace(/\s{2,}/g, ' ').trim();
  return q;
}

/**
 * Run Google dorking search — builds dork queries and searches via DuckDuckGo.
 * Then crawls found websites to extract lead data.
 * 
 * @param {string} dorkType - One of DORK_TEMPLATES keys or 'custom'
 * @param {object} vars - Variables: { city, industry, domain, company }
 * @param {string} customQuery - Custom dork query (when dorkType === 'custom')
 * @param {number} maxLeads - Max leads to return
 */
async function googleDorkSearch(dorkType, vars = {}, customQuery = '', maxLeads = 30) {
  const leads = [];
  const seenDomains = new Set();
  let queries = [];

  if (dorkType === 'custom' && customQuery) {
    queries = [customQuery];
  } else if (DORK_TEMPLATES[dorkType]) {
    queries = DORK_TEMPLATES[dorkType].map(t => buildDorkQuery(t, vars));
  } else {
    queries = [customQuery || `"${vars.industry || 'производство'}" "${vars.city || ''}" контакты email site:.ru`];
  }

  for (const dorkQuery of queries) {
    if (leads.length >= maxLeads) break;
    if (!dorkQuery.trim()) continue;

    console.log(`[dork] Searching: ${dorkQuery}`);

    try {
      const urls = await searchWebForCompanies(dorkQuery, 15);

      for (const url of urls) {
        if (leads.length >= maxLeads) break;

        try {
          const domain = new URL(url).hostname;
          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          const lead = await extractLeadFromWebsite(url);
          if (lead && lead.company_name) {
            lead.scraped_from = 'google_dork';
            lead.notes = `Dork: "${dorkQuery.slice(0, 80)}". ${lead.notes || ''}`;
            leads.push(lead);
          }
        } catch {}

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.error(`[dork] Query failed: ${dorkQuery}`, e.message);
    }

    // Delay between dork queries
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[dork] Found ${leads.length} leads from dorking`);
  return leads;
}

module.exports = {
  RUSSIAN_CITIES,
  INDUSTRY_KEYWORDS,
  INDUSTRY_OPTIONS,
  DORK_TEMPLATES,
  DORK_PRESET_OPTIONS,
  search2GIS,
  parse2GISItem,
  scrapeWebsiteContacts,
  extractContactsFromHTML,
  searchWebForCompanies,
  extractLeadFromWebsite,
  googleDorkSearch,
  buildDorkQuery,
  guessEmails,
  lookupHHRuEmployer,
  enrichLeadContacts,
  inferSectorFrom2GIS,
  inferSectorFromText,
  // Email verification
  validateEmail,
  checkMXRecord,
  analyzeEmailQuality,
};

// ─── 7. EMAIL VERIFICATION & QUALITY ANALYSIS ───────────────
const dns = require('dns');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);

const VALID_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PLACEHOLDER_EMAILS = [
  'test@test.com', 'admin@admin.com', 'info@example.com', 'user@user.com',
  'email@email.com', 'mail@mail.com', 'a@a.com', 'no@no.com', 'na@na.com',
  'none@none.com', 'test@example.com', 'admin@example.com', 'noreply@',
  'no-reply@', 'donotreply@', 'postmaster@',
];
const PLACEHOLDER_DOMAINS = [
  'example.com', 'test.com', 'localhost', 'temp.com', 'fake.com',
  'none.com', 'na.com', 'email.com', 'domain.com', 'company.com',
  'sample.com', 'demo.com', 'placeholder.com',
];

/**
 * Validate a single email address.
 * Returns: { status, reason }
 * Status: 'valid' | 'invalid_format' | 'placeholder' | 'empty'
 */
function validateEmail(email) {
  if (!email || !email.trim()) return { status: 'empty', reason: 'No email provided' };

  const e = email.trim().toLowerCase();

  // Check format
  if (!VALID_EMAIL_REGEX.test(e)) return { status: 'invalid_format', reason: 'Invalid email format' };

  // Check placeholder
  if (PLACEHOLDER_EMAILS.some(p => e.startsWith(p) || e === p)) {
    return { status: 'placeholder', reason: 'Placeholder/test email' };
  }

  // Check placeholder domains
  const domain = e.split('@')[1];
  if (PLACEHOLDER_DOMAINS.includes(domain)) {
    return { status: 'placeholder', reason: `Placeholder domain: ${domain}` };
  }

  // Check suspiciously short
  if (e.length < 6) return { status: 'invalid_format', reason: 'Email too short' };

  return { status: 'valid', reason: 'Format OK' };
}

/**
 * Check if a domain has MX records (can receive email).
 * Caches results per domain to avoid redundant DNS lookups.
 */
const mxCache = new Map();

async function checkMXRecord(domain) {
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain);

  try {
    const records = await resolveMx(domain);
    const hasMX = records && records.length > 0;
    mxCache.set(domain, hasMX);
    return hasMX;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

/**
 * Analyze email quality for a lead. Checks:
 *   1. Email format validity
 *   2. Is it a placeholder/junk email
 *   3. Does the domain have MX records
 *   4. Does email domain match company domain
 *
 * Returns: { status, reason, email, domain_match }
 * Status: 'valid' | 'invalid_format' | 'no_mx' | 'placeholder' | 'domain_mismatch' | 'empty'
 */
async function analyzeEmailQuality(email, companyDomain) {
  // Basic validation
  const basic = validateEmail(email);
  if (basic.status !== 'valid') return { ...basic, email, domain_match: null };

  const e = email.trim().toLowerCase();
  const emailDomain = e.split('@')[1];

  // MX record check
  const hasMX = await checkMXRecord(emailDomain);
  if (!hasMX) {
    return { status: 'no_mx', reason: `Domain "${emailDomain}" has no mail server (MX record)`, email, domain_match: false };
  }

  // Domain mismatch check (email domain vs company website domain)
  let domain_match = null;
  if (companyDomain) {
    const compDom = companyDomain.toLowerCase().replace(/^www\./, '');
    const emailDom = emailDomain.replace(/^www\./, '');
    // Check if domains match or are subdomains
    domain_match = emailDom === compDom || emailDom.endsWith('.' + compDom) || compDom.endsWith('.' + emailDom);
    if (!domain_match) {
      // It's suspicious but could be legitimate (e.g. company uses gmail/yandex)
      const freeProviders = ['gmail.com', 'yandex.ru', 'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'rambler.ru', 'yahoo.com', 'outlook.com', 'hotmail.com'];
      if (freeProviders.includes(emailDomain)) {
        return { status: 'suspicious', reason: `Free email (${emailDomain}), company has own domain: ${companyDomain}`, email, domain_match: false };
      }
      return { status: 'domain_mismatch', reason: `Email domain "${emailDomain}" ≠ company domain "${companyDomain}"`, email, domain_match: false };
    }
  }

  return { status: 'valid', reason: 'Valid email with working mail server', email, domain_match };
}
