'use strict';

const { randomBytes } = require('node:crypto');
const express = require('express');
const nodemailer = require('nodemailer');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('../lib/prisma');
const validateOrigin = require('../middleware/validate-origin');

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Слишком много попыток оформления. Подождите немного и попробуйте снова.',
  },
});

const orderSchema = z
  .object({
    idempotencyKey: z.string().trim().uuid(),
    customerName: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .transform((value) => value.replace(/\s+/g, ' ')),
    phone: z.string().trim().min(10).max(24),
    fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
    deliveryAddress: z.string().trim().max(300).optional().default(''),
    comment: z.string().trim().max(1200).optional().default(''),
    source: z.string().trim().max(80).optional().default('catalog'),
    company: z.string().trim().max(200).optional().default(''),
    consentAccepted: z.literal(true),
    items: z
      .array(
        z
          .object({
            variantId: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.fulfillmentMethod === 'DELIVERY' && data.deliveryAddress.length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryAddress'],
        message: 'Укажите адрес доставки',
      });
    }
  });

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
}

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

function getRequestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '')
    .slice(0, 120)
    .trim();
}

function createPublicNumber() {
  const date = new Date();
  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
  const randomPart = randomBytes(3).toString('hex').toUpperCase();

  return `NH-${datePart}-${randomPart}`;
}

function formatPrice(value) {
  return `${(Number(value || 0) / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₽`;
}

function createTransporter() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: parseBoolean(process.env.SMTP_SECURE),
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

async function sendOrderNotification(order) {
  const transporter = createTransporter();
  const to = String(process.env.LEADS_TO || process.env.SMTP_USER || '').trim();

  if (!transporter || !to) {
    return;
  }

  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-top:1px solid rgba(47,35,26,.1);font:14px Arial;color:#2f231a">
            <strong>${escapeHtml(item.productTitleSnapshot)}</strong><br>
            <span style="color:#7c6758">${escapeHtml(item.variantNameSnapshot)} · ${item.quantity} шт.</span>
          </td>
          <td align="right" style="padding:12px 0;border-top:1px solid rgba(47,35,26,.1);font:14px Arial;color:#2f231a">
            ${escapeHtml(formatPrice(item.lineTotal))}
          </td>
        </tr>
      `,
    )
    .join('');

  const fulfillment =
    order.fulfillmentMethod === 'DELIVERY'
      ? `Доставка: ${escapeHtml(order.deliveryAddress)}`
      : 'Самовывоз';

  await transporter.sendMail({
    from: String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim(),
    to,
    subject: `Новый заказ ${order.publicNumber} — Культура волос`,
    text: [
      `Новый заказ ${order.publicNumber}`,
      `Клиент: ${order.customerName}`,
      `Телефон: ${order.phone}`,
      `Получение: ${fulfillment}`,
      `Итого: ${formatPrice(order.total)}`,
      '',
      ...order.items.map(
        (item) =>
          `${item.productTitleSnapshot} / ${item.variantNameSnapshot} × ${item.quantity} — ${formatPrice(item.lineTotal)}`,
      ),
      '',
      `Комментарий: ${order.comment || 'Не указан'}`,
    ].join('\n'),
    html: `
      <!doctype html>
      <html lang="ru">
        <body style="margin:0;padding:0;background:#f6f1eb">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding:32px 14px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf5;border:1px solid rgba(47,35,26,.12);border-radius:22px;overflow:hidden">
                  <tr>
                    <td style="padding:30px 34px;background:linear-gradient(135deg,#80624f,#4c382c);color:#fffaf5">
                      <div style="font:700 10px Arial;letter-spacing:.2em;text-transform:uppercase;opacity:.7">Клуб эстетики</div>
                      <div style="margin-top:28px;font:38px Georgia">Новый заказ</div>
                      <div style="margin-top:8px;font:14px Arial;opacity:.75">${escapeHtml(order.publicNumber)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 34px">
                      <div style="font:30px Georgia;color:#2f231a">${escapeHtml(order.customerName)}</div>
                      <div style="margin-top:10px;font:15px Arial;color:#5d4a3d">${escapeHtml(order.phone)}</div>
                      <div style="margin-top:8px;font:14px Arial;color:#7c6758">${fulfillment}</div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px">
                        ${itemsHtml}
                      </table>
                      <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(47,35,26,.15);font:700 20px Arial;color:#2f231a;text-align:right">
                        Итого: ${escapeHtml(formatPrice(order.total))}
                      </div>
                      <div style="margin-top:24px;font:14px/1.7 Arial;color:#5d4a3d">
                        ${escapeHtml(order.comment || 'Комментарий не указан')}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

router.post('/', orderLimiter, validateOrigin, async (req, res, next) => {
  try {
    const parsed = orderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || 'Проверьте данные заказа',
      });
    }

    if (parsed.data.company) {
      return res.status(201).json({
        order: {
          publicNumber: 'NH-ACCEPTED',
        },
      });
    }

    const phone = normalizeRussianPhone(parsed.data.phone);

    if (!phone) {
      return res.status(400).json({
        message: 'Укажите корректный номер телефона',
      });
    }

    const existingOrder = await prisma.order.findUnique({
      where: {
        idempotencyKey: parsed.data.idempotencyKey,
      },
      select: {
        id: true,
        publicNumber: true,
        total: true,
        status: true,
        createdAt: true,
      },
    });

    if (existingOrder) {
      return res.json({
        order: existingOrder,
        repeated: true,
      });
    }

    const quantities = new Map();

    for (const item of parsed.data.items) {
      quantities.set(
        item.variantId,
        Math.min((quantities.get(item.variantId) || 0) + item.quantity, 20),
      );
    }

    const variantIds = [...quantities.keys()];

    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
        isActive: true,
        product: {
          isPublished: true,
          category: {
            isPublished: true,
          },
          images: {
            some: {},
          },
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
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
              take: 1,
              select: {
                imagePath: true,
              },
            },
          },
        },
      },
    });

    if (variants.length !== variantIds.length) {
      return res.status(409).json({
        message: 'Некоторые товары изменились или больше недоступны. Обновите корзину.',
      });
    }

    const byId = new Map(variants.map((variant) => [variant.id, variant]));
    let total = 0;
    let totalQuantity = 0;
    const orderItems = [];

    for (const [variantId, quantity] of quantities.entries()) {
      const variant = byId.get(variantId);
      const lineTotal = variant.price * quantity;

      total += lineTotal;
      totalQuantity += quantity;

      orderItems.push({
        productId: variant.product.id,
        variantId: variant.id,
        productTitleSnapshot: variant.product.title,
        productSlugSnapshot: variant.product.slug,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        imagePathSnapshot: variant.product.images[0]?.imagePath || '',
        unitPrice: variant.price,
        quantity,
        lineTotal,
      });
    }

    if (totalQuantity > 50 || total <= 0 || total > 100_000_000) {
      return res.status(400).json({
        message: 'Некорректный состав заказа',
      });
    }

    let createdOrder = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        createdOrder = await prisma.order.create({
          data: {
            publicNumber: createPublicNumber(),
            idempotencyKey: parsed.data.idempotencyKey,
            customerName: parsed.data.customerName,
            phone,
            comment: parsed.data.comment,
            fulfillmentMethod: parsed.data.fulfillmentMethod,
            deliveryAddress:
              parsed.data.fulfillmentMethod === 'DELIVERY'
                ? parsed.data.deliveryAddress
                : '',
            total,
            source: parsed.data.source,
            consentAccepted: true,
            consentAcceptedAt: new Date(),
            ipAddress: getRequestIp(req),
            userAgent: String(req.get('user-agent') || '').slice(0, 500),
            items: {
              create: orderItems,
            },
          },
          include: {
            items: true,
          },
        });

        break;
      } catch (error) {
        if (error?.code !== 'P2002' || attempt === 3) {
          throw error;
        }
      }
    }

    sendOrderNotification(createdOrder).catch((error) => {
      console.error('Не удалось отправить уведомление о заказе:', error);
    });

    return res.status(201).json({
      order: {
        id: createdOrder.id,
        publicNumber: createdOrder.publicNumber,
        total: createdOrder.total,
        status: createdOrder.status,
        createdAt: createdOrder.createdAt,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const existingOrder = await prisma.order.findUnique({
        where: {
          idempotencyKey: String(req.body?.idempotencyKey || ''),
        },
        select: {
          id: true,
          publicNumber: true,
          total: true,
          status: true,
          createdAt: true,
        },
      });

      if (existingOrder) {
        return res.json({
          order: existingOrder,
          repeated: true,
        });
      }
    }

    return next(error);
  }
});

module.exports = router;
