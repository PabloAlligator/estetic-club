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
  const name = String(process.env.ADMIN_OWNER_NAME || '').trim();
  const email = String(process.env.ADMIN_OWNER_EMAIL || '')
    .trim()
    .toLowerCase();

  // Пароль намеренно не trim(), чтобы не изменять его значение.
  const password = String(process.env.ADMIN_OWNER_PASSWORD || '');

  if (!name || !email || !password) {
    throw new Error(
      'Заполни ADMIN_OWNER_NAME, ADMIN_OWNER_EMAIL и ADMIN_OWNER_PASSWORD в .env',
    );
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error('ADMIN_OWNER_EMAIL указан в неправильном формате');
  }

  if (password.length < 16) {
    throw new Error(
      'Пароль OWNER должен содержать минимум 16 символов',
    );
  }

  const existingOwner = await prisma.adminUser.findFirst({
    where: {
      role: 'OWNER',
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (existingOwner) {
    throw new Error(
      `OWNER уже существует: ${existingOwner.email}. Второй OWNER автоматически не создаётся.`,
    );
  }

  const existingUser = await prisma.adminUser.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  const owner = await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log('OWNER успешно создан:');
  console.log({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    role: owner.role,
  });
}

main()
  .catch((error) => {
    console.error('Не удалось создать OWNER:');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
