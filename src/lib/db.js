const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[db] FATAL: DATABASE_URL not set. Set it in .env');
}

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => console.error('[db] pool error:', err.message));
  }
  return pool;
}

/** Run a single query */
async function query(text, params = []) {
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}

/** Get a single row */
async function queryOne(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/** Get all rows */
async function queryAll(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

/** Initialize all tables */
async function initSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS gtm_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'staff',
      company TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      setup_otp TEXT,
      setup_otp_expires TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      assigned_by INTEGER NOT NULL,
      assigner_name TEXT NOT NULL,
      assigned_to INTEGER,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      completion_days INTEGER DEFAULT 2,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_task_comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES gtm_tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      message TEXT NOT NULL,
      edited_at TIMESTAMP,
      deleted_at TIMESTAMP,
      image_filename TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_task_status_history (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES gtm_tasks(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT,
      changed_by INTEGER,
      changed_by_name TEXT,
      changed_by_role TEXT,
      changed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_leads (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      domain TEXT,
      sector TEXT NOT NULL DEFAULT 'other',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'not_contacted',
      city TEXT,
      region TEXT,
      country TEXT DEFAULT '',
      company_size TEXT,
      pain_point TEXT,
      decision_maker_title TEXT,
      phone TEXT,
      email TEXT,
      contact_method TEXT,
      source_url TEXT,
      find_instructions TEXT,
      notes TEXT,
      last_contacted_at TEXT,
      next_followup_at TEXT,
      contacted_by TEXT,
      scraped_from TEXT,
      dedup_key TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_gtm_leads_dedup ON gtm_leads(dedup_key);
    CREATE INDEX IF NOT EXISTS idx_gtm_leads_priority ON gtm_leads(priority);
    CREATE INDEX IF NOT EXISTS idx_gtm_leads_status ON gtm_leads(status);

    CREATE TABLE IF NOT EXISTS gtm_lead_status_history (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES gtm_leads(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER,
      changed_by_name TEXT,
      note TEXT,
      changed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_scrape_jobs (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      query TEXT,
      status TEXT DEFAULT 'pending',
      leads_found INTEGER DEFAULT 0,
      leads_added INTEGER DEFAULT 0,
      leads_skipped INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT DEFAULT 'general',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_gtm_notif_user ON gtm_notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_gtm_notif_read ON gtm_notifications(is_read);

    CREATE TABLE IF NOT EXISTS gtm_activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      user_name TEXT DEFAULT '',
      user_role TEXT DEFAULT '',
      action TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      entity_type TEXT DEFAULT '',
      entity_id INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_gtm_logs_user ON gtm_activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_gtm_logs_cat ON gtm_activity_logs(category);

    CREATE TABLE IF NOT EXISTS gtm_shared_docs (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      category TEXT DEFAULT 'general',
      uploaded_by INTEGER NOT NULL,
      uploader_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gtm_team_remarks (
      id SERIAL PRIMARY KEY,
      team_member_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT DEFAULT '',
      remark TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_gtm_msgs_sender ON gtm_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_gtm_msgs_receiver ON gtm_messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_gtm_task_comments ON gtm_task_comments(task_id);
  `);

  // Seed default settings
  const defaults = [
    ['app_name', 'TexasGTM'],
    ['role_label_super_admin', 'Super Admin'],
    ['role_label_manager', 'Manager'],
    ['role_label_staff', 'Staff'],
    ['role_label_marketing', 'Marketing'],
    ['role_label_viewer', 'Viewer'],
  ];
  for (const [key, value] of defaults) {
    await p.query(
      `INSERT INTO gtm_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }

  console.log('[db] TexasGTM schema initialized');
}

module.exports = { query, queryOne, queryAll, getPool, initSchema };
