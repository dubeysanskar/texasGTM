import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const XLSX = require('xlsx');

  let leads;
  try {
    const body = await request.json();
    if (body.leadIds && body.leadIds.length) {
      const placeholders = body.leadIds.map((_, i) => `$${i + 1}`).join(',');
      leads = await queryAll(`SELECT * FROM gtm_leads WHERE id IN (${placeholders}) ORDER BY priority, created_at DESC`, body.leadIds);
    } else {
      leads = await queryAll('SELECT * FROM gtm_leads ORDER BY priority, created_at DESC');
    }
  } catch {
    leads = await queryAll('SELECT * FROM gtm_leads ORDER BY priority, created_at DESC');
  }

  const SECTOR_LABELS = {
    construction: 'Construction', manufacturing: 'Manufacturing',
    warehouse_logistics: 'Warehouse/Logistics', food_processing: 'Food Processing',
    metallurgy: 'Metallurgy', mining: 'Mining', chemicals: 'Chemicals',
    automotive: 'Automotive', hospitality: 'Hospitality', retail: 'Retail',
    agency_partner: 'Agency Partner', industry_association: 'Industry Association', other: 'Other',
  };
  const STATUS_LABELS = {
    not_contacted: 'Not Contacted', email_sent: 'Email Sent', call_made: 'Call Made',
    replied: 'Replied', meeting_booked: 'Meeting Booked', proposal_sent: 'Proposal Sent',
    negotiating: 'Negotiating', contract_signed: 'Contract Signed ✓',
    not_interested: 'Not Interested', follow_up_later: 'Follow Up Later',
  };

  const headers = ['#', 'Company', 'Domain', 'Sector', 'City/Region', 'Size', 'Why They Need Workers', 'Decision Maker', 'Contact Method', 'Phone', 'Email', 'Where to Find', 'Priority', 'Status', 'Last Contacted', 'Notes'];

  const rows = leads.map((lead, i) => [
    i + 1, lead.company_name, lead.domain || '',
    SECTOR_LABELS[lead.sector] || lead.sector,
    [lead.city, lead.region].filter(Boolean).join(', '),
    lead.company_size || '', lead.pain_point || '', lead.decision_maker_title || '',
    lead.contact_method || '', lead.phone || '', lead.email || '',
    lead.find_instructions || '', lead.priority,
    STATUS_LABELS[lead.status] || lead.status,
    lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString('en-GB') : '',
    lead.notes || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 42 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];

  const hotLeads = leads.filter(l => l.priority === 'HOT');
  const hotRows = hotLeads.map((lead, i) => [
    i + 1, lead.company_name, lead.domain || '',
    SECTOR_LABELS[lead.sector] || lead.sector,
    [lead.city, lead.region].filter(Boolean).join(', '),
    lead.company_size || '', lead.pain_point || '', lead.decision_maker_title || '',
    lead.contact_method || '', lead.phone || '', lead.email || '',
    lead.find_instructions || '', lead.priority,
    STATUS_LABELS[lead.status] || lead.status,
    lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString('en-GB') : '',
    lead.notes || '',
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([headers, ...hotRows]);
  ws2['!cols'] = ws['!cols'];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'All Leads');
  XLSX.utils.book_append_sheet(wb, ws2, 'HOT Leads');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TexasGTM_Leads_${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });
}
