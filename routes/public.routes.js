'use strict';

const express = require('express');
const { z } = require('zod');

const prisma = require('../lib/prisma');

const router = express.Router();

const worksQuerySchema = z.object({
  status: z.literal('published').optional(),

  category: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional(),

  home: z
    .enum(['true', 'false'])
    .optional(),
});

const workSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const workListSelect = {
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
};

const workDetailSelect = {
  ...workListSelect,

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
    },
  },
};

function parseLegacyGallery(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function createWorkDetailResponse(work) {
  const relationGallery = Array.isArray(work.images)
    ? work.images
        .map((image) => image.imagePath)
        .filter(Boolean)
    : [];

  const legacyGallery =
    parseLegacyGallery(work.gallery);

  const gallery = relationGallery.length
    ? relationGallery
    : legacyGallery;

  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    excerpt: work.excerpt,

    category: work.category,
    categorySlug: work.categorySlug,

    beforeImage: work.beforeImage,
    afterImage: work.afterImage,

    technique:
      work.technique ||
      work.category,

    duration: work.duration,

    heroImage:
      work.heroImage ||
      work.afterImage,

    experienceImage:
      work.experienceImage ||
      work.heroImage ||
      work.afterImage,

    heroQuote: work.heroQuote,
    story: work.story,

    gallery,
    images: work.images,

    isPublished: work.isPublished,
    showOnHome: work.showOnHome,

    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
  };
}

// список опубликованных работ

router.get(
  '/works',
  async (req, res, next) => {
    try {
      const parsed =
        worksQuerySchema.safeParse(
          req.query,
        );

      if (!parsed.success) {
        return res.status(400).json({
          message:
            'Некорректные параметры списка работ',
        });
      }

      const where = {
        isPublished: true,
      };

      if (parsed.data.category) {
        where.categorySlug =
          parsed.data.category;
      }

      if (
        parsed.data.home === 'true'
      ) {
        where.showOnHome = true;
      }

      const works =
        await prisma.work.findMany({
          where,

          orderBy: [
            {
              createdAt: 'desc',
            },
            {
              id: 'desc',
            },
          ],

          select: workListSelect,
        });

      return res.json({
        works,
        total: works.length,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// опубликованная работа по slug

router.get(
  '/works/:slug',
  async (req, res, next) => {
    try {
      const parsedSlug =
        workSlugSchema.safeParse(
          req.params.slug,
        );

      if (!parsedSlug.success) {
        return res.status(400).json({
          message:
            'Некорректный адрес работы',
        });
      }

      const work =
        await prisma.work.findFirst({
          where: {
            slug: parsedSlug.data,
            isPublished: true,
          },

          select: workDetailSelect,
        });

      if (!work) {
        return res.status(404).json({
          message:
            'Работа не найдена',
        });
      }

      return res.json({
        work:
          createWorkDetailResponse(
            work,
          ),
      });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
