import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { analyzeEmailQuality, validateEmail, verifyEmailExistsSMTP } = require('@/lib/scraper');

/**
 * GET /api/leads/verify — Quick format scan (instant, no DNS)
 */
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const leads = await queryAll('SELECT id, email, domain, company_name FROM gtm_leads ORDER BY id');
  const stats = { total: leads.length, valid_format: 0, invalid_format: 0, placeholder: 0, empty: 0, has_domain: 0, no_domain: 0 };
  const badLeadIds = [];

  for (const lead of leads) {
    const result = validateEmail(lead.email);
    if (result.status === 'empty') { stats.empty++; badLeadIds.push(lead.id); }
    else if (result.status === 'invalid_format') { stats.invalid_format++; badLeadIds.push(lead.id); }
    else if (result.status === 'placeholder') { stats.placeholder++; badLeadIds.push(lead.id); }
    else stats.valid_format++;
    if (lead.domain && lead.domain.trim()) stats.has_domain++;
    else stats.no_domain++;
  }

  stats.bad_total = stats.invalid_format + stats.placeholder + stats.empty;
  stats.bad_lead_ids = badLeadIds;
  return NextResponse.json(stats);
}

/**
 * POST /api/leads/verify — Deep verification with MX + SMTP
 * 
 * Body: { maxLeads?: number, offset?: number, smtpCheck?: boolean }
 * 
 * smtpCheck = true  → Actually connects to mail servers to verify if mailbox exists (slower)
 * smtpCheck = false → Only checks DNS MX records + domain match (faster)
 */
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { maxLeads = 200, offset = 0, smtpCheck = false } = await request.json();

  const leads = await queryAll(
    'SELECT id, email, domain, company_name FROM gtm_leads WHERE email IS NOT NULL AND email != \'\' ORDER BY id LIMIT $1 OFFSET $2',
    [maxLeads, offset]
  );

  const results = {
    total_checked: leads.length,
    valid: 0,
    invalid_format: 0,
    no_mx: 0,
    placeholder: 0,
    suspicious: 0,
    domain_mismatch: 0,
    // SMTP-specific
    smtp_exists: 0,
    smtp_not_exists: 0,
    smtp_unknown: 0,
    details: [],
  };

  for (const lead of leads) {
    try {
      // Step 1: MX/format analysis
      const analysis = await analyzeEmailQuality(lead.email, lead.domain);

      // Step 2: If smtpCheck enabled AND email passes format check, verify via SMTP
      let smtpResult = null;
      if (smtpCheck && analysis.status === 'valid') {
        try {
          smtpResult = await verifyEmailExistsSMTP(lead.email);
          if (smtpResult.exists === true) results.smtp_exists++;
          else if (smtpResult.exists === false) results.smtp_not_exists++;
          else results.smtp_unknown++;
        } catch {
          smtpResult = { exists: 'unknown', reason: 'SMTP check failed' };
          results.smtp_unknown++;
        }
      }

      // Determine final status
      let finalStatus = analysis.status;
      let finalReason = analysis.reason;

      if (smtpResult && smtpResult.exists === false) {
        finalStatus = 'not_exists';
        finalReason = `SMTP: ${smtpResult.reason}`;
      }

      results[analysis.status] = (results[analysis.status] || 0) + 1;

      // Include in details if not perfectly valid, or if SMTP says non-existent
      if (finalStatus !== 'valid' || (smtpResult && smtpResult.exists !== true)) {
        results.details.push({
          id: lead.id,
          company: lead.company_name,
          email: lead.email,
          domain: lead.domain,
          status: finalStatus,
          reason: finalReason,
          smtp: smtpResult ? { exists: smtpResult.exists, reason: smtpResult.reason, code: smtpResult.code } : null,
        });
      }
    } catch {
      results.details.push({ id: lead.id, company: lead.company_name, email: lead.email, status: 'error', reason: 'Verification failed' });
    }
  }

  // Sort: worst first
  const order = { not_exists: 0, no_mx: 1, invalid_format: 2, placeholder: 3, domain_mismatch: 4, suspicious: 5, error: 6, valid: 7 };
  results.details.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return NextResponse.json(results);
}
