'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = global.__nadiaPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__nadiaPrisma = prisma;
}

module.exports = prisma;
