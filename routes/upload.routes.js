'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const prisma = require('../lib/prisma');

const requireAuth = require('../middleware/require-auth');
const requireRole = require('../middleware/require-role');
const requireCsrf = require('../middleware/require-csrf');
const validateOrigin = require('../middleware/validate-origin');

const router = express.Router();

const ROOT_DIR = path.join(__dirname, '..');

const WORK_UPLOADS_DIR = path.join(ROOT_DIR, 'site', 'uploads', 'works');

const WORK_UPLOADS_URL = '/site/uploads/works';

const BLOG_UPLOADS_DIR = path.join(ROOT_DIR, 'site', 'uploads', 'blog');

const BLOG_UPLOADS_URL = '/site/uploads/blog';

const WORK_IMAGE_FIELDS = [
  'beforeImage',
  'afterImage',
  'heroImage',
  'experienceImage',
];

const MAX_IMAGE_SIZE = 12 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);

const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },

  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      const error = new Error('Поддерживаются JPG, PNG, WebP, AVIF и HEIC');

      error.code = 'UNSUPPORTED_IMAGE_TYPE';

      callback(error);

      return;
    }

    callback(null, true);
  },
});

function createWorkImageName() {
  const randomPart = crypto.randomBytes(12).toString('hex');

  return `${Date.now()}-${randomPart}.webp`;
}

function createBlogImageName() {
  const randomPart = crypto.randomBytes(12).toString('hex');

  return `${Date.now()}-${randomPart}.webp`;
}

function isManagedBlogImage(imagePath) {
  const value = String(imagePath || '').trim();

  const fileName = path.posix.basename(value);

  const expectedPath = `${BLOG_UPLOADS_URL}/${fileName}`;

  return value === expectedPath && /^\d{13}-[a-f0-9]{24}\.webp$/.test(fileName);
}

function isManagedWorkImage(imagePath) {
  const value = String(imagePath || '').trim();

  const fileName = path.posix.basename(value);

  const expectedPath = `${WORK_UPLOADS_URL}/${fileName}`;

  return value === expectedPath && /^\d{13}-[a-f0-9]{24}\.webp$/.test(fileName);
}

async function removeFileSafe(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function isBlogImageReferenced(imagePath) {
  const references = await prisma.blogPost.count({
    where: {
      coverImage: imagePath,
    },
  });

  return references > 0;
}

async function isWorkImageReferenced(imagePath) {
  const [workReferences, galleryReferences] = await prisma.$transaction([
    prisma.work.count({
      where: {
        OR: WORK_IMAGE_FIELDS.map((fieldName) => ({
          [fieldName]: imagePath,
        })),
      },
    }),

    prisma.workImage.count({
      where: {
        imagePath,
      },
    }),
  ]);

  return workReferences > 0 || galleryReferences > 0;
}

// загрузка фотографии работы

router.post(
  '/work-image',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  upload.single('image'),
  async (req, res, next) => {
    let temporaryPath = '';

    try {
      if (!req.file?.buffer) {
        return res.status(400).json({
          message: 'Выберите изображение для загрузки',
        });
      }

      const sharpOptions = {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      };

      const metadata = await sharp(req.file.buffer, sharpOptions).metadata();

      if (
        !metadata.width ||
        !metadata.height ||
        !metadata.format ||
        !ALLOWED_IMAGE_FORMATS.has(metadata.format)
      ) {
        return res.status(415).json({
          message: 'Файл не является поддерживаемым изображением',
        });
      }

      await fs.mkdir(WORK_UPLOADS_DIR, {
        recursive: true,
      });

      const fileName = createWorkImageName();

      const finalPath = path.join(WORK_UPLOADS_DIR, fileName);

      temporaryPath = `${finalPath}.tmp`;

      const result = await sharp(req.file.buffer, sharpOptions)
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 86,
          effort: 4,
        })
        .toFile(temporaryPath);

      await fs.rename(temporaryPath, finalPath);

      temporaryPath = '';

      return res.status(201).json({
        image: {
          path: `${WORK_UPLOADS_URL}/${fileName}`,

          width: result.width,
          height: result.height,
          size: result.size,
          format: result.format,
        },
      });
    } catch (error) {
      if (temporaryPath) {
        await removeFileSafe(temporaryPath).catch(() => undefined);
      }

      if (error?.code === 'UNSUPPORTED_IMAGE_TYPE') {
        return res.status(415).json({
          message: error.message,
        });
      }

      if (
        error?.name === 'Error' &&
        /unsupported|corrupt|invalid|Input/i.test(error.message)
      ) {
        return res.status(400).json({
          message: 'Изображение повреждено или имеет неподдерживаемый формат',
        });
      }

      return next(error);
    }
  },
);

// загрузка обложки статьи

router.post(
  '/blog-image',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  upload.single('image'),
  async (req, res, next) => {
    let temporaryPath = '';

    try {
      if (!req.file?.buffer) {
        return res.status(400).json({
          message: 'Выберите обложку для загрузки',
        });
      }

      const sharpOptions = {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      };

      const metadata = await sharp(req.file.buffer, sharpOptions).metadata();

      if (
        !metadata.width ||
        !metadata.height ||
        !metadata.format ||
        !ALLOWED_IMAGE_FORMATS.has(metadata.format)
      ) {
        return res.status(415).json({
          message: 'Файл не является поддерживаемым изображением',
        });
      }

      await fs.mkdir(BLOG_UPLOADS_DIR, {
        recursive: true,
      });

      const fileName = createBlogImageName();

      const finalPath = path.join(BLOG_UPLOADS_DIR, fileName);

      temporaryPath = `${finalPath}.tmp`;

      const result = await sharp(req.file.buffer, sharpOptions)
        .rotate()
        .resize({
          width: 2400,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 86,
          effort: 4,
        })
        .toFile(temporaryPath);

      await fs.rename(temporaryPath, finalPath);

      temporaryPath = '';

      return res.status(201).json({
        image: {
          path: `${BLOG_UPLOADS_URL}/${fileName}`,

          width: result.width,
          height: result.height,
          size: result.size,
          format: result.format,
        },
      });
    } catch (error) {
      if (temporaryPath) {
        await removeFileSafe(temporaryPath).catch(() => undefined);
      }

      if (error?.code === 'UNSUPPORTED_IMAGE_TYPE') {
        return res.status(415).json({
          message: error.message,
        });
      }

      if (
        /unsupported|corrupt|invalid|Input/i.test(String(error?.message || ''))
      ) {
        return res.status(400).json({
          message: 'Изображение повреждено или имеет неподдерживаемый формат',
        });
      }

      return next(error);
    }
  },
);

// удаление несохранённой обложки

router.delete(
  '/blog-image',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const imagePath = String(
        req.body?.path || '',
      ).trim();

      if (!isManagedBlogImage(imagePath)) {
        return res.status(400).json({
          message:
            'Некорректный путь обложки',
        });
      }

      const isReferenced =
        await isBlogImageReferenced(
          imagePath,
        );

      if (isReferenced) {
        return res.status(409).json({
          message:
            'Обложка уже используется статьёй',
        });
      }

      const fileName =
        path.posix.basename(imagePath);

      const absolutePath = path.join(
        BLOG_UPLOADS_DIR,
        fileName,
      );

      await removeFileSafe(absolutePath);

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

// удаление несохранённой фотографии

router.delete(
  '/work-image',
  validateOrigin,
  requireAuth,
  requireRole('OWNER'),
  requireCsrf,
  async (req, res, next) => {
    try {
      const imagePath = String(
        req.body?.path || '',
      ).trim();

      if (!isManagedWorkImage(imagePath)) {
        return res.status(400).json({
          message:
            'Некорректный путь изображения',
        });
      }

      const isReferenced =
        await isWorkImageReferenced(
          imagePath,
        );

      if (isReferenced) {
        return res.status(409).json({
          message:
            'Изображение уже используется работой',
        });
      }

      const fileName =
        path.posix.basename(imagePath);

      const absolutePath = path.join(
        WORK_UPLOADS_DIR,
        fileName,
      );

      await removeFileSafe(absolutePath);

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

// ошибки multer

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: 'Изображение должно весить не больше 12 МБ',
      });
    }

    return res.status(400).json({
      message: 'Не удалось принять изображение',
    });
  }

  if (error?.code === 'UNSUPPORTED_IMAGE_TYPE') {
    return res.status(415).json({
      message: error.message,
    });
  }

  return next(error);
});

module.exports = router;
