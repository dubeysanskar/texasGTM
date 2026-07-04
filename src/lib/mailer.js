/**
 * Mailer with Multi-SMTP Rotation
 * Rotates between multiple SMTP accounts to improve deliverability
 * and reduce spam risk. Each account has its own daily sending limit.
 */
const nodemailer = require('nodemailer');

// ─── SMTP Account Pool ─────────────────────────────────────────────────────

function getSMTPAccounts() {
  const accounts = [];

  // Primary account (from .env)
  if (process.env.SMTP_USER) {
    accounts.push({
      id: 'primary',
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

  // Secondary account (SMTP2_*)
  if (process.env.SMTP2_USER) {
    accounts.push({
      id: 'secondary',
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

  // Tertiary account (SMTP3_*)
  if (process.env.SMTP3_USER) {
    accounts.push({
      id: 'tertiary',
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

// ─── Transporter Pool ───────────────────────────────────────────────────────

const transporterPool = {};

function getTransporter(account) {
  if (!transporterPool[account.id]) {
    transporterPool[account.id] = nodemailer.createTransport({
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
  return transporterPool[account.id];
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

function selectAccount() {
  const accounts = getSMTPAccounts();
  if (accounts.length === 0) {
    throw new Error('No SMTP accounts configured. Set SMTP_USER in .env');
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
 * Get rotation status for all SMTP accounts
 */
function getRotationStatus() {
  const accounts = getSMTPAccounts();
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
 * Get total remaining sends across all accounts
 */
function getTotalRemainingToday() {
  const accounts = getSMTPAccounts();
  return accounts.reduce((sum, a) => sum + Math.max(0, a.dailyLimit - getDailySendCount(a.id)), 0);
}

// ─── Core Send Functions ────────────────────────────────────────────────────

/**
 * Send an email using SMTP rotation
 * Automatically selects the best SMTP account
 */
async function sendMail({ to, subject, html, replyTo }) {
  const account = selectAccount();
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

    const status = getRotationStatus();
    console.log(`[mailer] ✓ Sent via ${account.id} (${account.from}) | Today: ${getDailySendCount(account.id)}/${account.dailyLimit} | Total remaining: ${getTotalRemainingToday()}`);

    return { ...result, smtpAccount: account.id, smtpFrom: account.from };
  } catch (err) {
    console.error(`[mailer] ✗ Failed via ${account.id} (${account.from}):`, err.message);
    throw err;
  }
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

module.exports = { sendMail, sendOTP, sendPasswordReset, getRotationStatus, getTotalRemainingToday };
