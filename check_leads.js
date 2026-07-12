// Clean garbage leads from the database
const db = require('./src/lib/db');

// Patterns that indicate a garbage lead (not a real company)
const GARBAGE_PATTERNS = [
  /^captcha/i,
  /^работа\b/i,    // "Работа..." = job listing title
  /^вакансии?\b/i,  // "Вакансия..." = vacancy title
  /^свежие/i,      // "Свежие вакансии" = fresh vacancies
  /^поиск/i,       // "Поиск работы" = job search
  /^найти/i,       // "Найти работу" = find job
  /^резюме/i,      // resume
  /^hh\.ru/i,
  /^superjob/i,
  /^indeed/i,
  /^avito/i,
  /^duckduckgo/i,
  /^google/i,
  /^yandex/i,
  /^error/i,
  /^404/i,
  /^403/i,
  /^access denied/i,
  /^page not found/i,
  /^verify/i,
];

async function run() {
  const leads = await db.queryAll('SELECT id, company_name, domain, email FROM gtm_leads ORDER BY id');
  console.log(`Total leads: ${leads.length}\n`);

  const garbage = [];
  for (const lead of leads) {
    const name = (lead.company_name || '').trim();
    const isGarbage = GARBAGE_PATTERNS.some(p => p.test(name)) || name.length < 2 || name.length > 150;
    if (isGarbage) {
      garbage.push(lead);
    }
  }

  console.log(`Found ${garbage.length} garbage leads:`);
  garbage.forEach(g => console.log(`  #${g.id}: "${g.company_name}" (${g.domain || 'no domain'})`));

  if (garbage.length > 0) {
    const ids = garbage.map(g => g.id);
    // Delete them
    for (const id of ids) {
      await db.query('DELETE FROM gtm_leads WHERE id = $1', [id]);
    }
    console.log(`\n✅ Deleted ${ids.length} garbage leads`);
  }

  // Also show leads with bad domains (contains /)
  const badDomain = await db.queryAll("SELECT id, company_name, domain FROM gtm_leads WHERE domain LIKE '%/%' LIMIT 10");
  if (badDomain.length > 0) {
    console.log(`\n⚠️ ${badDomain.length} leads have bad domains (contain /):`);
    badDomain.forEach(b => console.log(`  #${b.id}: domain="${b.domain}"`));
    // Fix them by taking only the first part
    for (const b of badDomain) {
      const fixed = b.domain.split('/')[0].trim();
      await db.query('UPDATE gtm_leads SET domain = $1 WHERE id = $2', [fixed, b.id]);
    }
    console.log(`Fixed ${badDomain.length} domains`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
