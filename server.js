'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');

const prisma = require('./lib/prisma');
const { getServiceBySlug } = require('./config/services');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const blogRoutes = require('./routes/blog.routes');
const publicRoutes = require('./routes/public.routes');
const catalogRoutes = require('./routes/catalog.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminCatalogRoutes = require('./routes/admin-catalog.routes');

const validateOrigin = require('./middleware/validate-origin');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITE_DIR = path.join(ROOT_DIR, 'site');
const HTML_TEMPLATE_CACHE = new Map();

function normalizeSiteOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    return url.origin;
  } catch {
    return '';
  }
}

function getSiteOrigin(req) {
  const configuredOrigin = normalizeSiteOrigin(process.env.SITE_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const requestOrigin = normalizeSiteOrigin(
    `${req.protocol}://${req.get('host') || ''}`,
  );

  return requestOrigin || `http://localhost:${PORT}`;
}

async function getHtmlTemplate(relativePath) {
  if (IS_PRODUCTION && HTML_TEMPLATE_CACHE.has(relativePath)) {
    return HTML_TEMPLATE_CACHE.get(relativePath);
  }

  const template = await fs.promises.readFile(
    path.join(PUBLIC_DIR, relativePath),
    'utf8',
  );

  if (IS_PRODUCTION) {
    HTML_TEMPLATE_CACHE.set(relativePath, template);
  }

  return template;
}

async function sendSeoPage(req, res, next, relativePath, canonicalPath) {
  try {
    const siteOrigin = getSiteOrigin(req);
    const canonicalUrl = new URL(canonicalPath, `${siteOrigin}/`).href;
    const template = await getHtmlTemplate(relativePath);
    const html = template
      .replaceAll('{{SITE_ORIGIN}}', siteOrigin)
      .replaceAll('{{CANONICAL_URL}}', canonicalUrl);

    return res.type('html').send(html);
  } catch (error) {
    return next(error);
  }
}

const DYNAMIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeDynamicSlug(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase();

  return DYNAMIC_SLUG_PATTERN.test(slug) ? slug : '';
}

function stripHtml(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim();
}

function createSeoDescription(...values) {
  const description =
    values.map((value) => stripHtml(value)).find(Boolean) ||
    'Культура волос — окрашивание, уход и профессиональные товары для волос в Абакане.';

  if (description.length <= 180) {
    return description;
  }

  const shortened = description.slice(0, 177);
  const lastSpace = shortened.lastIndexOf(' ');

  return `${shortened.slice(0, lastSpace > 120 ? lastSpace : 177).trim()}…`;
}

function createSeoTitle(value, fallback) {
  const title = stripHtml(value) || fallback;

  return /культура волос/i.test(title) ? title : `${title} | Культура волос`;
}

function createAbsoluteUrl(siteOrigin, value, fallbackPath = '/') {
  try {
    return new URL(String(value || fallbackPath), `${siteOrigin}/`).href;
  } catch {
    return new URL(fallbackPath, `${siteOrigin}/`).href;
  }
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function replaceTemplateTokens(template, replacements) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
      return match;
    }

    return String(replacements[key]);
  });
}

function setDynamicPageCache(res) {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
}

function sendPublicNotFound(res) {
  return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
}

function parseLegacyWorkGallery(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function createWorkPageData(work) {
  const relationGallery = Array.isArray(work.images)
    ? work.images.map((image) => image.imagePath).filter(Boolean)
    : [];
  const legacyGallery = parseLegacyWorkGallery(work.gallery);

  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    excerpt: work.excerpt,
    category: work.category,
    categorySlug: work.categorySlug,
    beforeImage: work.beforeImage,
    afterImage: work.afterImage,
    technique: work.technique || work.category,
    duration: work.duration,
    heroImage: work.heroImage || work.afterImage,
    experienceImage: work.experienceImage || work.heroImage || work.afterImage,
    heroQuote: work.heroQuote,
    story: work.story,
    gallery: relationGallery.length ? relationGallery : legacyGallery,
    images: work.images,
    isPublished: work.isPublished,
    showOnHome: work.showOnHome,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
  };
}

function createProductPageData(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) ? product.images : [];
  const prices = variants.map((variant) => variant.price);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    badge: product.badge,
    sku: product.sku,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    category: product.category,
    brand: product.brand,
    variants,
    images,
    mainImage: images[0] || null,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function createArticlePageHtml(req, post) {
  const siteOrigin = getSiteOrigin(req);
  const canonicalUrl = createAbsoluteUrl(
    siteOrigin,
    `/blog/${encodeURIComponent(post.slug)}`,
  );
  const seoTitle = createSeoTitle(post.seoTitle || post.title, post.title);
  const seoDescription = createSeoDescription(
    post.seoDescription,
    post.excerpt,
    post.content,
  );
  const coverUrl = createAbsoluteUrl(
    siteOrigin,
    post.coverImage,
    '/site/img/blog/blog-hero.webp',
  );
  const coverAlt = stripHtml(post.coverAlt) || post.title;
  const publishedAt = post.publishedAt || post.createdAt;
  const authorName = stripHtml(post.authorName);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: seoDescription,
    image: [coverUrl],
    datePublished: publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    author: authorName
      ? {
          '@type': 'Person',
          name: authorName,
        }
      : {
          '@type': 'Organization',
          name: 'Культура волос',
        },
    publisher: {
      '@type': 'Organization',
      name: 'Культура волос',
      url: siteOrigin,
    },
  };
  const template = await getHtmlTemplate(path.join('blog', 'article.html'));

  return replaceTemplateTokens(template, {
    SEO_TITLE: escapeHtml(seoTitle),
    SEO_DESCRIPTION: escapeHtml(seoDescription),
    CANONICAL_URL: escapeHtml(canonicalUrl),
    OG_IMAGE_URL: escapeHtml(coverUrl),
    OG_IMAGE_ALT: escapeHtml(coverAlt),
    PUBLISHED_AT: escapeHtml(publishedAt.toISOString()),
    MODIFIED_AT: escapeHtml(post.updatedAt.toISOString()),
    JSON_LD: escapeJsonForHtml(schema),
    INITIAL_ARTICLE_JSON: escapeJsonForHtml({ post }),
  });
}

async function createWorkPageHtml(req, work) {
  const data = createWorkPageData(work);
  const siteOrigin = getSiteOrigin(req);
  const canonicalUrl = createAbsoluteUrl(
    siteOrigin,
    `/works/${encodeURIComponent(data.slug)}`,
  );
  const seoTitle = createSeoTitle(data.title, 'Работа студии');
  const seoDescription = createSeoDescription(
    data.excerpt,
    data.story,
    `${data.title}. Результат работы студии «Культура волос».`,
  );
  const imageUrl = createAbsoluteUrl(
    siteOrigin,
    data.heroImage,
    '/site/img/main-hero-bg.webp',
  );
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: seoTitle,
        description: seoDescription,
        datePublished: data.createdAt.toISOString(),
        dateModified: data.updatedAt.toISOString(),
        primaryImageOfPage: {
          '@id': `${canonicalUrl}#primaryimage`,
        },
        breadcrumb: {
          '@id': `${canonicalUrl}#breadcrumb`,
        },
      },
      {
        '@type': 'ImageObject',
        '@id': `${canonicalUrl}#primaryimage`,
        url: imageUrl,
        contentUrl: imageUrl,
        caption: data.title,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: createAbsoluteUrl(siteOrigin, '/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Работы',
            item: createAbsoluteUrl(siteOrigin, '/works'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: data.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };
  const template = await getHtmlTemplate(
    path.join('works', 'work-detail.html'),
  );

  return replaceTemplateTokens(template, {
    SEO_TITLE: escapeHtml(seoTitle),
    SEO_DESCRIPTION: escapeHtml(seoDescription),
    CANONICAL_URL: escapeHtml(canonicalUrl),
    OG_IMAGE_URL: escapeHtml(imageUrl),
    OG_IMAGE_ALT: escapeHtml(data.title),
    PUBLISHED_AT: escapeHtml(data.createdAt.toISOString()),
    MODIFIED_AT: escapeHtml(data.updatedAt.toISOString()),
    JSON_LD: escapeJsonForHtml(schema),
    INITIAL_WORK_JSON: escapeJsonForHtml({ work: data }),
  });
}

async function createProductPageHtml(req, product) {
  const data = createProductPageData(product);
  const siteOrigin = getSiteOrigin(req);
  const canonicalUrl = createAbsoluteUrl(
    siteOrigin,
    `/catalog/product/${encodeURIComponent(data.slug)}`,
  );
  const seoTitle = createSeoTitle(data.seoTitle || data.title, data.title);
  const seoDescription = createSeoDescription(
    data.seoDescription,
    data.shortDescription,
    data.description,
  );
  const imageUrls = data.images.map((image) =>
    createAbsoluteUrl(siteOrigin, image.imagePath),
  );
  const mainImageUrl =
    imageUrls[0] ||
    createAbsoluteUrl(siteOrigin, '/site/img/main-hero-bg.webp');
  const offers = data.variants.map((variant) => ({
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'RUB',
    price: String(variant.price),
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    ...(variant.sku ? { sku: variant.sku } : {}),
  }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.title,
    description: seoDescription,
    image: imageUrls,
    url: canonicalUrl,
    ...(data.sku ? { sku: data.sku } : {}),
    ...(data.brand?.name
      ? {
          brand: {
            '@type': 'Brand',
            name: data.brand.name,
          },
        }
      : {}),
    ...(data.category?.name ? { category: data.category.name } : {}),
    offers: offers.length === 1 ? offers[0] : offers,
  };
  const template = await getHtmlTemplate(path.join('catalog', 'product.html'));

  return replaceTemplateTokens(template, {
    SEO_TITLE: escapeHtml(seoTitle),
    SEO_DESCRIPTION: escapeHtml(seoDescription),
    CANONICAL_URL: escapeHtml(canonicalUrl),
    OG_IMAGE_URL: escapeHtml(mainImageUrl),
    OG_IMAGE_ALT: escapeHtml(data.title),
    JSON_LD: escapeJsonForHtml(schema),
    INITIAL_PRODUCT_JSON: escapeJsonForHtml({ product: data }),
  });
}
function createServiceParagraphsHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('\n');
}

function createServiceListItemsHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('\n');
}

function createServiceBenefitsHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map(
      (item, index) => `
        <li data-services-reveal>
          <span>${String(index + 1).padStart(2, '0')}</span>
          <p>${escapeHtml(item)}</p>
        </li>
      `,
    )
    .join('\n');
}

function createServiceStepsHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map(
      (step, index) => `
        <li
          class="service-detail-step"
          data-services-reveal
        >
          <span class="service-detail-step__number">
            ${String(index + 1).padStart(2, '0')}
          </span>

          <div>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.text)}</p>
          </div>
        </li>
      `,
    )
    .join('\n');
}

function createServiceFaqHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map(
      (item) => `
        <details
          class="service-detail-faq__item"
          data-services-reveal
        >
          <summary>
            <span>${escapeHtml(item.question)}</span>
            <i aria-hidden="true"></i>
          </summary>

          <div class="service-detail-faq__answer">
            <p>${escapeHtml(item.answer)}</p>
          </div>
        </details>
      `,
    )
    .join('\n');
}

function createRelatedServicesHtml(slugs) {
  return (Array.isArray(slugs) ? slugs : [])
    .map((slug) => getServiceBySlug(slug))
    .filter(Boolean)
    .map(
      (service) => `
        <a
          class="service-detail-related-card"
          href="/services/${service.slug}"
        >
          <span>${escapeHtml(service.number)}</span>
          <h3>${escapeHtml(service.name)}</h3>
          <p>${escapeHtml(service.shortDescription)}</p>

          <strong>
            Подробнее об услуге
            <span aria-hidden="true">→</span>
          </strong>
        </a>
      `,
    )
    .join('\n');
}

function createServiceSchema(req, service, canonicalUrl, imageUrl) {
  const siteOrigin = getSiteOrigin(req);
  const serviceId = `${canonicalUrl}#service`;
  const webpageId = `${canonicalUrl}#webpage`;
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const faqId = `${canonicalUrl}#faq`;

  const graph = [
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: canonicalUrl,
      name: service.seoTitle,
      description: service.seoDescription,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        caption: service.imageAlt,
      },
      breadcrumb: {
        '@id': breadcrumbId,
      },
      mainEntity: {
        '@id': serviceId,
      },
      inLanguage: 'ru-RU',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Главная',
          item: createAbsoluteUrl(siteOrigin, '/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Услуги',
          item: createAbsoluteUrl(siteOrigin, '/services'),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: service.name,
          item: canonicalUrl,
        },
      ],
    },
    {
      '@type': 'Service',
      '@id': serviceId,
      name: service.name,
      serviceType: service.serviceType,
      description: service.seoDescription,
      url: canonicalUrl,
      image: imageUrl,
      provider: {
        '@type': 'HairSalon',
        '@id': `${siteOrigin}/#organization`,
        name: 'Культура волос',
        url: siteOrigin,
      },
      areaServed: {
        '@type': 'City',
        name: 'Абакан',
      },
      mainEntityOfPage: {
        '@id': webpageId,
      },
    },
  ];

  if (Array.isArray(service.faq) && service.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': faqId,
      url: `${canonicalUrl}#service-faq-title`,
      mainEntity: service.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

async function createServicePageHtml(req, service) {
  const siteOrigin = getSiteOrigin(req);
  const canonicalUrl = createAbsoluteUrl(
    siteOrigin,
    `/services/${encodeURIComponent(service.slug)}`,
  );

  const seoTitle = createSeoTitle(service.seoTitle, service.h1);

  const seoDescription = createSeoDescription(
    service.seoDescription,
    service.shortDescription,
  );

  const imageUrl = createAbsoluteUrl(
    siteOrigin,
    service.image,
    '/site/img/main-hero-bg.webp',
  );

  const schema = createServiceSchema(req, service, canonicalUrl, imageUrl);

  const template = await getHtmlTemplate(
    path.join('services', 'service-detail.html'),
  );

  return replaceTemplateTokens(template, {
    SEO_TITLE: escapeHtml(seoTitle),
    SEO_DESCRIPTION: escapeHtml(seoDescription),
    CANONICAL_URL: escapeHtml(canonicalUrl),
    OG_IMAGE_URL: escapeHtml(imageUrl),
    OG_IMAGE_ALT: escapeHtml(service.imageAlt),

    SERVICE_NAME: escapeHtml(service.name),
    SERVICE_NAME_PREPOSITIONAL: escapeHtml(
      service.namePrepositional || service.name,
    ),
    SERVICE_NUMBER: escapeHtml(service.number),
    SERVICE_EYEBROW: escapeHtml(service.eyebrow),
    SERVICE_H1: escapeHtml(service.h1),
    SERVICE_LEAD: escapeHtml(service.lead),
    SERVICE_PRICE: escapeHtml(service.priceLabel),
    SERVICE_PRICE_NOTE: escapeHtml(service.priceNote),
    SERVICE_DURATION: escapeHtml(service.duration),

    SERVICE_IMAGE: escapeHtml(service.image),
    SERVICE_IMAGE_ALT: escapeHtml(service.imageAlt),
    SERVICE_IMAGE_WIDTH: escapeHtml(service.imageWidth),
    SERVICE_IMAGE_HEIGHT: escapeHtml(service.imageHeight),
    SERVICE_IMAGE_SRCSET: escapeHtml(service.imageSrcset),

    SERVICE_INTRO_HTML: createServiceParagraphsHtml(service.intro),
    SERVICE_BENEFITS_HTML: createServiceBenefitsHtml(service.benefits),
    SERVICE_INDICATIONS_HTML: createServiceListItemsHtml(service.indications),
    SERVICE_LIMITATIONS_HTML: createServiceListItemsHtml(service.limitations),
    SERVICE_STEPS_HTML: createServiceStepsHtml(service.steps),
    SERVICE_AFTERCARE_HTML: createServiceListItemsHtml(service.aftercare),
    SERVICE_FAQ_HTML: createServiceFaqHtml(service.faq),
    RELATED_SERVICES_HTML: createRelatedServicesHtml(service.relatedSlugs),

    JSON_LD: escapeJsonForHtml(schema),
  });
}

function escapeXml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };

  return String(value ?? '').replace(/[&<>"']/g, (symbol) => symbols[symbol]);
}

function createSitemapUrl(siteOrigin, pathname, lastModified) {
  const location = new URL(pathname, `${siteOrigin}/`).href;
  const lines = ['  <url>', `    <loc>${escapeXml(location)}</loc>`];

  if (lastModified) {
    lines.push(
      `    <lastmod>${escapeXml(
        new Date(lastModified).toISOString(),
      )}</lastmod>`,
    );
  }

  lines.push('  </url>');

  return lines.join('\n');
}

async function getSitemapEntries(siteOrigin) {
  const now = new Date();

  const [posts, works, products] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
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
      },
      orderBy: {
        slug: 'asc',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    prisma.work.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        slug: 'asc',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isPublished: true,
        category: {
          isPublished: true,
        },
        variants: {
          some: {
            isActive: true,
          },
        },
        images: {
          some: {},
        },
      },
      orderBy: {
        slug: 'asc',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
  ]);

  const staticPaths = [
    '/',
    '/services',
    '/works',
    '/blog',
    '/catalog',
    '/contacts',
  ];

  return [
    ...staticPaths.map((pathname) => createSitemapUrl(siteOrigin, pathname)),
    ...posts.map((post) =>
      createSitemapUrl(
        siteOrigin,
        `/blog/${encodeURIComponent(post.slug)}`,
        post.updatedAt,
      ),
    ),
    ...works.map((work) =>
      createSitemapUrl(
        siteOrigin,
        `/works/${encodeURIComponent(work.slug)}`,
        work.updatedAt,
      ),
    ),
    ...products.map((product) =>
      createSitemapUrl(
        siteOrigin,
        `/catalog/product/${encodeURIComponent(product.slug)}`,
        product.updatedAt,
      ),
    ),
  ];
}

// смтп

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
}

const smtpTransporter = nodemailer.createTransport({
  host: String(process.env.SMTP_HOST || '').trim(),

  port: Number(process.env.SMTP_PORT) || 465,

  secure: parseBoolean(process.env.SMTP_SECURE),

  auth: {
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || ''),
  },

  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

// лидс

const ALLOWED_SERVICES = [
  'Консультация',
  'AirTouch',
  'Тотал блонд',
  'Тонирование',
  'Работа с сединой',
  'Уход и восстановление',
  'Другая услуга',
];

const leadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .transform((value) => value.replace(/\s+/g, ' ')),

    phone: z.string().trim().min(10).max(24),

    service: z.enum(ALLOWED_SERVICES),

    message: z.string().trim().max(1000).optional().default(''),

    source: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .default('contacts-page'),

    company: z.string().trim().max(200).optional().default(''),

    consentAccepted: z.literal(true),
  })
  .strict();

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    message: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  },
});

function normalizeRussianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    digits = `7${digits}`;
  }

  if (!/^7\d{10}$/.test(digits)) {
    return '';
  }

  return `+${digits}`;
}

function escapeHtml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return String(value ?? '').replace(/[&<>"']/g, (symbol) => symbols[symbol]);
}

function cleanMailHeader(value) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function formatLeadDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Krasnoyarsk',
  }).format(date);
}

function buildLeadEmailText(lead) {
  return [
    `Новая заявка №${lead.id}`,
    '',
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Услуга: ${lead.service}`,
    `Комментарий: ${lead.message || 'Не указан'}`,
    `Источник: ${lead.source}`,
    `Получена: ${formatLeadDate(lead.createdAt)}`,
    '',
    'Заявка сохранена в административной панели Культура волос.',
  ].join('\n');
}

function buildLeadEmailHtml(lead) {
  const safeName = escapeHtml(lead.name);
  const safePhone = escapeHtml(lead.phone);
  const safeService = escapeHtml(lead.service);
  const safeSource = escapeHtml(lead.source);

  const safeMessage = lead.message
    ? escapeHtml(lead.message).replace(/\r?\n/g, '<br>')
    : 'Не указан';

  const safeDate = escapeHtml(formatLeadDate(lead.createdAt));

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width">
        <title>Новая заявка Культура волос</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background: #f6f1eb;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width: 100%;
            background: #f6f1eb;
          "
        >
          <tr>
            <td
              align="center"
              style="
                padding: 32px 14px;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width: 100%;
                  max-width: 640px;
                  overflow: hidden;
                  border: 1px solid rgba(47, 35, 26, 0.12);
                  border-radius: 22px;
                  background: #fffaf5;
                "
              >
                <tr>
                  <td
                    style="
                      padding: 30px 34px 28px;
                      background:
                        linear-gradient(
                          135deg,
                          #80624f 0%,
                          #4c382c 100%
                        );
                    "
                  >
                    <div
                      style="
                        margin-bottom: 34px;
                        color: rgba(255, 250, 245, 0.72);
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.2em;
                        text-transform: uppercase;
                      "
                    >
                      Клуб эстетики
                    </div>

                    <div
                      style="
                        margin-bottom: 12px;
                        color: #fffaf5;
                        font-family: Georgia, 'Times New Roman', serif;
                        font-size: 38px;
                        font-weight: 400;
                        line-height: 1;
                        letter-spacing: -0.035em;
                      "
                    >
                      Культура волос
                    </div>

                    <div
                      style="
                        color: rgba(255, 250, 245, 0.68);
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 13px;
                        line-height: 1.65;
                      "
                    >
                      Новая заявка с сайта сохранена в системе.
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding: 34px;
                    "
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          style="
                            padding-bottom: 24px;
                          "
                        >
                          <span
                            style="
                              display: inline-block;
                              padding: 8px 12px;
                              border-radius: 999px;
                              color: #795844;
                              background: #eee4da;
                              font-family: Arial, Helvetica, sans-serif;
                              font-size: 10px;
                              font-weight: 700;
                              letter-spacing: 0.12em;
                              text-transform: uppercase;
                            "
                          >
                            Новая заявка №${lead.id}
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding-bottom: 30px;
                            color: #2f231a;
                            font-family: Georgia, 'Times New Roman', serif;
                            font-size: 32px;
                            font-weight: 400;
                            line-height: 1.08;
                            letter-spacing: -0.03em;
                          "
                        >
                          ${safeName}
                        </td>
                      </tr>
                    </table>

                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        border-top: 1px solid rgba(47, 35, 26, 0.12);
                      "
                    >
                      <tr>
                        <td
                          width="34%"
                          valign="top"
                          style="
                            padding: 18px 12px 18px 0;
                            color: #9a765c;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.12em;
                            text-transform: uppercase;
                          "
                        >
                          Телефон
                        </td>

                        <td
                          valign="top"
                          style="
                            padding: 18px 0;
                            color: #2f231a;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 15px;
                            line-height: 1.6;
                          "
                        >
                          <a
                            href="tel:${safePhone}"
                            style="
                              color: #2f231a;
                              text-decoration: none;
                            "
                          >
                            ${safePhone}
                          </a>
                        </td>
                      </tr>

                      <tr>
                        <td
                          width="34%"
                          valign="top"
                          style="
                            padding: 18px 12px 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #9a765c;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.12em;
                            text-transform: uppercase;
                          "
                        >
                          Услуга
                        </td>

                        <td
                          valign="top"
                          style="
                            padding: 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #2f231a;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 15px;
                            line-height: 1.6;
                          "
                        >
                          ${safeService}
                        </td>
                      </tr>

                      <tr>
                        <td
                          width="34%"
                          valign="top"
                          style="
                            padding: 18px 12px 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #9a765c;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.12em;
                            text-transform: uppercase;
                          "
                        >
                          Комментарий
                        </td>

                        <td
                          valign="top"
                          style="
                            padding: 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #5d4a3d;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 14px;
                            line-height: 1.7;
                          "
                        >
                          ${safeMessage}
                        </td>
                      </tr>

                      <tr>
                        <td
                          width="34%"
                          valign="top"
                          style="
                            padding: 18px 12px 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #9a765c;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.12em;
                            text-transform: uppercase;
                          "
                        >
                          Получена
                        </td>

                        <td
                          valign="top"
                          style="
                            padding: 18px 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #5d4a3d;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 14px;
                            line-height: 1.7;
                          "
                        >
                          ${safeDate}
                        </td>
                      </tr>

                      <tr>
                        <td
                          width="34%"
                          valign="top"
                          style="
                            padding: 18px 12px 0 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #9a765c;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.12em;
                            text-transform: uppercase;
                          "
                        >
                          Источник
                        </td>

                        <td
                          valign="top"
                          style="
                            padding: 18px 0 0;
                            border-top: 1px solid rgba(47, 35, 26, 0.08);
                            color: #5d4a3d;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 14px;
                            line-height: 1.7;
                          "
                        >
                          ${safeSource}
                        </td>
                      </tr>
                    </table>

                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          style="
                            padding-top: 30px;
                          "
                        >
                          <a
                            href="tel:${safePhone}"
                            style="
                              display: inline-block;
                              padding: 14px 22px;
                              border-radius: 999px;
                              color: #fffaf5;
                              background: #795844;
                              font-family: Arial, Helvetica, sans-serif;
                              font-size: 11px;
                              font-weight: 700;
                              letter-spacing: 0.08em;
                              text-decoration: none;
                              text-transform: uppercase;
                            "
                          >
                            Позвонить клиенту
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding: 20px 34px;
                      border-top: 1px solid rgba(47, 35, 26, 0.09);
                      color: rgba(47, 35, 26, 0.48);
                      background: #f8f1e9;
                      font-family: Arial, Helvetica, sans-serif;
                      font-size: 11px;
                      line-height: 1.6;
                    "
                  >
                    Заявка сохранена в административной панели Культура волос.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendLeadEmail(lead) {
  const smtpUser = String(process.env.SMTP_USER || '').trim();

  const toEmail = String(process.env.TO_EMAIL || '').trim();

  if (!smtpUser || !toEmail) {
    throw new Error('SMTP_USER или TO_EMAIL не заполнены');
  }

  const safeSubjectName = cleanMailHeader(lead.name);
  const safeSubjectService = cleanMailHeader(lead.service);

  return smtpTransporter.sendMail({
    from: `"Культура волос" <${smtpUser}>`,
    to: toEmail,

    subject:
      `Новая заявка №${lead.id}: ` +
      `${safeSubjectName} — ${safeSubjectService}`,

    text: buildLeadEmailText(lead),
    html: buildLeadEmailHtml(lead),
  });
}

// экспресс

if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  express.json({
    limit: '100kb',
    strict: true,
  }),
);

app.use(cookieParser());

// старые адреса
const LEGACY_PAGE_REDIRECTS = new Map([
  ['/public', '/'],
  ['/public/', '/'],
  ['/index.html', '/'],
  ['/public/index.html', '/'],
  ['/services/services.html', '/services'],
  ['/public/services/services.html', '/services'],
  ['/catalog/catalog.html', '/catalog'],
  ['/public/catalog/catalog.html', '/catalog'],
  ['/works/work-main.html', '/works'],
  ['/public/works/work-main.html', '/works'],
  ['/blog/blog.html', '/blog'],
  ['/public/blog/blog.html', '/blog'],
  ['/contacts.html', '/contacts'],
  ['/public/contacts.html', '/contacts'],
  ['/cart.html', '/cart'],
  ['/public/cart.html', '/cart'],
  ['/checkout.html', '/checkout'],
  ['/public/checkout.html', '/checkout'],
  ['/order-success.html', '/order-success'],
  ['/public/order-success.html', '/order-success'],
  ['/public/privacy-policy.html', '/privacy-policy'],
]);

const LEGACY_ARTICLE_PATHS = new Set([
  '/blog/article.html',
  '/public/blog/article.html',
]);

const LEGACY_WORK_PATHS = new Set([
  '/works/work-detail.html',
  '/public/works/work-detail.html',
]);

const LEGACY_PRODUCT_PATHS = new Set([
  '/catalog/product.html',
  '/public/catalog/product.html',
]);
const SERVICE_TEMPLATE_PATHS = new Set([
  '/services/service-detail.html',
  '/public/services/service-detail.html',
]);

function buildRedirectUrl(req, pathname, excludedParams = []) {
  const excluded = new Set(excludedParams);
  const params = new URLSearchParams();

  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (excluded.has(key) || value === undefined || value === null) {
      return;
    }

    const values = Array.isArray(value) ? value : [value];

    values.forEach((item) => {
      params.append(key, String(item));
    });
  });

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

function getLegacySlug(req) {
  return String(req.query?.slug || '')
    .trim()
    .toLowerCase();
}

function shouldRemoveTrailingSlash(pathname) {
  const staticPages = new Set([
    '/services/',
    '/works/',
    '/blog/',
    '/contacts/',
    '/catalog/',
    '/cart/',
    '/checkout/',
    '/order-success/',
  ]);

  return (
    staticPages.has(pathname) ||
    /^\/(?:blog|works|services)\/[^/]+\/$/.test(pathname) ||
    /^\/catalog\/product\/[^/]+\/$/.test(pathname)
  );
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const pathname = req.path;

  if (pathname === '/404.html' || pathname === '/public/404.html') {
    return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  }
  if (SERVICE_TEMPLATE_PATHS.has(pathname)) {
    return sendPublicNotFound(res);
  }

  if (LEGACY_ARTICLE_PATHS.has(pathname)) {
    const slug = getLegacySlug(req);
    const target = slug ? `/blog/${encodeURIComponent(slug)}` : '/blog';

    return res.redirect(301, buildRedirectUrl(req, target, ['slug']));
  }

  if (LEGACY_WORK_PATHS.has(pathname)) {
    const slug = getLegacySlug(req);
    const target = slug ? `/works/${encodeURIComponent(slug)}` : '/works';

    return res.redirect(301, buildRedirectUrl(req, target, ['slug']));
  }

  if (LEGACY_PRODUCT_PATHS.has(pathname)) {
    const slug = getLegacySlug(req);
    const target = slug
      ? `/catalog/product/${encodeURIComponent(slug)}`
      : '/catalog';

    return res.redirect(301, buildRedirectUrl(req, target, ['slug']));
  }

  const legacyTarget = LEGACY_PAGE_REDIRECTS.get(pathname);

  if (legacyTarget) {
    return res.redirect(301, buildRedirectUrl(req, legacyTarget));
  }

  if (shouldRemoveTrailingSlash(pathname)) {
    const target = pathname.replace(/\/+$/, '');

    return res.redirect(301, buildRedirectUrl(req, target));
  }

  return next();
});

const publicStaticOptions = {
  index: false,
  redirect: false,
};

app.use('/site', express.static(SITE_DIR, publicStaticOptions));
app.use('/public', express.static(PUBLIC_DIR, publicStaticOptions));

app.use(express.static(PUBLIC_DIR, publicStaticOptions));

// админ

app.use('/admin/api/auth', authRoutes);

app.use('/admin/api/uploads', uploadRoutes);

app.use('/admin', adminCatalogRoutes);

app.use('/admin', adminRoutes);

// seo

app.get('/robots.txt', (req, res) => {
  const siteOrigin = getSiteOrigin(req);
  const sitemapUrl = new URL('/sitemap.xml', `${siteOrigin}/`).href;
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /admin/api/',
    'Disallow: /api/',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /admin/api/',
    'Disallow: /api/',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');

  res.set('Cache-Control', 'public, max-age=3600');

  return res.type('text/plain').send(content);
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const siteOrigin = getSiteOrigin(req);
    const entries = await getSitemapEntries(siteOrigin);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n');

    res.set(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=3600',
    );

    return res.type('application/xml').send(xml);
  } catch (error) {
    return next(error);
  }
});

// паблик пейджс

app.get('/', (req, res, next) => {
  return sendSeoPage(req, res, next, 'index.html', '/');
});

app.get('/services', (req, res, next) => {
  return sendSeoPage(
    req,
    res,
    next,
    path.join('services', 'services.html'),
    '/services',
  );
});

app.get('/services/:slug', async (req, res, next) => {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    const slug = normalizeDynamicSlug(rawSlug);

    if (!slug) {
      return sendPublicNotFound(res);
    }

    if (rawSlug !== slug) {
      return res.redirect(
        301,
        buildRedirectUrl(
          req,
          `/services/${encodeURIComponent(slug)}`,
        ),
      );
    }

    const service = getServiceBySlug(slug);

    if (!service || !service.isReady) {
      return sendPublicNotFound(res);
    }

    const html = await createServicePageHtml(req, service);

    setDynamicPageCache(res);

    return res.type('html').send(html);
  } catch (error) {
    return next(error);
  }
});

app.get('/works', (req, res, next) => {
  return sendSeoPage(
    req,
    res,
    next,
    path.join('works', 'work-main.html'),
    '/works',
  );
});

app.get('/works/:slug', async (req, res, next) => {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    const slug = normalizeDynamicSlug(rawSlug);

    if (!slug) {
      return sendPublicNotFound(res);
    }

    if (rawSlug !== slug) {
      return res.redirect(
        301,
        buildRedirectUrl(req, `/works/${encodeURIComponent(slug)}`),
      );
    }

    const work = await prisma.work.findFirst({
      where: {
        slug,
        isPublished: true,
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
        gallery: true,
        isPublished: true,
        showOnHome: true,
        createdAt: true,
        updatedAt: true,
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
      },
    });

    if (!work) {
      return sendPublicNotFound(res);
    }

    const html = await createWorkPageHtml(req, work);

    setDynamicPageCache(res);

    return res.type('html').send(html);
  } catch (error) {
    return next(error);
  }
});

app.get('/blog', (req, res, next) => {
  return sendSeoPage(req, res, next, path.join('blog', 'blog.html'), '/blog');
});

app.get('/blog/:slug', async (req, res, next) => {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    const slug = normalizeDynamicSlug(rawSlug);

    if (!slug) {
      return sendPublicNotFound(res);
    }

    if (rawSlug !== slug) {
      return res.redirect(
        301,
        buildRedirectUrl(req, `/blog/${encodeURIComponent(slug)}`),
      );
    }

    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
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
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        category: true,
        categorySlug: true,
        coverImage: true,
        coverAlt: true,
        readingTime: true,
        authorName: true,
        authorRole: true,
        expertNote: true,
        seoTitle: true,
        seoDescription: true,
        isPublished: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!post) {
      return sendPublicNotFound(res);
    }

    const html = await createArticlePageHtml(req, post);

    setDynamicPageCache(res);

    return res.type('html').send(html);
  } catch (error) {
    return next(error);
  }
});

app.get('/privacy-policy', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'privacy-policy.html'));
});
app.get('/contacts', (req, res, next) => {
  return sendSeoPage(req, res, next, 'contacts.html', '/contacts');
});

app.get('/catalog', (req, res, next) => {
  return sendSeoPage(
    req,
    res,
    next,
    path.join('catalog', 'catalog.html'),
    '/catalog',
  );
});

app.get('/catalog/product/:slug', async (req, res, next) => {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    const slug = normalizeDynamicSlug(rawSlug);

    if (!slug) {
      return sendPublicNotFound(res);
    }

    if (rawSlug !== slug) {
      return res.redirect(
        301,
        buildRedirectUrl(req, `/catalog/product/${encodeURIComponent(slug)}`),
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        slug,
        isPublished: true,
        category: {
          isPublished: true,
        },
        variants: {
          some: {
            isActive: true,
          },
        },
        images: {
          some: {},
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        badge: true,
        sku: true,
        seoTitle: true,
        seoDescription: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoPath: true,
          },
        },
        variants: {
          where: {
            isActive: true,
          },
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
            name: true,
            sku: true,
            price: true,
            oldPrice: true,
            sortOrder: true,
          },
        },
        images: {
          orderBy: [
            {
              isMain: 'desc',
            },
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
            isMain: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      return sendPublicNotFound(res);
    }

    const html = await createProductPageHtml(req, product);

    setDynamicPageCache(res);

    return res.type('html').send(html);
  } catch (error) {
    return next(error);
  }
});

app.get('/cart', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'cart.html'));
});

app.get('/checkout', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'checkout.html'));
});

app.get('/order-success', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'order-success.html'));
});

// публ апи

app.get('/api/health', (req, res) => {
  return res.json({
    ok: true,
    message: 'NADIA API is working',
  });
});

// заявка создание
app.post('/api/leads', leadLimiter, validateOrigin, async (req, res, next) => {
  try {
    const company = String(req.body?.company || '').trim();

    if (company) {
      /*
       * Боту возвращаем успешный ответ,
       * но ничего не сохраняем.
       */
      return res.status(201).json({
        ok: true,
        message: 'Заявка отправлена',
      });
    }

    const parsed = leadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Проверьте правильность заполнения формы.',
      });
    }

    const phone = normalizeRussianPhone(parsed.data.phone);

    if (!phone) {
      return res.status(400).json({
        message: 'Введите корректный номер телефона.',
      });
    }

    const lead = await prisma.lead.create({
      data: {
        name: parsed.data.name,
        phone,
        service: parsed.data.service,
        message: parsed.data.message,
        source: parsed.data.source,

        consentAccepted: true,
        consentAcceptedAt: new Date(),
      },
    });

    try {
      await sendLeadEmail(lead);

      console.log(`Заявка №${lead.id} сохранена, письмо отправлено`);
    } catch (mailError) {
      console.error(
        `Заявка №${lead.id} сохранена, ` + `но письмо не отправлено:`,
        mailError.message,
      );
    }

    return res.status(201).json({
      ok: true,
      message: 'Заявка отправлена',
    });
  } catch (error) {
    return next(error);
  }
});

// публичный API

app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api', blogRoutes);
app.use('/api', publicRoutes);

// 404

app.use('/admin/api', (req, res) => {
  return res.status(404).json({
    message: 'Admin API route not found',
  });
});

app.use('/api', (req, res) => {
  return res.status(404).json({
    message: 'API route not found',
  });
});

app.use((req, res) => {
  return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// ошибки

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    message: 'Произошла ошибка сервера. Попробуйте ещё раз.',
  });
});

//  SHUTDOWN

async function shutdown(signal) {
  console.log(`${signal}: завершение работы NADIA server`);

  await prisma.$disconnect();

  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});

//  START

app.listen(PORT, async () => {
  console.log(`NADIA server started: http://localhost:${PORT}`);

  try {
    await smtpTransporter.verify();

    console.log('SMTP готов к отправке писем');
  } catch (error) {
    console.error('SMTP не прошёл проверку:', error.message);
  }
});
