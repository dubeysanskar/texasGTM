const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET not set');
}
const _SECRET = JWT_SECRET || 'texasgtm-dev-fallback-change-me';
const JWT_EXPIRES = '7d';

function signToken(payload) {
  return jwt.sign(payload, _SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try { return jwt.verify(token, _SECRET); }
  catch { return null; }
}

function getUserFromRequest(request) {
  const cookie = request.cookies.get('gtm-token');
  if (!cookie) return null;
  return verifyToken(cookie.value);
}

function isAdmin(role) { return role === 'super_admin'; }
function isManager(role) { return ['super_admin', 'manager'].includes(role); }
function isStaff(role) { return ['super_admin', 'manager', 'staff', 'marketing'].includes(role); }

module.exports = { signToken, verifyToken, getUserFromRequest, isAdmin, isManager, isStaff };
