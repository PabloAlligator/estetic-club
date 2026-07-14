'use strict';

const { createHash, randomBytes } = require('node:crypto');

const prisma = require('../lib/prisma');
const {
  SESSION_TTL_MS,
} = require('../config/security');

const TOKEN_BYTES = 32;
const MAX_ACTIVE_SESSIONS = 5;

function generateToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function getRequestMetadata(req) {
  return {
    ipAddress: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 512),
  };
}

async function createAdminSession({ userId, req }) {
  const sessionToken = generateToken();
  const csrfToken = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const metadata = getRequestMetadata(req);

  const session = await prisma.$transaction(async (tx) => {
    await tx.adminSession.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    const overflowSessions = await tx.adminSession.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: MAX_ACTIVE_SESSIONS - 1,
      select: {
        id: true,
      },
    });

    if (overflowSessions.length > 0) {
      await tx.adminSession.deleteMany({
        where: {
          id: {
            in: overflowSessions.map((item) => item.id),
          },
        },
      });
    }

    return tx.adminSession.create({
      data: {
        userId,
        tokenHash: hashToken(sessionToken),
        csrfTokenHash: hashToken(csrfToken),
        expiresAt,
        lastUsedAt: now,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  });

  return {
    session,
    sessionToken,
    csrfToken,
  };
}

async function rotateCsrfToken(sessionId) {
  const csrfToken = generateToken();

  await prisma.adminSession.update({
    where: {
      id: sessionId,
    },
    data: {
      csrfTokenHash: hashToken(csrfToken),
    },
  });

  return csrfToken;
}

module.exports = {
  createAdminSession,
  rotateCsrfToken,
  hashToken,
  getRequestMetadata,
};
