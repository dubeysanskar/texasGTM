const db = require('./src/lib/db');

async function run() {
  // Check email sends table schema
  const cols = await db.queryAll("SELECT column_name FROM information_schema.columns WHERE table_name='gtm_email_sends' ORDER BY ordinal_position");
  console.log('EMAIL SENDS COLUMNS:', cols.map(c => c.column_name).join(', '));

  // Check for bounced/failed sends
  const sends = await db.queryAll("SELECT id, lead_id, to_email, status, error_message FROM gtm_email_sends WHERE status IN ('bounced','failed','error') LIMIT 10");
  console.log('\nBOUNCED/FAILED:', JSON.stringify(sends, null, 2));

  // Check all distinct statuses
  const statuses = await db.queryAll("SELECT status, COUNT(*) as cnt FROM gtm_email_sends GROUP BY status");
  console.log('\nSTATUS BREAKDOWN:', JSON.stringify(statuses, null, 2));

  // Sample of leads with info@ emails
  const info = await db.queryAll("SELECT COUNT(*) as cnt FROM gtm_leads WHERE email LIKE 'info@%'");
  console.log('\nLeads with info@ emails:', info[0]?.cnt);

  const hr = await db.queryAll("SELECT COUNT(*) as cnt FROM gtm_leads WHERE email LIKE 'hr@%'");
  console.log('Leads with hr@ emails:', hr[0]?.cnt);

  const no_domain = await db.queryAll("SELECT COUNT(*) as cnt FROM gtm_leads WHERE domain IS NULL OR domain = ''");
  console.log('Leads with NO domain:', no_domain[0]?.cnt);

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
