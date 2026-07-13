const db = require('./src/lib/db');

async function migrate() {
  console.log('=== Full Project Scoping Migration ===\n');

  // Tables that need project_id
  const tables = [
    'gtm_tasks',
    'gtm_messages', 
    'gtm_shared_docs',
    'gtm_activity_logs',
    'gtm_team_remarks',
    'gtm_email_sends',
    'gtm_notifications',
  ];

  for (const table of tables) {
    console.log(`Adding project_id to ${table}...`);
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES gtm_projects(id)`);
      // Assign existing data to project 1 (Russia GTM)
      const r = await db.query(`UPDATE ${table} SET project_id = 1 WHERE project_id IS NULL`);
      console.log(`  ✅ ${table}: column added, ${r.rowCount} rows assigned to project 1`);
    } catch (e) {
      console.log(`  ⚠️ ${table}: ${e.message}`);
    }
  }

  // Create indexes
  console.log('\nCreating indexes...');
  const indexTables = ['gtm_tasks', 'gtm_messages', 'gtm_shared_docs', 'gtm_activity_logs', 'gtm_email_sends'];
  for (const t of indexTables) {
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_${t.replace('gtm_','')}_project ON ${t}(project_id)`); } catch {}
  }
  console.log('  ✅ Indexes created');

  // Verify
  for (const table of tables) {
    const c = await db.queryOne(`SELECT COUNT(*) as c FROM ${table} WHERE project_id IS NOT NULL`);
    const t = await db.queryOne(`SELECT COUNT(*) as c FROM ${table}`);
    console.log(`  ${table}: ${c.c}/${t.c} rows have project_id`);
  }

  console.log('\n✅ All tables migrated!');
  process.exit(0);
}

migrate().catch(e => { console.error('FATAL:', e); process.exit(1); });
