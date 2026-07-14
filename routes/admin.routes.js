'use strict';

const path = require('path');
const fs = require('node:fs/promises');
const express = require('express');
const argon2 = require('argon2');
const { z } = require('zod');

const prisma = require('../lib/prisma');

const requireAuth = require('../middleware/require-auth');
const requireRole = require('../middleware/require-role');
const requireCsrf = require('../middleware/require-csrf');
const validateOrigin = require('../middleware/validate-origin');

const { getRequestMetadata } = require('../services/session.service');

const { SESSION_IDLE_TIMEOUT_MS } = require('../config/security');

const router = express.Router();

const ADMIN_PAGES_DIR = path.join(__dirname, '..', 'admin-pages');

const WORK_UPLOADS_DIR = path.join(
  __dirname,
  '..',
  'site',
  'uploads',
  'works',
);

const WORK_UPLOADS_URL = '/site/uploads/works';

const MAX_WORK_GALLERY_IMAGES = 30;

const LEAD_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const KRASNOYARSK_OFFSET_MS = 7 * 60 * 60 * 1000;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const WORK_CATEGORY_SLUGS = [
  'airtouch',
  'total-blond',
  'shatush',
  'toning',
  'gray-hair',
  'recovery',
  'care',
  'reconstruction',
];

const WORK_CATEGORIES = {
  airtouch: 'Аиртач',
  'total-blond': 'Тотал блонд',
  shatush: 'Шатуш',
  toning: 'Тонирование',
  'gray-hair': 'Работа с сединой',
  recovery: 'Восстановление',
  care: 'Уход',
  reconstruction: 'Реконструкция',
};

const leadSelect = {
  id: true,
  name: true,
  phone: true,
  service: true,
  message: true,
  status: true,
  internalComment: true,
  source: true,
  consentAccepted: true,
  consentAcceptedAt: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,

  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const dashboardLeadSelect = {
  id: true,
  name: true,
  phone: true,
  service: true,
  status: true,
  createdAt: true,

  assignedTo: {
    select: {
      name: true,
    },
  },
};

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

// параметры списка заявок

const leadDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateString)
  .optional()
  .default('');

const leadListQuerySchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),

    search: z.string().trim().max(100).optional().default(''),

    dateFrom: leadDateSchema,

    dateTo: leadDateSchema,

    page: z.coerce.number().int().min(1).max(100000).optional().default(1),

    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateTo'],
        message: 'Конечная дата не может быть раньше начальной',
      });
    }
  });

// id заявки

const leadIdSchema = z.coerce.number().int().positive();

// изменение заявки

const updateLeadSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),

    internalComment: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine(
    (data) => data.status !== undefined || data.internalComment !== undefined,
    {
      message: 'Не переданы данные для обновления заявки',
    },
  );

// сотрудники

const staffIdSchema = z.coerce.number().int().positive();

const createStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(80),

    email: z.string().trim().toLowerCase().email().max(254),

    password: z
      .string()
      .min(10)
      .max(128)
      .refine((value) => value.trim().length >= 10),
  })
  .strict();

const updateStaffStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const resetStaffPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10)
      .max(128)
      .refine((value) => value.trim().length >= 10),
  })
  .strict();

// работы

const workIdSchema = z.coerce.number().int().positive();

const workImageIdSchema = z.coerce.number().int().positive();

const workImagePayloadSchema = z
  .object({
    imagePath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(isManagedWorkImagePath, {
        message: 'Некорректный путь изображения',
      }),

    alt: z.string().trim().max(180).optional().default(''),
  })
  .strict();

const workListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional().default(''),

    status: z.enum(['all', 'published', 'draft']).optional().default('all'),

    category: z.enum(WORK_CATEGORY_SLUGS).optional(),

    page: z.coerce.number().int().min(1).max(100000).optional().default(1),

    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

const workPublishSchema = z
  .object({
    isPublished: z.boolean(),
  })
  .strict();

const workHomeSchema = z
  .object({
    showOnHome: z.boolean(),
  })
  .strict();

const workDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateString);

const workPayloadSchema = z
  .object({
    title: z.string().trim().min(2).max(160),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

    excerpt: z.string().trim().max(600).optional().default(''),

    categorySlug: z.enum(WORK_CATEGORY_SLUGS),

    technique: z.string().trim().max(120).optional().default(''),

    duration: z.string().trim().max(80).optional().default(''),

    beforeImage: z.string().trim().max(500).optional().default(''),

    afterImage: z.string().trim().max(500).optional().default(''),

    heroImage: z.string().trim().max(500).optional().default(''),

    experienceImage: z.string().trim().max(500).optional().default(''),

    heroQuote: z.string().trim().max(500).optional().default(''),

    story: z.string().trim().max(10000).optional().default(''),

    workDate: workDateSchema,

    isPublished: z.boolean().optional().default(false),

    showOnHome: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.showOnHome && !data.isPublished) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['showOnHome'],
        message: 'Черновик нельзя вывести на главную страницу',
      });
    }

    if (data.isPublished && !data.beforeImage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['beforeImage'],
        message: 'Для публикации загрузите фотографию до',
      });
    }

    if (data.isPublished && !data.afterImage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['afterImage'],
        message: 'Для публикации загрузите фотографию после',
      });
    }
  });

const adminWorkListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,

  category: true,
  categorySlug: true,

  beforeImage: true,
  afterImage: true,

  technique: true,
  duration: true,

  isPublished: true,
  showOnHome: true,

  createdAt: true,
  updatedAt: true,

  _count: {
    select: {
      images: true,
    },
  },
};

const adminWorkDetailSelect = {
  ...adminWorkListSelect,

  heroImage: true,
  experienceImage: true,
  heroQuote: true,
  story: true,
  gallery: true,

  images: {
    orderBy: [
      {
        sortOrder: 'asc',
      },
      {
        id: 'asc',
      },
    ],

    select: {
      id: true,
      imagePath: true,
      alt: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

function sendAdminPage(fileName) {
  return function adminPageHandler(req, res) {
    return res.sendFile(path.join(ADMIN_PAGES_DIR, fileName));
  };
}

function createLeadCounts(groupedStatuses) {
  const counts = {
    all: 0,
    NEW: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  for (const item of groupedStatuses) {
    const count = item._count?._all || 0;

    counts[item.status] = count;
    counts.all += count;
  }

  return counts;
}

function isValidDateString(value) {
  const [year, month, day] = value.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function createKrasnoyarskDayStart(value) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day) - KRASNOYARSK_OFFSET_MS);
}

function createKrasnoyarskNextDayStart(value) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1) - KRASNOYARSK_OFFSET_MS);
}

function createKrasnoyarskWorkDate(value) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

function formatKrasnoyarskDateInput(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() + KRASNOYARSK_OFFSET_MS);

  const year = localDate.getUTCFullYear();

  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');

  const day = String(localDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseWorkGallery(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isManagedWorkImagePath(imagePath) {
  const value = String(imagePath || '').trim();

  const fileName = path.posix.basename(value);

  const expectedPath = `${WORK_UPLOADS_URL}/${fileName}`;

  return (
    value === expectedPath &&
    /^\d{13}-[a-f0-9]{24}\.webp$/.test(fileName)
  );
}

async function removeManagedWorkImage(imagePath) {
  if (!isManagedWorkImagePath(imagePath)) {
    return;
  }

  const fileName = path.posix.basename(imagePath);

  const absolutePath = path.join(
    WORK_UPLOADS_DIR,
    fileName,
  );

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function createAdminWorkResponse(work) {
  const relationGallery = Array.isArray(work.images)
    ? work.images.map((image) => image.imagePath).filter(Boolean)
    : [];

  const gallery = relationGallery.length
    ? relationGallery
    : parseWorkGallery(work.gallery);

  return {
    ...work,

    gallery,

    workDate: formatKrasnoyarskDateInput(work.createdAt),
  };
}

function createWorkWriteData(data) {
  return {
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,

    category:
      WORK_CATEGORIES[data.categorySlug],

    categorySlug: data.categorySlug,

    beforeImage: data.beforeImage,

    afterImage: data.afterImage,

    technique:
      data.technique ||
      WORK_CATEGORIES[data.categorySlug],

    duration: data.duration,

    heroImage: data.heroImage,

    experienceImage:
      data.experienceImage,

    heroQuote: data.heroQuote,

    story: data.story,

    isPublished: data.isPublished,

    showOnHome:
      data.isPublished &&
      data.showOnHome,

    createdAt:
      createKrasnoyarskWorkDate(
        data.workDate,
      ),
  };
}

function getChangedWorkFields(currentWork, nextData) {
  const changedFields = [];

  for (const [field, nextValue] of Object.entries(nextData)) {
    const currentValue = currentWork[field];

    if (currentValue instanceof Date && nextValue instanceof Date) {
      if (currentValue.getTime() !== nextValue.getTime()) {
        changedFields.push(field);
      }

      continue;
    }

    if (currentValue !== nextValue) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

function createStaffResponse(user, now = new Date()) {
  const sessions = Array.isArray(user.sessions) ? user.sessions : [];

  const nowTime = now.getTime();

  const activeSessions = sessions.filter((session) => {
    const absoluteActive = session.expiresAt.getTime() > nowTime;

    const idleActive =
      session.lastUsedAt.getTime() + SESSION_IDLE_TIMEOUT_MS > nowTime;

    return absoluteActive && idleActive;
  }).length;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,

    isOnline: activeSessions > 0,

    activeSessions,

    lastLoginAt: user.lastLoginAt,

    lastActivityAt: sessions[0]?.lastUsedAt || user.lastLoginAt || null,

    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getStaffTargetError(target, currentUserId) {
  if (!target) {
    return {
      status: 404,
      message: 'Сотрудник не найден',
    };
  }

  if (target.id === currentUserId) {
    return {
      status: 403,
      message: 'Нельзя изменить собственную учётную запись OWNER',
    };
  }

  if (target.role !== 'STAFF') {
    return {
      status: 403,
      message: 'Управление учётными записями OWNER запрещено',
    };
  }

  return null;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

// запрещаем кэширование админки

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, private');

  res.set('Pragma', 'no-cache');

  res.set('Expires', '0');

  next();
});

// dashboard

router.get(
  '/api/dashboard',
  requireAuth,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const [
        groupedStatuses,
        latestLeads,
        publishedWorks,
        articles,
        activeStaff,
      ] = await prisma.$transaction([
        prisma.lead.groupBy({
          by: ['status'],

          _count: {
            _all: true,
          },
        }),

        prisma.lead.findMany({
          orderBy: [
            {
              createdAt: 'desc',
            },
            {
              id: 'desc',
            },
          ],

          take: 5,

          select: dashboardLeadSelect,
        }),

        prisma.work.count({
          where: {
            isPublished: true,
          },
        }),

        prisma.blogPost.count(),

        prisma.adminUser.count({
          where: {
            role: 'STAFF',
            isActive: true,
          },
        }),
      ]);

      return res.json({
        leads: createLeadCounts(groupedStatuses),

        latestLeads,

        content: {
          publishedWorks,
          articles,
          activeStaff,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

// получение заявок

router.get(
  '/api/leads',
  requireAuth,
  requireRole('OWNER', 'STAFF'),
  async (req, res, next) => {
    try {
      const parsed = leadListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'Некорректные параметры списка заявок',
        });
      }

      const { status, search, dateFrom, dateTo, page, limit } = parsed.data;

      const where = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
            },
          },
          {
            phone: {
              contains: search,
            },
          },
          {
            service: {
              contains: search,
            },
          },
          {
            message: {
              contains: search,
            },
          },
        ];
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};

        if (dateFrom) {
          where.createdAt.gte = createKrasnoyarskDayStart(dateFrom);
        }

        if (dateTo) {
          where.createdAt.lt = createKrasnoyarskNextDayStart(dateTo);
        }
      }

      const skip = (page - 1) * limit;

      const [leads, total, groupedStatuses] = await prisma.$transaction([
        prisma.lead.findMany({
          where,

          orderBy: [
            {
              createdAt: 'desc',
            },
            {
              id: 'desc',
            },
          ],

          skip,
          take: limit,

          select: leadSelect,
        }),

        prisma.lead.count({
          where,
        }),

        prisma.lead.groupBy({
          by: ['status'],

          _count: {
            _all: true,
          },
        }),
      ]);

      return res.json({
        leads,

        counts: createLeadCounts(groupedStatuses),

        pagination: {
          page,
          limit,
          total,

          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

// изменение заявки

router.patch(
  '/api/leads/:id',
  validateOrigin,
  requireAuth,
  requireRole('OWNER', 'STAFF'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = leadIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID заявки',
        });
      }

      const parsedBody = updateLeadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({
          message: 'Проверьте данные для обновления заявки',
        });
      }

      const leadId = parsedId.data;

      const currentLead = await prisma.lead.findUnique({
        where: {
          id: leadId,
        },

        select: {
          id: true,
          status: true,

          internalComment: true,

          assignedToId: true,
        },
      });

      if (!currentLead) {
        return res.status(404).json({
          message: 'Заявка не найдена',
        });
      }

      const updateData = {};

      if (parsedBody.data.status !== undefined) {
        updateData.status = parsedBody.data.status;
      }

      if (parsedBody.data.internalComment !== undefined) {
        updateData.internalComment = parsedBody.data.internalComment;
      }

      // назначаем заявку сотруднику

      if (
        parsedBody.data.status === 'IN_PROGRESS' &&
        !currentLead.assignedToId
      ) {
        updateData.assignedToId = req.auth.user.id;
      }

      const metadata = getRequestMetadata(req);

      const auditDetails = {
        statusChanged:
          parsedBody.data.status !== undefined &&
          parsedBody.data.status !== currentLead.status,

        previousStatus: currentLead.status,

        nextStatus: parsedBody.data.status || currentLead.status,

        internalCommentChanged:
          parsedBody.data.internalComment !== undefined &&
          parsedBody.data.internalComment !== currentLead.internalComment,

        assignedToCurrentUser: updateData.assignedToId === req.auth.user.id,
      };

      const [updatedLead] = await prisma.$transaction([
        prisma.lead.update({
          where: {
            id: leadId,
          },

          data: updateData,

          select: leadSelect,
        }),

        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'LEAD_UPDATED',

            entityType: 'Lead',

            entityId: String(leadId),

            details: JSON.stringify(auditDetails),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        }),
      ]);

      return res.json({
        lead: updatedLead,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// удаление заявки

router.delete(
  '/api/leads/:id',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = leadIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID заявки',
        });
      }

      const leadId = parsedId.data;

      const lead = await prisma.lead.findUnique({
        where: {
          id: leadId,
        },

        select: {
          id: true,
          status: true,
          service: true,
          source: true,

          assignedToId: true,

          createdAt: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          message: 'Заявка не найдена',
        });
      }

      const metadata = getRequestMetadata(req);

      await prisma.$transaction([
        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'LEAD_DELETED',

            entityType: 'Lead',

            entityId: String(lead.id),

            details: JSON.stringify({
              status: lead.status,

              service: lead.service,

              source: lead.source,

              assignedToId: lead.assignedToId,

              createdAt: lead.createdAt.toISOString(),
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        }),

        prisma.lead.delete({
          where: {
            id: leadId,
          },
        }),
      ]);

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

// список работ

router.get(
  '/api/works',
  requireAuth,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const parsed = workListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'Некорректные параметры списка работ',
        });
      }

      const { search, status, category, page, limit } = parsed.data;

      const where = {};

      if (status === 'published') {
        where.isPublished = true;
      }

      if (status === 'draft') {
        where.isPublished = false;
      }

      if (category) {
        where.categorySlug = category;
      }

      if (search) {
        where.OR = [
          {
            title: {
              contains: search,
            },
          },
          {
            slug: {
              contains: search,
            },
          },
          {
            excerpt: {
              contains: search,
            },
          },
          {
            category: {
              contains: search,
            },
          },
          {
            technique: {
              contains: search,
            },
          },
        ];
      }

      const skip = (page - 1) * limit;

      const [works, total, all, published, drafts, onHome] =
        await prisma.$transaction([
          prisma.work.findMany({
            where,

            orderBy: [
              {
                createdAt: 'desc',
              },
              {
                id: 'desc',
              },
            ],

            skip,
            take: limit,

            select: adminWorkListSelect,
          }),

          prisma.work.count({
            where,
          }),

          prisma.work.count(),

          prisma.work.count({
            where: {
              isPublished: true,
            },
          }),

          prisma.work.count({
            where: {
              isPublished: false,
            },
          }),

          prisma.work.count({
            where: {
              showOnHome: true,
            },
          }),
        ]);

      return res.json({
        works,

        counts: {
          all,
          published,
          drafts,
          onHome,
        },

        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

// получение работы

router.get(
  '/api/works/:id',
  requireAuth,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID работы',
        });
      }

      const work = await prisma.work.findUnique({
        where: {
          id: parsedId.data,
        },

        select: adminWorkDetailSelect,
      });

      if (!work) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      return res.json({
        work: createAdminWorkResponse(work),
      });
    } catch (error) {
      return next(error);
    }
  },
);

// создание работы

router.post(
  '/api/works',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsed = workPayloadSchema.safeParse(req.body);

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];

        return res.status(400).json({
          message: firstIssue?.message || 'Проверьте данные работы',
        });
      }

      const workData = createWorkWriteData(parsed.data);

      const metadata = getRequestMetadata(req);

      const work = await prisma.$transaction(async (tx) => {
        const createdWork = await tx.work.create({
          data: {
            ...workData,

            gallery: '[]',
          },

          select: adminWorkDetailSelect,
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'WORK_CREATED',

            entityType: 'Work',

            entityId: String(createdWork.id),

            details: JSON.stringify({
              slug: createdWork.slug,

              title: createdWork.title,

              categorySlug: createdWork.categorySlug,

              isPublished: createdWork.isPublished,

              showOnHome: createdWork.showOnHome,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return createdWork;
      });

      return res.status(201).json({
        work: createAdminWorkResponse(work),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({
          message: 'Работа с таким адресом уже существует',
        });
      }

      return next(error);
    }
  },
);

// редактирование работы

router.patch(
  '/api/works/:id',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID работы',
        });
      }

      const parsedBody = workPayloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        const firstIssue = parsedBody.error.issues[0];

        return res.status(400).json({
          message: firstIssue?.message || 'Проверьте данные работы',
        });
      }

      const workId = parsedId.data;

      const currentWork = await prisma.work.findUnique({
        where: {
          id: workId,
        },

        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          categorySlug: true,
          beforeImage: true,
          afterImage: true,
          technique: true,
          duration: true,
          heroImage: true,
          experienceImage: true,
          heroQuote: true,
          story: true,
          isPublished: true,
          showOnHome: true,
          createdAt: true,
        },
      });

      if (!currentWork) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      const workData = createWorkWriteData(parsedBody.data);

      const changedFields = getChangedWorkFields(currentWork, workData);

      const metadata = getRequestMetadata(req);

      const [updatedWork] = await prisma.$transaction([
        prisma.work.update({
          where: {
            id: workId,
          },

          data: workData,

          select: adminWorkDetailSelect,
        }),

        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'WORK_UPDATED',

            entityType: 'Work',

            entityId: String(workId),

            details: JSON.stringify({
              previousSlug: currentWork.slug,

              nextSlug: workData.slug,

              title: workData.title,

              changedFields,

              isPublished: workData.isPublished,

              showOnHome: workData.showOnHome,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        }),
      ]);

      return res.json({
        work: createAdminWorkResponse(updatedWork),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({
          message: 'Работа с таким адресом уже существует',
        });
      }

      return next(error);
    }
  },
);

// добавление фото в галерею

router.post(
  '/api/works/:id/images',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      const parsedBody = workImagePayloadSchema.safeParse(req.body);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID работы',
        });
      }

      if (!parsedBody.success) {
        const firstIssue = parsedBody.error.issues[0];

        return res.status(400).json({
          message:
            firstIssue?.message ||
            'Некорректные данные фотографии',
        });
      }

      const workId = parsedId.data;

      const work = await prisma.work.findUnique({
        where: {
          id: workId,
        },

        select: {
          id: true,
          slug: true,
          title: true,
          gallery: true,

          images: {
            orderBy: [
              {
                sortOrder: 'asc',
              },
              {
                id: 'asc',
              },
            ],

            select: {
              id: true,
              imagePath: true,
              sortOrder: true,
            },
          },
        },
      });

      if (!work) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      const legacyGallery = work.images.length
        ? []
        : parseWorkGallery(work.gallery);

      const currentImageCount =
        work.images.length || legacyGallery.length;

      if (currentImageCount >= MAX_WORK_GALLERY_IMAGES) {
        return res.status(409).json({
          message: `В галерее может быть не больше ${MAX_WORK_GALLERY_IMAGES} фотографий`,
        });
      }

      const metadata = getRequestMetadata(req);

      const createdImage = await prisma.$transaction(
        async (tx) => {
          let nextSortOrder = 0;

          if (!work.images.length && legacyGallery.length) {
            for (let index = 0; index < legacyGallery.length; index += 1) {
              await tx.workImage.create({
                data: {
                  workId,
                  imagePath: legacyGallery[index],
                  alt: `${work.title} — фото ${index + 1}`,
                  sortOrder: index,
                },
              });
            }

            nextSortOrder = legacyGallery.length;
          } else if (work.images.length) {
            nextSortOrder =
              Math.max(
                ...work.images.map((image) => image.sortOrder),
              ) + 1;
          }

          await tx.work.update({
            where: {
              id: workId,
            },

            data: {
              gallery: '[]',
            },
          });

          const image = await tx.workImage.create({
            data: {
              workId,

              imagePath: parsedBody.data.imagePath,

              alt:
                parsedBody.data.alt ||
                `${work.title} — фото галереи`,

              sortOrder: nextSortOrder,
            },

            select: {
              id: true,
              imagePath: true,
              alt: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          await tx.adminAuditLog.create({
            data: {
              userId: req.auth.user.id,

              action: 'WORK_IMAGE_CREATED',

              entityType: 'WorkImage',

              entityId: String(image.id),

              details: JSON.stringify({
                workId,
                workSlug: work.slug,
                imagePath: image.imagePath,
                sortOrder: image.sortOrder,
              }),

              ipAddress: metadata.ipAddress,
              userAgent: metadata.userAgent,
            },
          });

          return image;
        },
      );

      return res.status(201).json({
        image: createdImage,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// удаление фото из галереи

router.delete(
  '/api/works/:id/images/:imageId',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedWorkId = workIdSchema.safeParse(req.params.id);

      const parsedImageId = workImageIdSchema.safeParse(
        req.params.imageId,
      );

      if (!parsedWorkId.success || !parsedImageId.success) {
        return res.status(400).json({
          message: 'Некорректный ID фотографии',
        });
      }

      const workId = parsedWorkId.data;

      const imageId = parsedImageId.data;

      const image = await prisma.workImage.findFirst({
        where: {
          id: imageId,
          workId,
        },

        select: {
          id: true,
          imagePath: true,
          sortOrder: true,

          work: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
      });

      if (!image) {
        return res.status(404).json({
          message: 'Фотография не найдена',
        });
      }

      const metadata = getRequestMetadata(req);

      await prisma.$transaction(async (tx) => {
        await tx.workImage.delete({
          where: {
            id: imageId,
          },
        });

        await tx.workImage.updateMany({
          where: {
            workId,

            sortOrder: {
              gt: image.sortOrder,
            },
          },

          data: {
            sortOrder: {
              decrement: 1,
            },
          },
        });

        await tx.work.update({
          where: {
            id: workId,
          },

          data: {
            gallery: '[]',
          },
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'WORK_IMAGE_DELETED',

            entityType: 'WorkImage',

            entityId: String(image.id),

            details: JSON.stringify({
              workId,
              workSlug: image.work.slug,
              imagePath: image.imagePath,
              sortOrder: image.sortOrder,
            }),

            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        });
      });

      await removeManagedWorkImage(image.imagePath).catch((error) => {
        console.error(
          'Не удалось удалить файл фотографии галереи:',
          error,
        );
      });

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

// публикация работы

router.patch(
  '/api/works/:id/publish',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      const parsedBody = workPublishSchema.safeParse(req.body);

      if (!parsedId.success || !parsedBody.success) {
        return res.status(400).json({
          message: 'Некорректные данные публикации',
        });
      }

      const workId = parsedId.data;
      const { isPublished } = parsedBody.data;

      const currentWork = await prisma.work.findUnique({
        where: {
          id: workId,
        },

        select: {
          id: true,
          slug: true,
          title: true,
          isPublished: true,
          showOnHome: true,
        },
      });

      if (!currentWork) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      const metadata = getRequestMetadata(req);

      const [work] = await prisma.$transaction([
        prisma.work.update({
          where: {
            id: workId,
          },

          data: {
            isPublished,

            showOnHome: isPublished ? currentWork.showOnHome : false,
          },

          select: adminWorkListSelect,
        }),

        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: isPublished ? 'WORK_PUBLISHED' : 'WORK_UNPUBLISHED',

            entityType: 'Work',
            entityId: String(workId),

            details: JSON.stringify({
              slug: currentWork.slug,
              title: currentWork.title,

              previousIsPublished: currentWork.isPublished,
              nextIsPublished: isPublished,

              removedFromHome: !isPublished && currentWork.showOnHome,
            }),

            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        }),
      ]);

      return res.json({
        work,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// работа на главной

router.patch(
  '/api/works/:id/home',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      const parsedBody = workHomeSchema.safeParse(req.body);

      if (!parsedId.success || !parsedBody.success) {
        return res.status(400).json({
          message: 'Некорректные данные главной страницы',
        });
      }

      const workId = parsedId.data;
      const { showOnHome } = parsedBody.data;

      const currentWork = await prisma.work.findUnique({
        where: {
          id: workId,
        },

        select: {
          id: true,
          slug: true,
          title: true,
          isPublished: true,
          showOnHome: true,
        },
      });

      if (!currentWork) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      if (showOnHome && !currentWork.isPublished) {
        return res.status(409).json({
          message: 'Сначала опубликуйте работу',
        });
      }

      const metadata = getRequestMetadata(req);

      const [work] = await prisma.$transaction([
        prisma.work.update({
          where: {
            id: workId,
          },

          data: {
            showOnHome,
          },

          select: adminWorkListSelect,
        }),

        prisma.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: showOnHome
              ? 'WORK_ADDED_TO_HOME'
              : 'WORK_REMOVED_FROM_HOME',

            entityType: 'Work',
            entityId: String(workId),

            details: JSON.stringify({
              slug: currentWork.slug,
              title: currentWork.title,

              previousShowOnHome: currentWork.showOnHome,
              nextShowOnHome: showOnHome,
            }),

            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        }),
      ]);

      return res.json({
        work,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// удаление работы

router.delete(
  '/api/works/:id',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = workIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID работы',
        });
      }

      const workId = parsedId.data;
      const metadata = getRequestMetadata(req);

      const result = await prisma.$transaction(async (tx) => {
        const work = await tx.work.findUnique({
          where: {
            id: workId,
          },

          select: {
            id: true,
            slug: true,
            title: true,
            categorySlug: true,
            isPublished: true,
            showOnHome: true,

            images: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!work) {
          return null;
        }

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'WORK_DELETED',

            entityType: 'Work',
            entityId: String(workId),

            details: JSON.stringify({
              slug: work.slug,
              title: work.title,
              categorySlug: work.categorySlug,

              isPublished: work.isPublished,
              showOnHome: work.showOnHome,

              galleryImages: work.images.length,
            }),

            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        });

        await tx.work.delete({
          where: {
            id: workId,
          },
        });

        return work;
      });

      if (!result) {
        return res.status(404).json({
          message: 'Работа не найдена',
        });
      }

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

// список сотрудников

router.get(
  '/api/staff',
  requireAuth,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const now = new Date();

      const users = await prisma.adminUser.findMany({
        where: {
          role: 'STAFF',
        },

        orderBy: [
          {
            isActive: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],

        select: {
          ...staffSelect,

          sessions: {
            orderBy: {
              lastUsedAt: 'desc',
            },

            select: {
              id: true,
              expiresAt: true,
              lastUsedAt: true,
            },
          },
        },
      });

      const staff = users.map((user) => createStaffResponse(user, now));

      return res.json({
        staff,

        counts: {
          all: staff.length,

          active: staff.filter((item) => item.isActive).length,

          blocked: staff.filter((item) => !item.isActive).length,

          online: staff.filter((item) => item.isOnline).length,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

// создание сотрудника

router.post(
  '/api/staff',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsed = createStaffSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'Проверьте имя, email и пароль сотрудника',
        });
      }

      const { name, email, password } = parsed.data;

      const existingUser = await prisma.adminUser.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
        },
      });

      if (existingUser) {
        return res.status(409).json({
          message: 'Пользователь с таким email уже существует',
        });
      }

      const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

      const metadata = getRequestMetadata(req);

      const createdStaff = await prisma.$transaction(async (tx) => {
        const staff = await tx.adminUser.create({
          data: {
            name,
            email,
            passwordHash,

            role: 'STAFF',

            isActive: true,
          },

          select: staffSelect,
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'STAFF_CREATED',

            entityType: 'AdminUser',

            entityId: String(staff.id),

            details: JSON.stringify({
              name: staff.name,

              email: staff.email,

              role: staff.role,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return staff;
      });

      return res.status(201).json({
        staff: {
          ...createdStaff,

          isOnline: false,

          activeSessions: 0,

          lastActivityAt: null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({
          message: 'Пользователь с таким email уже существует',
        });
      }

      return next(error);
    }
  },
);

// блокировка сотрудника

router.patch(
  '/api/staff/:id/status',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = staffIdSchema.safeParse(req.params.id);

      const parsedBody = updateStaffStatusSchema.safeParse(req.body);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID сотрудника',
        });
      }

      if (!parsedBody.success) {
        return res.status(400).json({
          message: 'Некорректный статус сотрудника',
        });
      }

      const staffId = parsedId.data;

      const { isActive } = parsedBody.data;

      const metadata = getRequestMetadata(req);

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.adminUser.findUnique({
          where: {
            id: staffId,
          },

          select: staffSelect,
        });

        const targetError = getStaffTargetError(target, req.auth.user.id);

        if (targetError) {
          return {
            targetError,
          };
        }

        if (target.isActive === isActive) {
          return {
            revokedSessions: 0,
            changed: false,
          };
        }

        await tx.adminUser.update({
          where: {
            id: staffId,
          },

          data: {
            isActive,
          },
        });

        let revokedSessions = 0;

        if (!isActive) {
          const deletedSessions = await tx.adminSession.deleteMany({
            where: {
              userId: staffId,
            },
          });

          revokedSessions = deletedSessions.count;
        }

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: isActive ? 'STAFF_UNBLOCKED' : 'STAFF_BLOCKED',

            entityType: 'AdminUser',

            entityId: String(staffId),

            details: JSON.stringify({
              email: target.email,

              previousIsActive: target.isActive,

              nextIsActive: isActive,

              revokedSessions,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return {
          revokedSessions,
          changed: true,
        };
      });

      if (result.targetError) {
        return res.status(result.targetError.status).json({
          message: result.targetError.message,
        });
      }

      return res.json({
        message: isActive
          ? 'Сотрудник разблокирован'
          : 'Сотрудник заблокирован',

        revokedSessions: result.revokedSessions,

        changed: result.changed,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// сброс пароля

router.patch(
  '/api/staff/:id/password',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = staffIdSchema.safeParse(req.params.id);

      const parsedBody = resetStaffPasswordSchema.safeParse(req.body);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID сотрудника',
        });
      }

      if (!parsedBody.success) {
        return res.status(400).json({
          message: 'Пароль должен содержать не менее 10 символов',
        });
      }

      const staffId = parsedId.data;

      const passwordHash = await argon2.hash(
        parsedBody.data.password,
        ARGON2_OPTIONS,
      );

      const metadata = getRequestMetadata(req);

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.adminUser.findUnique({
          where: {
            id: staffId,
          },

          select: staffSelect,
        });

        const targetError = getStaffTargetError(target, req.auth.user.id);

        if (targetError) {
          return {
            targetError,
          };
        }

        await tx.adminUser.update({
          where: {
            id: staffId,
          },

          data: {
            passwordHash,
          },
        });

        const deletedSessions = await tx.adminSession.deleteMany({
          where: {
            userId: staffId,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'STAFF_PASSWORD_RESET',

            entityType: 'AdminUser',

            entityId: String(staffId),

            details: JSON.stringify({
              email: target.email,

              revokedSessions: deletedSessions.count,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return {
          revokedSessions: deletedSessions.count,
        };
      });

      if (result.targetError) {
        return res.status(result.targetError.status).json({
          message: result.targetError.message,
        });
      }

      return res.json({
        message: 'Пароль сотрудника обновлён',

        revokedSessions: result.revokedSessions,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// завершение сессий

router.delete(
  '/api/staff/:id/sessions',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = staffIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID сотрудника',
        });
      }

      const staffId = parsedId.data;

      const metadata = getRequestMetadata(req);

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.adminUser.findUnique({
          where: {
            id: staffId,
          },

          select: staffSelect,
        });

        const targetError = getStaffTargetError(target, req.auth.user.id);

        if (targetError) {
          return {
            targetError,
          };
        }

        const deletedSessions = await tx.adminSession.deleteMany({
          where: {
            userId: staffId,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'STAFF_SESSIONS_REVOKED',

            entityType: 'AdminUser',

            entityId: String(staffId),

            details: JSON.stringify({
              email: target.email,

              revokedSessions: deletedSessions.count,
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return {
          revokedSessions: deletedSessions.count,
        };
      });

      if (result.targetError) {
        return res.status(result.targetError.status).json({
          message: result.targetError.message,
        });
      }

      return res.json({
        message: 'Сессии сотрудника завершены',

        revokedSessions: result.revokedSessions,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// удаление сотрудника

router.delete(
  '/api/staff/:id',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const parsedId = staffIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        return res.status(400).json({
          message: 'Некорректный ID сотрудника',
        });
      }

      const staffId = parsedId.data;
      const metadata = getRequestMetadata(req);

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.adminUser.findUnique({
          where: {
            id: staffId,
          },

          select: staffSelect,
        });

        const targetError = getStaffTargetError(target, req.auth.user.id);

        if (targetError) {
          return {
            targetError,
          };
        }

        const deletedSessions = await tx.adminSession.deleteMany({
          where: {
            userId: staffId,
          },
        });

        const releasedLeads = await tx.lead.updateMany({
          where: {
            assignedToId: staffId,
          },

          data: {
            assignedToId: null,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            userId: req.auth.user.id,

            action: 'STAFF_DELETED',

            entityType: 'AdminUser',

            entityId: String(staffId),

            details: JSON.stringify({
              name: target.name,

              email: target.email,

              role: target.role,

              wasActive: target.isActive,

              revokedSessions: deletedSessions.count,

              releasedLeads: releasedLeads.count,

              createdAt: target.createdAt.toISOString(),
            }),

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        await tx.adminUser.delete({
          where: {
            id: staffId,
          },
        });

        return {
          deletedStaff: target,

          revokedSessions: deletedSessions.count,

          releasedLeads: releasedLeads.count,
        };
      });

      if (result.targetError) {
        return res.status(result.targetError.status).json({
          message: result.targetError.message,
        });
      }

      return res.json({
        message: 'Сотрудник удалён',

        revokedSessions: result.revokedSessions,

        releasedLeads: result.releasedLeads,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// корень админки

router.get('/', (req, res) => {
  return res.redirect(303, '/admin/login');
});

// вход

router.get(['/login', '/login.html'], sendAdminPage('login.html'));

// главная админки

router.get(
  ['/dashboard', '/dashboard.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('dashboard.html'),
);

// заявки

router.get(
  ['/requests', '/requests.html'],
  requireAuth.page,
  requireRole.page('OWNER', 'STAFF'),
  sendAdminPage('requests.html'),
);

// сотрудники

router.get(
  ['/staff', '/staff.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('staff.html'),
);

// работы

router.get(
  ['/works', '/works-ad.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('works-ad.html'),
);

router.get(
  ['/works/edit', '/works-ad-edit.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('works-ad-edit.html'),
);

// статьи

router.get(
  ['/blog', '/blog-ad.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('blog-ad.html'),
);

router.get(
  ['/blog/edit', '/blog-ad-edit.html'],
  requireAuth.page,
  requireRole.page('OWNER'),
  sendAdminPage('blog-ad-edit.html'),
);

// админ 404

router.use((req, res) => {
  return res.status(404).send('Страница админки не найдена');
});

module.exports = router;
