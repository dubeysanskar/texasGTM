import { NextResponse } from 'next/server';
const { queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isManager } = require('@/lib/auth');

export async function PUT(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const b = await request.json();
  const lead = await queryOne('SELECT * FROM gtm_leads WHERE id = $1', [id]);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (b.status && b.status !== lead.status) {
    await query('INSERT INTO gtm_lead_status_history (lead_id, old_status, new_status, changed_by, changed_by_name) VALUES ($1,$2,$3,$4,$5)',
      [id, lead.status, b.status, user.id, user.name]);
    // Activity log
    await query('INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [user.id, user.name, user.role, `Changed "${lead.company_name}" status: ${lead.status} → ${b.status}`, 'lead', 'lead', id]);
  }

  const fields = ['company_name','domain','sector','priority','status','city','region','country','company_size','pain_point','decision_maker_title','phone','email','contact_method','source_url','find_instructions','notes','last_contacted_at','next_followup_at','contacted_by','last_template_id'];
  const updates = []; const vals = [];
  fields.forEach(f => { if (b[f] !== undefined) { vals.push(b[f]); updates.push(`${f} = $${vals.length}`); } });
  vals.push(id);
  if (updates.length > 0) await query(`UPDATE gtm_leads SET ${updates.join(',')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);

  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const lead = await queryOne('SELECT company_name FROM gtm_leads WHERE id = $1', [id]);
  await query('DELETE FROM gtm_leads WHERE id = $1', [id]);
  // Activity log
  await query('INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user.id, user.name, user.role, `Deleted lead "${lead?.company_name || id}"`, 'lead', 'lead', id]);
  return NextResponse.json({ success: true });
}
