'use strict';

const { createHash, randomBytes } = require('node:crypto');
const express = require('express');
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/require-auth');
const requireCsrf = require('../middleware/require-csrf');
const validateOrigin = require('../middleware/validate-origin');
const {
  createAdminSession,
  rotateCsrfToken,
  getRequestMetadata,
} = require('../services/session.service');
const {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getSessionCookieClearOptions,
} = require('../config/security');

const router = express.Router();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const dummyPasswordHashPromise = argon2.hash(
  randomBytes(32).toString('hex'),
  ARGON2_OPTIONS,
);

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: 'Слишком много попыток входа. Повторите позже.',
  },
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.post('/login', loginLimiter, validateOrigin, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Проверьте email и пароль',
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.adminUser.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    const hashToVerify = user
      ? user.passwordHash
      : await dummyPasswordHashPromise;

    let passwordIsValid = false;

    try {
      passwordIsValid = await argon2.verify(hashToVerify, password);
    } catch {
      passwordIsValid = false;
    }

    if (!user || !user.isActive || !passwordIsValid) {
      const metadata = getRequestMetadata(req);
      const emailHash = createHash('sha256')
        .update(email, 'utf8')
        .digest('hex');

      await prisma.adminAuditLog.create({
        data: {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'AdminUser',
          entityId: '',
          details: JSON.stringify({
            emailHash,
          }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }).catch(() => undefined);

      return res.status(401).json({
        message: 'Неверный email или пароль',
      });
    }

    const { session, sessionToken, csrfToken } =
      await createAdminSession({
        userId: user.id,
        req,
      });

    const metadata = getRequestMetadata(req);

    await prisma.$transaction([
      prisma.adminUser.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          action: 'ADMIN_LOGIN_SUCCESS',
          entityType: 'AdminUser',
          entityId: String(user.id),
          details: '{}',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    res.cookie(
      SESSION_COOKIE_NAME,
      sessionToken,
      getSessionCookieOptions(),
    );

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      csrfToken,
      sessionExpiresAt: session.expiresAt,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: req.auth.user,
    sessionExpiresAt: req.auth.session.expiresAt,
  });
});

router.get('/csrf', requireAuth, async (req, res, next) => {
  try {
    const csrfToken = await rotateCsrfToken(req.auth.session.id);

    return res.json({
      csrfToken,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/logout',
  validateOrigin,
  requireAuth,
  requireCsrf,
  async (req, res, next) => {
    try {
      const metadata = getRequestMetadata(req);

      await prisma.$transaction([
        prisma.adminSession.delete({
          where: {
            id: req.auth.session.id,
          },
        }),
        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,
            action: 'ADMIN_LOGOUT',
            entityType: 'AdminUser',
            entityId: String(req.auth.user.id),
            details: '{}',
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        }),
      ]);

      res.clearCookie(
        SESSION_COOKIE_NAME,
        getSessionCookieClearOptions(),
      );

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
