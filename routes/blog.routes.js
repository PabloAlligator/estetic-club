'use strict';

const express = require('express');
const { z } = require('zod');

const prisma = require('../lib/prisma');

const router = express.Router();

const BLOG_CATEGORY_SLUGS = [
  'hair-care',
  'coloring',
  'airtouch',
  'home-care',
];

const blogListQuerySchema = z
  .object({
    status: z.literal('published').optional(),

    category: z
      .union([
        z.literal('all'),
        z.enum(BLOG_CATEGORY_SLUGS),
      ])
      .optional()
      .default('all'),
  })
  .strict();

const blogSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const blogListSelect = {
  id: true,
  slug: true,

  title: true,
  excerpt: true,

  category: true,
  categorySlug: true,

  coverImage: true,
  coverAlt: true,

  readingTime: true,

  isPublished: true,
  publishedAt: true,

  createdAt: true,
  updatedAt: true,
};

const blogDetailSelect = {
  ...blogListSelect,

  content: true,

  authorName: true,
  authorRole: true,
  expertNote: true,

  seoTitle: true,
  seoDescription: true,
};

function createPublishedBlogWhere(category, now = new Date()) {
  const where = {
    isPublished: true,

    OR: [
      {
        publishedAt: null,
      },
      {
        publishedAt: {
          lte: now,
        },
      },
    ],
  };

  if (category && category !== 'all') {
    where.categorySlug = category;
  }

  return where;
}

function setPublicBlogCache(res) {
  res.set(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300',
  );
}

// список статей

router.get('/blog-posts', async (req, res, next) => {
  try {
    const parsed = blogListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Некорректные параметры списка статей',
      });
    }

    const where = createPublishedBlogWhere(
      parsed.data.category,
    );

    const posts = await prisma.blogPost.findMany({
      where,

      orderBy: [
        {
          publishedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      select: blogListSelect,
    });

    setPublicBlogCache(res);

    return res.json({
      posts,
      total: posts.length,
    });
  } catch (error) {
    return next(error);
  }
});

// статья по slug

router.get('/blog-posts/:slug', async (req, res, next) => {
  try {
    const parsedSlug = blogSlugSchema.safeParse(
      req.params.slug,
    );

    if (!parsedSlug.success) {
      return res.status(400).json({
        message: 'Некорректный адрес статьи',
      });
    }

    const post = await prisma.blogPost.findFirst({
      where: {
        slug: parsedSlug.data,

        isPublished: true,

        OR: [
          {
            publishedAt: null,
          },
          {
            publishedAt: {
              lte: new Date(),
            },
          },
        ],
      },

      select: blogDetailSelect,
    });

    if (!post) {
      return res.status(404).json({
        message: 'Статья не найдена',
      });
    }

    setPublicBlogCache(res);

    return res.json({
      post,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
