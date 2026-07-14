'use strict';

const { timingSafeEqual } = require('node:crypto');
const { hashToken } = require('../services/session.service');

function safeHexEqual(firstHex, secondHex) {
  try {
    const first = Buffer.from(firstHex, 'hex');
    const second = Buffer.from(secondHex, 'hex');

    return (
      first.length === second.length &&
      first.length > 0 &&
      timingSafeEqual(first, second)
    );
  } catch {
    return false;
  }
}

function requireCsrf(req, res, next) {
  const csrfToken = String(req.get('x-csrf-token') || '');
  const expectedHash = String(req.auth?.session?.csrfTokenHash || '');

  if (
    !csrfToken ||
    csrfToken.length > 256 ||
    !safeHexEqual(hashToken(csrfToken), expectedHash)
  ) {
    return res.status(403).json({
      message: 'CSRF-проверка не пройдена',
    });
  }

  return next();
}

module.exports = requireCsrf;
