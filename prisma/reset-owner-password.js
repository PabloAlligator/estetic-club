'use strict';

require('dotenv').config();

const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function main() {
  const email = String(process.env.ADMIN_OWNER_EMAIL || '')
    .trim()
    .toLowerCase();

  // Не используем trim(), чтобы случайно не изменить пароль.
  const password = String(process.env.ADMIN_OWNER_PASSWORD || '');

  if (!email || !password) {
    throw new Error(
      'Заполни ADMIN_OWNER_EMAIL и ADMIN_OWNER_PASSWORD в .env',
    );
  }

  const passwordLength = Array.from(password).length;

  if (passwordLength < 16) {
    throw new Error(
      'Новый пароль OWNER должен содержать минимум 16 символов',
    );
  }

  if (passwordLength > 128) {
    throw new Error(
      'Новый пароль OWNER не должен превышать 128 символов',
    );
  }

  const owner = await prisma.adminUser.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!owner) {
    throw new Error('Пользователь с таким email не найден');
  }

  if (owner.role !== 'OWNER') {
    throw new Error('Указанный пользователь не является OWNER');
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  await prisma.$transaction([
    prisma.adminUser.update({
      where: {
        id: owner.id,
      },
      data: {
        passwordHash,
        isActive: true,
      },
    }),

    // После смены пароля завершаем все существующие сессии.
    prisma.adminSession.deleteMany({
      where: {
        userId: owner.id,
      },
    }),

    prisma.adminAuditLog.create({
      data: {
        userId: owner.id,
        action: 'OWNER_PASSWORD_RESET_LOCAL',
        entityType: 'AdminUser',
        entityId: String(owner.id),
        details: '{}',
      },
    }),
  ]);

  console.log(`Пароль OWNER успешно обновлён: ${owner.email}`);
  console.log('Все существующие сессии OWNER завершены.');
}

main()
  .catch((error) => {
    console.error('Не удалось обновить пароль OWNER:');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
