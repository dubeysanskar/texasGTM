/**
 * Mailer with Multi-SMTP Rotation
 * Rotates between multiple SMTP accounts to improve deliverability
 * and reduce spam risk. Each account has its own daily sending limit.
 */
const nodemailer = require('nodemailer');

// ─── SMTP Account Pool ─────────────────────────────────────────────────────

// ─── Env-based accounts (fallback when no DB accounts configured) ──────────
function getEnvAccounts() {
  const accounts = [];

  // Primary account (from .env)
  if (process.env.SMTP_USER) {
    accounts.push({
      id: 'env-primary',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      fromName: process.env.SMTP_FROM_NAME || 'TexasGTM',
      dailyLimit: parseInt(process.env.SMTP_DAILY_LIMIT || '30'),
    });
  }
  if (process.env.SMTP2_USER) {
    accounts.push({
      id: 'env-secondary',
      host: process.env.SMTP2_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP2_PORT || process.env.SMTP_PORT || '465'),
      secure: (process.env.SMTP2_SECURE || process.env.SMTP_SECURE || 'true') === 'true',
      user: process.env.SMTP2_USER,
      pass: process.env.SMTP2_PASSWORD,
      from: process.env.SMTP2_FROM || process.env.SMTP2_USER,
      fromName: process.env.SMTP2_FROM_NAME || 'TexasGTM',
      dailyLimit: parseInt(process.env.SMTP2_DAILY_LIMIT || '30'),
    });
  }
  if (process.env.SMTP3_USER) {
    accounts.push({
      id: 'env-tertiary',
      host: process.env.SMTP3_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP3_PORT || process.env.SMTP_PORT || '465'),
      secure: (process.env.SMTP3_SECURE || process.env.SMTP_SECURE || 'true') === 'true',
      user: process.env.SMTP3_USER,
      pass: process.env.SMTP3_PASSWORD,
      from: process.env.SMTP3_FROM || process.env.SMTP3_USER,
      fromName: process.env.SMTP3_FROM_NAME || 'TexasGTM',
      dailyLimit: parseInt(process.env.SMTP3_DAILY_LIMIT || '30'),
    });
  }

  return accounts;
}

/**
 * Load SMTP accounts for a given project from the database.
 * Priority: project-specific active accounts + global (project_id NULL) active accounts.
 * Falls back to env-configured accounts if the DB has none that apply.
 * @param {number|null} projectId
 * @returns {Promise<Array>}
 */
async function getSMTPAccounts(projectId = null) {
  try {
    const { queryAll } = require('@/lib/db');
    let rows;
    if (projectId) {
      rows = await queryAll(
        `SELECT * FROM gtm_smtp_accounts
         WHERE is_active = true AND (project_id = $1 OR project_id IS NULL)
         ORDER BY (project_id IS NULL) ASC, id ASC`,
        [projectId]
      );
    } else {
      rows = await queryAll(
        `SELECT * FROM gtm_smtp_accounts WHERE is_active = true ORDER BY id ASC`
      );
    }

    const dbAccounts = (rows || []).map(r => ({
      id: `db-${r.id}`,
      host: r.host,
      port: r.port,
      secure: r.secure,
      user: r.username,
      pass: r.password,
      from: r.from_email || r.username,
      fromName: r.from_name || 'TexasGTM',
      dailyLimit: r.daily_limit || 30,
    }));

    if (dbAccounts.length > 0) return dbAccounts;
  } catch (e) {
    console.error('[mailer] DB account load failed, using env fallback:', e.message);
  }

  return getEnvAccounts();
}

// ─── Transporter Pool ───────────────────────────────────────────────────────

const transporterPool = {};

// Key by credentials so an edited DB account (new password/host) rebuilds its transporter.
function transporterKey(account) {
  return `${account.host}:${account.port}:${account.secure}:${account.user}:${account.pass}`;
}

function getTransporter(account) {
  const key = transporterKey(account);
  if (!transporterPool[key]) {
    transporterPool[key] = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      rateDelta: 5000,  // 5 seconds between messages
      rateLimit: 1,     // 1 message per rateDelta
    });
  }
  return transporterPool[key];
}

// ─── Daily Send Counter (in-memory, resets on restart) ──────────────────────

const dailySendCounts = {};
let lastResetDate = new Date().toDateString();

function getDailySendCount(accountId) {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    // Reset all counters at midnight
    Object.keys(dailySendCounts).forEach(k => delete dailySendCounts[k]);
    lastResetDate = today;
  }
  return dailySendCounts[accountId] || 0;
}

function incrementDailySendCount(accountId) {
  dailySendCounts[accountId] = (dailySendCounts[accountId] || 0) + 1;
}

// ─── SMTP Rotation Logic ────────────────────────────────────────────────────

/**
 * Select the best SMTP account to use for the next send.
 * Strategy: Round-robin with daily limit enforcement.
 * Picks the account with the lowest daily send count that hasn't hit its limit.
 */
let rotationIndex = 0;

function selectAccount(accounts) {
  if (!accounts || accounts.length === 0) {
    throw new Error('No SMTP accounts configured for this project. Add one in Admin → Email / SMTP.');
  }

  // Filter to accounts under their daily limit
  const available = accounts.filter(a => getDailySendCount(a.id) < a.dailyLimit);

  if (available.length === 0) {
    // All accounts exhausted — find the one with most room
    const sorted = [...accounts].sort((a, b) => getDailySendCount(a.id) - getDailySendCount(b.id));
    console.warn(`[mailer] All SMTP accounts at daily limit. Using least-used: ${sorted[0].id}`);
    return sorted[0];
  }

  // Round-robin among available accounts
  rotationIndex = (rotationIndex + 1) % available.length;
  return available[rotationIndex];
}

/**
 * Get rotation status for all SMTP accounts (optionally scoped to a project)
 */
async function getRotationStatus(projectId = null) {
  const accounts = await getSMTPAccounts(projectId);
  return accounts.map(a => ({
    id: a.id,
    from: a.from,
    sentToday: getDailySendCount(a.id),
    dailyLimit: a.dailyLimit,
    remaining: Math.max(0, a.dailyLimit - getDailySendCount(a.id)),
    exhausted: getDailySendCount(a.id) >= a.dailyLimit,
  }));
}

/**
 * Get total remaining sends across all accounts (optionally scoped to a project)
 */
async function getTotalRemainingToday(projectId = null) {
  const accounts = await getSMTPAccounts(projectId);
  return accounts.reduce((sum, a) => sum + Math.max(0, a.dailyLimit - getDailySendCount(a.id)), 0);
}

// ─── Core Send Functions ────────────────────────────────────────────────────

/**
 * Send an email using SMTP rotation.
 * Automatically selects the best SMTP account for the given project.
 * @param {object} opts
 * @param {number|null} [opts.projectId] scope sending to this project's SMTP accounts
 */
async function sendMail({ to, subject, html, replyTo, projectId = null }) {
  const accounts = await getSMTPAccounts(projectId);
  const account = selectAccount(accounts);
  const transporter = getTransporter(account);

  const mailOptions = {
    from: `"${account.fromName}" <${account.from}>`,
    to,
    subject,
    html,
  };

  if (replyTo) mailOptions.replyTo = replyTo;

  // Add custom headers for deliverability
  mailOptions.headers = {
    'X-Mailer': 'TexasGTM',
    'List-Unsubscribe': `<mailto:unsubscribe@${account.from.split('@')[1]}>`,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    incrementDailySendCount(account.id);

    console.log(`[mailer] ✓ Sent via ${account.id} (${account.from}) | Today: ${getDailySendCount(account.id)}/${account.dailyLimit}`);

    return { ...result, smtpAccount: account.id, smtpFrom: account.from };
  } catch (err) {
    console.error(`[mailer] ✗ Failed via ${account.id} (${account.from}):`, err.message);
    throw err;
  }
}

/**
 * Send a one-off test email using an explicit account config (bypasses rotation/limits).
 * Used by the Admin "Test" button to verify SMTP credentials.
 */
async function sendTestMail(accountConfig, toEmail) {
  const account = {
    id: 'test',
    host: accountConfig.host,
    port: parseInt(accountConfig.port) || 465,
    secure: accountConfig.secure !== false && String(accountConfig.secure) !== 'false',
    user: accountConfig.username,
    pass: accountConfig.password,
    from: accountConfig.from_email || accountConfig.username,
    fromName: accountConfig.from_name || 'TexasGTM',
  };
  const transporter = getTransporter(account);
  const result = await transporter.sendMail({
    from: `"${account.fromName}" <${account.from}>`,
    to: toEmail,
    subject: 'TexasGTM — SMTP Test ✓',
    html: `<div style="font-family:Inter,sans-serif;padding:24px;">
      <h2 style="color:#6366f1;">SMTP test successful ✅</h2>
      <p>This confirms <strong>${account.from}</strong> (${account.host}:${account.port}) can send email from TexasGTM.</p>
    </div>`,
  });
  return { messageId: result.messageId, from: account.from };
}

/**
 * Send OTP verification email (always uses primary account)
 */
async function sendOTP(email, otp) {
  return sendMail({
    to: email,
    subject: 'TexasGTM — Your Verification Code',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f8f9fb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.5rem;color:#6366f1;margin:0;">TexasGTM</h1>
          <p style="color:#94a3b8;font-size:0.85rem;margin:4px 0 0;">Verification Code</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:1px solid #e2e8f0;">
          <p style="margin:0 0 16px;color:#475569;font-size:0.92rem;">Use this code to complete your verification:</p>
          <div style="font-size:2rem;font-weight:800;letter-spacing:8px;color:#6366f1;padding:16px;background:rgba(99,102,241,0.05);border-radius:10px;">${otp}</div>
          <p style="margin:16px 0 0;font-size:0.78rem;color:#94a3b8;">This code expires in 10 minutes.</p>
        </div>
        <p style="text-align:center;margin-top:16px;font-size:0.72rem;color:#94a3b8;">If you didn't request this, ignore this email.</p>
      </div>`,
  });
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email, resetUrl) {
  return sendMail({
    to: email,
    subject: 'TexasGTM — Reset Your Password',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f8f9fb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.5rem;color:#6366f1;margin:0;">TexasGTM</h1>
          <p style="color:#94a3b8;font-size:0.85rem;margin:4px 0 0;">Password Reset</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:1px solid #e2e8f0;">
          <p style="margin:0 0 20px;color:#475569;font-size:0.92rem;">Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:0.92rem;">Reset Password</a>
          <p style="margin:20px 0 0;font-size:0.78rem;color:#94a3b8;">This link expires in 1 hour.</p>
        </div>
        <p style="text-align:center;margin-top:16px;font-size:0.72rem;color:#94a3b8;">If you didn't request this, ignore this email.</p>
      </div>`,
  });
}

/**
 * Send invite / welcome email for a new account.
 * Used by all three user-creation paths: Team invite, Admin add-user, self signup.
 * @param {object} opts
 * @param {string} opts.email    recipient
 * @param {string} opts.name     user's display name
 * @param {string} opts.roleName human-readable role (e.g. "Staff")
 * @param {string[]} [opts.projectNames] projects the user was assigned to
 * @param {boolean} [opts.isWelcome]     true = self-signup welcome, false = invitation
 */
async function sendInvite({ email, name, roleName, projectNames = [], isWelcome = false }) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.APP_URL || 'https://gtm.tahaairwavescrm.cloud';
  const projectLine = projectNames.length
    ? `<p style="margin:0 0 20px;color:#475569;font-size:0.88rem;">Assigned project${projectNames.length > 1 ? 's' : ''}: <strong>${projectNames.join(', ')}</strong></p>`
    : '';
  return sendMail({
    to: email,
    subject: isWelcome ? 'TexasGTM — Welcome aboard!' : 'TexasGTM — You have been invited',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f8f9fb;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.5rem;color:#6366f1;margin:0;">TexasGTM</h1>
          <p style="color:#94a3b8;font-size:0.85rem;margin:4px 0 0;">${isWelcome ? 'Welcome' : 'Team Invitation'}</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#475569;font-size:0.92rem;">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 12px;color:#475569;font-size:0.88rem;">${isWelcome
            ? `Your <strong>TexasGTM CRM</strong> account has been created. Your role: <strong>${roleName}</strong>.`
            : `You've been invited to join <strong>TexasGTM CRM</strong> as <strong>${roleName}</strong>.`}</p>
          ${projectLine}
          <a href="${baseUrl}" style="display:inline-block;padding:12px 32px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:0.92rem;">Go to TexasGTM</a>
          <p style="margin:20px 0 0;font-size:0.78rem;color:#94a3b8;">${isWelcome
            ? 'Sign in with your email and password — you\'ll receive an OTP to verify each login.'
            : 'Just enter your email on the login page — you\'ll receive an OTP to sign in. Use "Forgot password" to set your own password.'}</p>
        </div>
      </div>`,
  });
}

module.exports = { sendMail, sendTestMail, sendOTP, sendPasswordReset, sendInvite, getSMTPAccounts, getRotationStatus, getTotalRemainingToday };
