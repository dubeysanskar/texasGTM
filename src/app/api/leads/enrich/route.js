import { NextResponse } from 'next/server';
const { queryOne, queryAll, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { enrichLeadContacts } = require('@/lib/scraper');

/**
 * POST /api/leads/enrich
 * 
 * Enriches existing leads with correct contact info using 4 fallback sources:
 *   1. Website crawling (cheerio) — scrape company website contact pages
 *   2. 2GIS API lookup — search by company name + city
 *   3. hh.ru employer lookup — find company on hh.ru, get website, then crawl
 *   4. Email pattern guessing — try info@, office@, hr@ patterns
 * 
 * Body: { mode: 'all_missing' | 'selected', leadIds?: number[] }
 */
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { mode, leadIds } = await request.json();
  const apiKey2GIS = process.env.TWOGIS_API_KEY || null;

  // Get leads to enrich
  let leads = [];
  if (mode === 'selected' && leadIds?.length) {
    const placeholders = leadIds.map((_, i) => `$${i + 1}`).join(',');
    leads = await queryAll(`SELECT * FROM gtm_leads WHERE id IN (${placeholders})`, leadIds);
  } else {
    // All leads with missing email or phone
    leads = await queryAll(
      `SELECT * FROM gtm_leads WHERE (email IS NULL OR email = '' OR phone IS NULL OR phone = '') ORDER BY created_at DESC LIMIT 200`
    );
  }

  if (leads.length === 0) {
    return NextResponse.json({ total: 0, enriched: 0, emails_found: 0, phones_found: 0, message: 'No leads need enrichment' });
  }

  // Create a tracking job
  const job = await query(
    "INSERT INTO gtm_scrape_jobs (source, query, status, started_at, created_by) VALUES ($1, $2, 'running', NOW(), $3) RETURNING id",
    ['enrichment', `Enriching ${leads.length} leads`, user.id]
  );
  const jobId = job.rows[0].id;

  let enriched = 0, emailsFound = 0, phonesFound = 0, failed = 0;

  try {
    for (const lead of leads) {
      try {
        const result = await enrichLeadContacts(lead, apiKey2GIS);

        // Check if anything new was found
        const hasNewEmail = result.email && result.email !== lead.email;
        const hasNewPhone = result.phone && result.phone !== lead.phone;
        const hasNewDomain = result.domain && result.domain !== lead.domain;
        const hasNewSize = result.company_size && result.company_size !== lead.company_size;

        if (hasNewEmail || hasNewPhone || hasNewDomain || hasNewSize) {
          // Build dynamic update query
          const updates = [];
          const params = [];
          let paramIdx = 1;

          if (hasNewEmail) { updates.push(`email = $${paramIdx++}`); params.push(result.email); emailsFound++; }
          if (hasNewPhone) { updates.push(`phone = $${paramIdx++}`); params.push(result.phone); phonesFound++; }
          if (hasNewDomain) { updates.push(`domain = $${paramIdx++}`); params.push(result.domain); }
          if (hasNewSize) { updates.push(`company_size = $${paramIdx++}`); params.push(result.company_size); }
          updates.push(`updated_at = NOW()`);
          updates.push(`notes = COALESCE(notes, '') || $${paramIdx++}`);
          params.push(` | Enriched via: ${[...new Set(result.source_used)].join(', ')}`);

          params.push(lead.id);
          await query(`UPDATE gtm_leads SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
          enriched++;
        }
      } catch (e) {
        console.error(`[enrich] Lead #${lead.id} error:`, e.message);
        failed++;
      }

      // Small delay between leads to avoid overwhelming external services
      await new Promise(r => setTimeout(r, 300));
    }

    await query("UPDATE gtm_scrape_jobs SET status = 'completed', leads_found = $1, leads_added = $2, leads_skipped = $3, completed_at = NOW() WHERE id = $4",
      [leads.length, enriched, failed, jobId]);

    return NextResponse.json({ total: leads.length, enriched, emails_found: emailsFound, phones_found: phonesFound, failed });

  } catch (err) {
    console.error('[enrich] job failed:', err);
    await query("UPDATE gtm_scrape_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2", [err.message, jobId]);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** GET /api/leads/enrich — returns count of leads needing enrichment */
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const missingEmail = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE email IS NULL OR email = ''");
  const missingPhone = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE phone IS NULL OR phone = ''");
  const missingBoth = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE (email IS NULL OR email = '') AND (phone IS NULL OR phone = '')");
  const total = await queryOne("SELECT COUNT(*) as c FROM gtm_leads");

  return NextResponse.json({
    total: parseInt(total?.c || 0),
    missing_email: parseInt(missingEmail?.c || 0),
    missing_phone: parseInt(missingPhone?.c || 0),
    missing_both: parseInt(missingBoth?.c || 0),
  });
}
