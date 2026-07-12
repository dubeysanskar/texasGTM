import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { analyzeEmailQuality, validateEmail } = require('@/lib/scraper');

/**
 * GET /api/leads/verify
 * Quick stats: counts by email format (no DNS check, instant)
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
    else { stats.valid_format++; }

    if (lead.domain && lead.domain.trim()) stats.has_domain++;
    else stats.no_domain++;
  }

  stats.bad_total = stats.invalid_format + stats.placeholder + stats.empty;
  stats.bad_lead_ids = badLeadIds;

  return NextResponse.json(stats);
}

/**
 * POST /api/leads/verify
 * Deep verification: checks MX records + domain match (slower, runs DNS lookups)
 * Body: { maxLeads?: number, offset?: number }
 */
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { maxLeads = 200, offset = 0 } = await request.json();

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
    details: [],
  };

  // Group by email domain to batch MX checks
  const domainGroups = {};
  for (const lead of leads) {
    const email = (lead.email || '').trim().toLowerCase();
    const emailDomain = email.includes('@') ? email.split('@')[1] : '';
    if (!domainGroups[emailDomain]) domainGroups[emailDomain] = [];
    domainGroups[emailDomain].push(lead);
  }

  // Process each lead with full analysis
  for (const lead of leads) {
    try {
      const analysis = await analyzeEmailQuality(lead.email, lead.domain);
      results[analysis.status] = (results[analysis.status] || 0) + 1;

      // Only include bad/suspicious ones in details (to keep response small)
      if (analysis.status !== 'valid') {
        results.details.push({
          id: lead.id,
          company: lead.company_name,
          email: lead.email,
          domain: lead.domain,
          status: analysis.status,
          reason: analysis.reason,
        });
      }
    } catch {
      results.details.push({
        id: lead.id, company: lead.company_name, email: lead.email,
        status: 'error', reason: 'Verification failed',
      });
    }
  }

  // Sort details: worst first
  const statusOrder = { no_mx: 0, invalid_format: 1, placeholder: 2, domain_mismatch: 3, suspicious: 4, error: 5 };
  results.details.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  return NextResponse.json(results);
}
