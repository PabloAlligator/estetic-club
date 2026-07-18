'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('./lib/prisma');

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

app.use('/site', express.static(SITE_DIR));
app.use('/public', express.static(PUBLIC_DIR));

app.use(express.static(PUBLIC_DIR));

// админ

app.use('/admin/api/auth', authRoutes);

app.use('/admin/api/uploads', uploadRoutes);

app.use('/admin', adminCatalogRoutes);

app.use('/admin', adminRoutes);

// паблик пейджс

app.get('/', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get(['/catalog', '/catalog/'], (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'catalog', 'catalog.html'));
});

app.get('/catalog/product/:slug', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'catalog', 'product.html'));
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
  return res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
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
