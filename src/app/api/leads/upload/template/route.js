import { NextResponse } from 'next/server';
const XLSX = require('xlsx');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

// Lead fields template with sample data
const TEMPLATE_COLUMNS = [
  'company_name', 'email', 'phone', 'city', 'domain', 'sector',
  'company_size', 'decision_maker_title', 'contact_person',
  'pain_point', 'notes', 'source_url', 'priority', 'status'
];

const SAMPLE_ROW = {
  company_name: 'Acme Construction LLC',
  email: 'info@acmeconstruction.ae',
  phone: '+971501234567',
  city: 'Dubai',
  domain: 'acmeconstruction.ae',
  sector: 'construction',
  company_size: '50-100',
  decision_maker_title: 'General Manager',
  contact_person: 'Ahmed Al Maktoum',
  pain_point: 'Needs skilled construction workers',
  notes: 'Met at Big 5 exhibition',
  source_url: 'https://acmeconstruction.ae',
  priority: 'HIGH',
  status: 'not_contacted',
};

/**
 * GET — Download Excel template with column headers + 1 sample row
 */
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wb = XLSX.utils.book_new();
  const wsData = [TEMPLATE_COLUMNS, TEMPLATE_COLUMNS.map(col => SAMPLE_ROW[col] || '')];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = TEMPLATE_COLUMNS.map(col => ({ wch: Math.max(col.length + 4, 20) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  // Add a second sheet with field descriptions
  const helpData = [
    ['Field', 'Required', 'Description', 'Valid Values'],
    ['company_name', 'YES', 'Company or organization name', 'Any text (2-120 chars)'],
    ['email', 'No', 'Contact email address', 'Valid email format'],
    ['phone', 'No', 'Phone number with country code', '+971501234567'],
    ['city', 'No', 'City where company is located', 'Dubai, Riyadh, etc.'],
    ['domain', 'No', 'Company website domain', 'example.com'],
    ['sector', 'No', 'Industry sector', 'construction, hospitality, logistics, manufacturing, retail, healthcare, etc.'],
    ['company_size', 'No', 'Approximate company size', '10-50, 50-100, 100-500, 500+'],
    ['decision_maker_title', 'No', 'Title of decision maker', 'CEO, General Manager, HR Director, etc.'],
    ['contact_person', 'No', 'Name of contact person', 'Full name'],
    ['pain_point', 'No', 'Business pain point or need', 'Free text'],
    ['notes', 'No', 'Additional notes', 'Free text'],
    ['source_url', 'No', 'URL where lead was found', 'https://...'],
    ['priority', 'No', 'Lead priority level', 'HOT, HIGH, MEDIUM, PARTNER'],
    ['status', 'No', 'Lead status', 'not_contacted, touch_1, touch_2, email_sent, replied, meeting_booked, etc.'],
  ];
  const helpWs = XLSX.utils.aoa_to_sheet(helpData);
  helpWs['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 40 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, helpWs, 'Field Guide');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="lead_upload_template.xlsx"',
    },
  });
}
