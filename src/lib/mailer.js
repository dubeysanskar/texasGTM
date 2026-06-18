const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  return t.sendMail({
    from: `"TexasGTM" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to, subject, html,
  });
}

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

module.exports = { sendMail, sendOTP, sendPasswordReset };
