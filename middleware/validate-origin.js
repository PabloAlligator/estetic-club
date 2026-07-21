'use strict';

function buildAllowedOrigins() {
  const origins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  const configuredOrigins = [
    ...String(process.env.APP_ORIGIN || '').split(','),
    String(process.env.SITE_URL || ''),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of configuredOrigins) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Некорректное значение не добавляем в белый список.
    }
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

function validateOrigin(req, res, next) {
  const origin = String(req.get('origin') || '');

  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({
      message: 'Недопустимый источник запроса',
    });
  }

  return next();
}

module.exports = validateOrigin;
