/**
 * Auto Email Worker — Batch processor with rate limiting
 * Processes campaign sends in batches with delays to avoid spam flags
 */
const { queryAll, queryOne, query } = require('@/lib/db');
const {
  getEligibleLeads,
  resolveTemplate,
  personalizeWithLLM,
  buildEmailHTML,
  sendCampaignEmail,
} = require('@/lib/auto-email');

const BATCH_SIZE = 10;
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 8000;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a campaign: fetch eligible leads, personalize, queue, and send
 * Returns { sent, failed, skipped, total }
 */
async function processCampaign(campaignId) {
  const campaign = await queryOne('SELECT * FROM gtm_email_campaigns WHERE id = $1', [campaignId]);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.template_id) throw new Error('No template assigned to campaign');

  // Mark campaign as active
  await query("UPDATE gtm_email_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1", [campaignId]);

  // Get eligible leads
  const leads = await getEligibleLeads(campaignId);
  if (leads.length === 0) {
    await query("UPDATE gtm_email_campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1", [campaignId]);
    return { sent: 0, failed: 0, skipped: 0, total: 0, message: 'No eligible leads found' };
  }

  // Check daily limit — how many already sent today
  const todaySent = await queryOne(
    "SELECT COUNT(*) as c FROM gtm_email_sends WHERE campaign_id = $1 AND sent_at >= CURRENT_DATE",
    [campaignId]
  );
  const alreadySentToday = parseInt(todaySent?.c || 0);
  const remainingToday = Math.max(0, (campaign.daily_limit || 50) - alreadySentToday);

  if (remainingToday === 0) {
    return { sent: 0, failed: 0, skipped: leads.length, total: leads.length, message: 'Daily limit reached' };
  }

  // Limit to daily allowance
  const leadsToProcess = leads.slice(0, remainingToday);

  // Update total_leads count
  await query('UPDATE gtm_email_campaigns SET total_leads = $1, updated_at = NOW() WHERE id = $2', [leads.length + (campaign.total_sent || 0), campaignId]);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < leadsToProcess.length; i += BATCH_SIZE) {
    // Re-check campaign status (allow pausing mid-run)
    const currentCampaign = await queryOne('SELECT status FROM gtm_email_campaigns WHERE id = $1', [campaignId]);
    if (currentCampaign?.status === 'paused') {
      break;
    }

    const batch = leadsToProcess.slice(i, i + BATCH_SIZE);

    for (const lead of batch) {
      try {
        // Re-check campaign status
        const cs = await queryOne('SELECT status FROM gtm_email_campaigns WHERE id = $1', [campaignId]);
        if (cs?.status === 'paused') break;

        // Resolve template
        const { subject, body } = await resolveTemplate(
          campaign.template_id,
          campaign.language || 'en',
          lead
        );

        if (!subject && !body) {
          skipped++;
          continue;
        }

        // LLM personalization (if enabled)
        let opener = '';
        let valueProp = '';
        if (campaign.llm_personalize) {
          const personalized = await personalizeWithLLM(lead, body);
          opener = personalized.opener;
          valueProp = personalized.valueProp;
        }

        // Create send record first (to get ID for tracking pixel)
        const sendResult = await query(
          `INSERT INTO gtm_email_sends (campaign_id, lead_id, template_id, touch_number, to_email, subject, body_html, personalized_opener, personalized_value_prop, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued') RETURNING id`,
          [campaignId, lead.id, campaign.template_id, 1, lead.email, subject, '', opener, valueProp]
        );
        const sendId = sendResult.rows[0].id;

        // Build final HTML with tracking pixel
        const finalHtml = buildEmailHTML(subject, body, opener, valueProp, sendId);

        // Update the body_html
        await query('UPDATE gtm_email_sends SET body_html = $1 WHERE id = $2', [finalHtml, sendId]);

        // Send the email
        const result = await sendCampaignEmail(sendId);

        if (result.success) {
          sent++;
        } else {
          failed++;
        }

        // Random delay between sends
        if (i + 1 < leadsToProcess.length) {
          await sleep(randomDelay());
        }
      } catch (err) {
        console.error(`[auto-email-worker] Error processing lead ${lead.id}:`, err.message);
        failed++;
      }
    }
  }

  // Update campaign status
  const finalStatus = sent + failed >= leadsToProcess.length ? 'completed' : 'paused';
  await query(
    "UPDATE gtm_email_campaigns SET status = $1, updated_at = NOW() WHERE id = $2",
    [finalStatus, campaignId]
  );

  // Log activity
  await query(
    'INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [campaign.created_by, 'System', 'system', `Auto Email campaign "${campaign.name}": ${sent} sent, ${failed} failed`, 'auto_email', 'campaign', campaignId]
  );

  return { sent, failed, skipped, total: leadsToProcess.length };
}

/**
 * Preview a personalized email for a specific lead (no sending)
 */
async function previewEmail(campaignId, leadId) {
  const campaign = await queryOne('SELECT * FROM gtm_email_campaigns WHERE id = $1', [campaignId]);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.template_id) throw new Error('No template assigned');

  const lead = await queryOne('SELECT * FROM gtm_leads WHERE id = $1', [leadId]);
  if (!lead) throw new Error('Lead not found');

  const { subject, body } = await resolveTemplate(
    campaign.template_id,
    campaign.language || 'en',
    lead
  );

  let opener = '';
  let valueProp = '';
  if (campaign.llm_personalize) {
    const personalized = await personalizeWithLLM(lead, body);
    opener = personalized.opener;
    valueProp = personalized.valueProp;
  }

  const html = buildEmailHTML(subject, body, opener, valueProp, 'preview');

  return {
    to: lead.email,
    subject,
    body,
    opener,
    valueProp,
    html,
    lead: {
      id: lead.id,
      company_name: lead.company_name,
      email: lead.email,
      sector: lead.sector,
      city: lead.city,
    },
  };
}

module.exports = { processCampaign, previewEmail };
