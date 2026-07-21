# Культура волос

Сайт студии «Культура волос»: публичные страницы, каталог, заявки, заказы и административная панель.

## Требования

- Node.js 22.12 или новее
- npm
- SQLite

## Локальный запуск

```cmd
copy .env.example .env
npm ci
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Перед запуском заполните `.env`. Для production обязательно задайте `SITE_URL` и `APP_ORIGIN` фактическим HTTPS-адресом сайта.

Локальная база, `.env`, `node_modules` и загруженные через админку файлы не должны попадать в Git.


## Production

```cmd
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm start
```

Перед деплоем убедитесь, что опубликованные работы не ссылаются на отсутствующие изображения.
