/**
 * Scraper Utilities for Taha Airwaves Marketing CRM
 * 
 * Provides multi-source lead scraping and enrichment:
 *   1. 2GIS Catalog API — Russian business directory
 *   2. Website crawling (cheerio) — extract contacts from company sites
 *   3. Email pattern guessing — try common email patterns
 *   4. hh.ru employer lookup — get company details
 * 
 * Cheerio = Node.js equivalent of Python's Beautiful Soup
 */

const cheerio = require('cheerio');

// ─── Russian Cities ────────────────────────────────────────
const RUSSIAN_CITIES = [
  { name: 'Москва', key: 'moscow' },
  { name: 'Санкт-Петербург', key: 'spb' },
  { name: 'Новосибирск', key: 'novosibirsk' },
  { name: 'Екатеринбург', key: 'yekaterinburg' },
  { name: 'Казань', key: 'kazan' },
  { name: 'Челябинск', key: 'chelyabinsk' },
  { name: 'Нижний Новгород', key: 'nn' },
  { name: 'Самара', key: 'samara' },
  { name: 'Красноярск', key: 'krasnoyarsk' },
  { name: 'Уфа', key: 'ufa' },
  { name: 'Ростов-на-Дону', key: 'rostov' },
  { name: 'Краснодар', key: 'krasnodar' },
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

// Flat list of all industry options for the UI
const INDUSTRY_OPTIONS = [
  { value: 'all', label: 'All Industries / Все отрасли' },
  { value: 'manufacturing', label: 'Производство (Manufacturing)' },
  { value: 'construction', label: 'Строительство (Construction)' },
  { value: 'metallurgy', label: 'Металлургия (Metallurgy)' },
  { value: 'food_processing', label: 'Пищевое производство (Food)' },
  { value: 'warehouse_logistics', label: 'Склад/Логистика (Warehouse)' },
  { value: 'mining', label: 'Горнодобыча (Mining)' },
  { value: 'chemicals', label: 'Химия/Нефть (Chemicals)' },
  { value: 'automotive', label: 'Машиностроение (Automotive)' },
  { value: 'woodworking', label: 'Деревообработка (Woodworking)' },
  { value: 'textiles', label: 'Текстиль (Textiles)' },
  { value: 'energy', label: 'Энергетика (Energy)' },
  { value: 'agriculture', label: 'Сельское хоз-во (Agriculture)' },
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
    decision_maker_title: 'Генеральный директор / HR Director',
    phone,
    email,
    source_url: `https://2gis.ru/search/${encodeURIComponent(item.org?.name || item.name || '')}`,
    find_instructions: `2GIS: ${item.full_name || item.name || ''}. Address: ${item.address_name || ''}`,
    notes: `Found via 2GIS search. ${item.schedule?.comment || ''} ${rubricNames ? 'Rubrics: ' + rubricNames : ''}`.trim(),
    scraped_from: '2gis',
  };
}

// ─── 2. WEBSITE CRAWLING (CHEERIO / Beautiful Soup style) ────
const CONTACT_PATHS = ['/contacts', '/kontakty', '/contact', '/about', '/o-kompanii', '/about-us', '/kontakt', '/'];
const EMAIL_REGEX = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g;
const RU_PHONE_REGEX = /(?:\+7|8)[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/g;
const JUNK_EMAIL_PATTERNS = ['example.com', 'wixpress', 'sentry.io', 'schema.org', 'w3.org', 'googleapis', 'facebook', 'twitter', 'instagram', 'vk.com', 'mail.ru', '.png', '.jpg', '.svg', '.css', '.js'];

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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract from mailto: links
      $('a[href^="mailto:"]').each((_, el) => {
        const email = $(el).attr('href').replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email && !isJunkEmail(email) && !contacts.emails.includes(email)) {
          contacts.emails.push(email);
        }
      });

      // Extract from tel: links
      $('a[href^="tel:"]').each((_, el) => {
        const phone = cleanPhone($(el).attr('href').replace('tel:', ''));
        if (phone && !contacts.phones.includes(phone)) contacts.phones.push(phone);
      });

      // Regex scan the full text
      const bodyText = $('body').text();

      const foundEmails = bodyText.match(EMAIL_REGEX) || [];
      for (const e of foundEmails) {
        const email = e.toLowerCase();
        if (!isJunkEmail(email) && !contacts.emails.includes(email)) contacts.emails.push(email);
      }

      const foundPhones = bodyText.match(RU_PHONE_REGEX) || [];
      for (const p of foundPhones) {
        const phone = cleanPhone(p);
        if (phone && !contacts.phones.includes(phone)) contacts.phones.push(phone);
      }

      // If we found good data, no need to check more paths
      if (contacts.emails.length > 0 && contacts.phones.length > 0) break;

    } catch { /* timeout or network error, try next path */ }
  }

  return contacts;
}

function isJunkEmail(email) {
  return JUNK_EMAIL_PATTERNS.some(p => email.includes(p)) || email.length > 60 || email.length < 5;
}

function cleanPhone(phone) {
  return (phone || '').replace(/[\s\-\.\(\)]/g, '').trim();
}

// ─── 3. EMAIL PATTERN GUESSING ───────────────────────────────
function guessEmails(domain) {
  if (!domain) return [];
  return [
    `info@${domain}`,
    `office@${domain}`,
    `hr@${domain}`,
    `mail@${domain}`,
    `sales@${domain}`,
  ];
}

// ─── 4. HH.RU EMPLOYER LOOKUP ────────────────────────────────
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

    // Get full employer details
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
 */
async function enrichLeadContacts(lead, apiKey2GIS) {
  const result = {
    email: lead.email || '',
    phone: lead.phone || '',
    domain: lead.domain || '',
    decision_maker_title: lead.decision_maker_title || '',
    company_size: lead.company_size || '',
    source_used: [],
  };

  // === Fallback 1: Website crawling ===
  if (result.domain) {
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
    } catch { /* move to next fallback */ }
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
    } catch { /* move to next fallback */ }
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
    } catch { /* move to next fallback */ }
  }

  // === Fallback 4: Email pattern guessing ===
  if (!result.email && result.domain) {
    const guesses = guessEmails(result.domain);
    result.email = guesses[0] || ''; // info@domain is the most common
    result.source_used.push('guessed');
  }

  return result;
}

module.exports = {
  RUSSIAN_CITIES,
  INDUSTRY_KEYWORDS,
  INDUSTRY_OPTIONS,
  search2GIS,
  parse2GISItem,
  scrapeWebsiteContacts,
  guessEmails,
  lookupHHRuEmployer,
  enrichLeadContacts,
  inferSectorFrom2GIS,
};
