const db = require('./src/lib/db');

async function migrate() {
  console.log('=== Multi-Project Migration ===\n');

  // 1. Create gtm_projects table
  console.log('1. Creating gtm_projects table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS gtm_projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL,
      country VARCHAR(100),
      description TEXT,
      color VARCHAR(7) DEFAULT '#3B82F6',
      icon VARCHAR(50) DEFAULT 'language',
      scraper_config JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES gtm_users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('   ✅ gtm_projects created');

  // 2. Add project_id to scoped tables
  const tables = ['gtm_leads', 'gtm_email_campaigns', 'gtm_templates', 'gtm_scrape_jobs'];
  for (const table of tables) {
    console.log(`2. Adding project_id to ${table}...`);
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES gtm_projects(id)`);
      console.log(`   ✅ ${table}.project_id added`);
    } catch (e) {
      if (e.message.includes('already exists')) console.log(`   ⏭️  ${table}.project_id already exists`);
      else throw e;
    }
  }

  // 3. Create default "Russia GTM" project
  console.log('3. Creating default project...');
  const existing = await db.queryOne("SELECT id FROM gtm_projects WHERE slug = 'russia-gtm'");
  let projectId;
  if (existing) {
    projectId = existing.id;
    console.log(`   ⏭️  "Russia GTM" already exists (id=${projectId})`);
  } else {
    const r = await db.query(
      "INSERT INTO gtm_projects (name, slug, country, color, icon, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      ['Russia GTM', 'russia-gtm', 'Russia', '#DC2626', 'language', 'Russian market outreach — manufacturing, construction, logistics']
    );
    projectId = r.rows[0].id;
    console.log(`   ✅ "Russia GTM" created (id=${projectId})`);
  }

  // 4. Assign all existing data to Russia GTM
  console.log('4. Assigning existing data to Russia GTM...');
  for (const table of tables) {
    const result = await db.query(`UPDATE ${table} SET project_id = $1 WHERE project_id IS NULL`, [projectId]);
    console.log(`   ✅ ${table}: ${result.rowCount} rows updated`);
  }

  // 5. Create indexes
  console.log('5. Creating indexes...');
  try { await db.query('CREATE INDEX IF NOT EXISTS idx_leads_project ON gtm_leads(project_id)'); } catch {}
  try { await db.query('CREATE INDEX IF NOT EXISTS idx_campaigns_project ON gtm_email_campaigns(project_id)'); } catch {}
  try { await db.query('CREATE INDEX IF NOT EXISTS idx_templates_project ON gtm_templates(project_id)'); } catch {}
  try { await db.query('CREATE INDEX IF NOT EXISTS idx_scrape_jobs_project ON gtm_scrape_jobs(project_id)'); } catch {}
  console.log('   ✅ Indexes created');

  // Verify
  const count = await db.queryOne('SELECT COUNT(*) as c FROM gtm_projects');
  const leads = await db.queryOne('SELECT COUNT(*) as c FROM gtm_leads WHERE project_id IS NOT NULL');
  console.log(`\n✅ Done! ${count.c} project(s), ${leads.c} leads assigned.`);

  process.exit(0);
}

migrate().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
