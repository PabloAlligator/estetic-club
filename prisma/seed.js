'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await seedBlogPosts();
  await seedWorks();
}

async function seedBlogPosts() {
  const posts = [
    {
      slug: 'kak-sohranit-cvet-posle-okrashivaniya',
      title: 'Как сохранить цвет после окрашивания',
      excerpt:
        'Разбираем мягкий домашний уход, температуру воды и средства, которые помогают цвету оставаться красивым дольше.',
      content: `
        <p>Красивый цвет после окрашивания держится дольше, если сразу подобрать мягкий уход и не перегружать волосы агрессивными средствами.</p>
        <p>Первое правило — использовать шампунь для окрашенных волос, не мыть голову слишком горячей водой и обязательно добавлять кондиционер или маску.</p>
        <p>Также важно не использовать слишком горячий фен без термозащиты. Волосы после окрашивания требуют более деликатного отношения.</p>
      `,
      category: 'Окрашивание',
      categorySlug: 'coloring',
      coverImage: '/site/img/blog/blog-hero.png',
      readingTime: '4 мин',
      isPublished: true,
      publishedAt: new Date('2026-07-07T10:00:00.000Z'),
    },
    {
      slug: 'domashniy-uhod-posle-salona',
      title: 'Домашний уход после салона',
      excerpt:
        'Что делать дома, чтобы волосы оставались мягкими, блестящими и ухоженными не только в день визита.',
      content: `
        <p>Домашний уход — это продолжение салонного результата. Он помогает сохранить мягкость, блеск и аккуратный внешний вид волос.</p>
        <p>После визита в салон важно использовать подходящий шампунь, кондиционер, маску и термозащиту.</p>
      `,
      category: 'Домашний уход',
      categorySlug: 'home-care',
      coverImage: '/site/img/blog/blog-hero.png',
      readingTime: '3 мин',
      isPublished: true,
      publishedAt: new Date('2026-07-06T10:00:00.000Z'),
    },
    {
      slug: 'chto-takoe-airtouch',
      title: 'Что такое AirTouch и кому он подходит',
      excerpt:
        'Понятно и по-человечески о технике AirTouch: какой результат она даёт, кому подходит и почему выглядит мягко, дорого и естественно.',
      content: `
    <p class="article-lead">Дорогие друзья, всем привет. Сегодня я расскажу вам, что такое AirTouch, кому подходит эта техника и почему она уже много лет остаётся одним из самых красивых вариантов окрашивания.</p>

    <p>За моей спиной более 200 завершённых процедур AirTouch, и я точно могу сказать: это не просто модное название. Это техника, которая помогает создать мягкий, естественный и очень аккуратный переход цвета без грубых полос и резкого контраста.</p>

    <p>Главная особенность AirTouch в том, что мастер работает не со всей прядью целиком. Часть коротких волос аккуратно выдувается феном, а осветляющий состав наносится только на выбранную часть полотна. Благодаря этому результат получается более плавным, воздушным и дорогим визуально.</p>

    <h2>Какой результат даёт AirTouch</h2>

    <p>AirTouch чаще всего выбирают девушки, которые хотят стать светлее, но при этом сохранить натуральность образа. После такой техники волосы выглядят живыми, объёмными и сияющими, а цвет не выглядит как плотная однотонная покраска.</p>

    <p>Очень важный плюс — окрашивание красиво отрастает. При правильной работе нет жёсткой линии у корней, поэтому образ остаётся аккуратным даже спустя несколько месяцев после процедуры.</p>

    <blockquote>
      <p>AirTouch — это не про “просто стать блондинкой”. Это про мягкий свет в волосах, чистый оттенок и ощущение дорогого ухоженного образа.</p>
    </blockquote>

    <h2>Кому подходит AirTouch</h2>

    <p>Эта техника хорошо подходит тем, кто хочет:</p>

    <ul>
      <li>освежить образ без резкой смены цвета;</li>
      <li>получить мягкий блонд или светлые переливы;</li>
      <li>визуально добавить волосам объём и глубину;</li>
      <li>избежать грубой полосы при отрастании;</li>
      <li>носить окрашивание дольше и приходить на коррекцию реже.</li>
    </ul>

    <p>AirTouch особенно красиво смотрится на средней и длинной длине, потому что на таком полотне лучше раскрываются переходы, растяжка цвета и игра света.</p>

    <h2>Кому техника может не подойти</h2>

    <p>Важно честно сказать: AirTouch подходит не всем и не всегда. Если волосы сильно повреждены, недавно были окрашены бытовыми красителями или уже пережили агрессивное осветление, сначала может понадобиться восстановление и диагностика.</p>

    <p>Я всегда оцениваю состояние волос перед процедурой. Для меня важно не просто получить красивое фото “после”, а сохранить качество волос, мягкость, блеск и комфорт клиента после окрашивания.</p>

    <h2>Почему AirTouch нельзя делать быстро</h2>

    <p>AirTouch — это трудоёмкая техника. Здесь важны аккуратные разделения, контроль фона осветления, грамотное тонирование и понимание, как цвет будет смотреться именно на ваших волосах.</p>

    <p>Такая работа может занимать несколько часов, и это нормально. Красивый результат требует времени, внимания и спокойной последовательности.</p>

    <h2>Как ухаживать после AirTouch</h2>

    <p>После окрашивания особенно важно использовать мягкий домашний уход: шампунь для окрашенных волос, кондиционер, маску и термозащиту. Светлые оттенки любят бережность, поэтому горячие инструменты без защиты лучше исключить.</p>

    <p>Если уход подобран правильно, цвет дольше остаётся чистым, волосы выглядят плотнее, а результат после салона сохраняется намного красивее.</p>

    <h2>Мой главный совет</h2>

    <p>Не выбирайте AirTouch только по красивой фотографии. Лучше приходите на консультацию, чтобы мы посмотрели вашу базу, историю окрашиваний, качество волос и желаемый результат.</p>

    <p>Тогда окрашивание будет не просто “как на картинке”, а именно вашим: мягким, гармоничным и подходящим под внешность, стиль и состояние волос.</p>
  `,
      category: 'AirTouch',
      categorySlug: 'airtouch',
      coverImage: '/site/img/blog/blog-hero.png',
      readingTime: '6 мин',
      isPublished: true,
      publishedAt: new Date('2026-07-05T10:00:00.000Z'),
    },
  ];

  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: {
        slug: post.slug,
      },
      update: post,
      create: post,
    });

    console.log(`Статья добавлена/обновлена: ${post.title}`);
  }
}

async function seedWorks() {
  const works = [
    {
      slug: 'airtouch-natural-base',
      title: 'Аиртач на натуральной базе',
      excerpt: 'Мягкая растяжка, чистый блонд и сохранение качества волос.',
      category: 'Аиртач',
      categorySlug: 'airtouch',

      beforeImage: '/site/img/img1bef.jpg',
      afterImage: '/site/img/img2aft.jpg',

      technique: 'AirTouch',
      duration: '5 часов',

      heroImage: '/site/img/img2aft.jpg',
      experienceImage: '/site/img/main-hero-bg.png',
      heroQuote: 'Это не просто цвет. Это ощущение себя красивой.',
      story:
        'Задача была сохранить мягкость образа, добавить светлые переливы и сделать цвет чище, не перегружая волосы осветлением. Мы начали с диагностики полотна, аккуратно распределили пряди и подобрали оттенок так, чтобы результат выглядел мягко, дорого и естественно.',

      gallery: JSON.stringify([
        '/site/img/img2aft.jpg',
        '/site/img/main-hero-bg.png',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
        '/site/img/pablito.jpg',
      ]),

      createdAt: new Date('2026-07-09T10:00:00.000Z'),

      isPublished: true,
      showOnHome: true,
    },

    {
      slug: 'total-blond-clean-shade',
      title: 'Тотал блонд без желтизны',
      excerpt: 'Чистый светлый оттенок, мягкий переход и визуальная плотность.',
      category: 'Тотал блонд',
      categorySlug: 'total-blond',

      beforeImage: '/site/img/works/total-blond-01-before.webp',
      afterImage: '/site/img/works/total-blond-01-after.webp',

      technique: 'Тотал блонд',
      duration: '6 часов',

      heroImage: '/site/img/works/total-blond-01-after.webp',
      experienceImage: '/site/img/works/total-blond-01-after.webp',
      heroQuote: 'Чистый оттенок, мягкость и ощущение дорогого блонда.',
      story:
        'В этой работе главной задачей было получить чистый светлый оттенок без жёлтого фона и при этом сохранить визуальную плотность волос. Мы работали поэтапно, контролируя фон осветления и финальное тонирование.',

      gallery: JSON.stringify([
        '/site/img/works/total-blond-01-after.webp',
        '/site/img/works/total-blond-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-08T10:00:00.000Z'),

      isPublished: true,
      showOnHome: true,
    },

    {
      slug: 'shatush-soft-color',
      title: 'Шатуш в мягкой гамме',
      excerpt: 'Естественные переливы и аккуратный эффект выгоревших прядей.',
      category: 'Шатуш',
      categorySlug: 'shatush',

      beforeImage: '/site/img/works/shatush-01-before.webp',
      afterImage: '/site/img/works/shatush-01-after.webp',

      technique: 'Шатуш',
      duration: '4 часа',

      heroImage: '/site/img/works/shatush-01-after.webp',
      experienceImage: '/site/img/works/shatush-01-after.webp',
      heroQuote: 'Мягкие переливы, которые выглядят естественно и дорого.',
      story:
        'Здесь мы сделали ставку на естественность: мягкие переходы, спокойную гамму и эффект лёгкого выгорания на солнце. Такой результат не выглядит резко и красиво раскрывается в движении волос.',

      gallery: JSON.stringify([
        '/site/img/works/shatush-01-after.webp',
        '/site/img/works/shatush-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-07T10:00:00.000Z'),

      isPublished: true,
      showOnHome: false,
    },

    {
      slug: 'toning-expensive-brown',
      title: 'Тонирование и дорогой блеск',
      excerpt: 'Глубокий оттенок, мягкое сияние и ухоженное полотно волос.',
      category: 'Тонирование',
      categorySlug: 'toning',

      beforeImage: '/site/img/works/toning-01-before.webp',
      afterImage: '/site/img/works/toning-01-after.webp',

      technique: 'Тонирование',
      duration: '2 часа',

      heroImage: '/site/img/works/toning-01-after.webp',
      experienceImage: '/site/img/works/toning-01-after.webp',
      heroQuote: 'Глубина оттенка и блеск, который видно сразу.',
      story:
        'Тонирование помогло сделать оттенок глубже, мягче и визуально дороже. Мы усилили блеск полотна, убрали лишнюю тусклость и сделали волосы более ухоженными на вид.',

      gallery: JSON.stringify([
        '/site/img/works/toning-01-after.webp',
        '/site/img/works/toning-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-06T10:00:00.000Z'),

      isPublished: true,
      showOnHome: true,
    },

    {
      slug: 'gray-hair-soft-blending',
      title: 'Мягкая работа с сединой',
      excerpt: 'Деликатное смешение седины с основным оттенком без грубой линии.',
      category: 'Работа с сединой',
      categorySlug: 'gray-hair',

      beforeImage: '/site/img/works/gray-hair-01-before.webp',
      afterImage: '/site/img/works/gray-hair-01-after.webp',

      technique: 'Работа с сединой',
      duration: '4 часа',

      heroImage: '/site/img/works/gray-hair-01-after.webp',
      experienceImage: '/site/img/works/gray-hair-01-after.webp',
      heroQuote: 'Деликатный результат без грубой линии и резкого контраста.',
      story:
        'В этой работе важно было не просто перекрыть седину, а мягко вписать её в общий образ. Мы сделали оттенок спокойнее, благороднее и сохранили естественное ощущение цвета.',

      gallery: JSON.stringify([
        '/site/img/works/gray-hair-01-after.webp',
        '/site/img/works/gray-hair-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-05T10:00:00.000Z'),

      isPublished: true,
      showOnHome: false,
    },

    {
      slug: 'recovery-after-lightening',
      title: 'Восстановление после осветления',
      excerpt: 'Мягкость, блеск и визуально более плотная структура волос.',
      category: 'Восстановление',
      categorySlug: 'recovery',

      beforeImage: '/site/img/works/recovery-01-before.webp',
      afterImage: '/site/img/works/recovery-01-after.webp',

      technique: 'Восстановление',
      duration: '1.5 часа',

      heroImage: '/site/img/works/recovery-01-after.webp',
      experienceImage: '/site/img/works/recovery-01-after.webp',
      heroQuote: 'Когда волосы снова выглядят мягкими, живыми и ухоженными.',
      story:
        'После осветления волосам часто не хватает плотности, мягкости и блеска. Мы сделали уходовую процедуру, чтобы визуально уплотнить полотно и вернуть ощущение ухоженности.',

      gallery: JSON.stringify([
        '/site/img/works/recovery-01-after.webp',
        '/site/img/works/recovery-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-04T10:00:00.000Z'),

      isPublished: true,
      showOnHome: false,
    },

    {
      slug: 'care-gloss-effect',
      title: 'Уход и зеркальный блеск',
      excerpt: 'Гладкие, плотные и сияющие волосы после курса ухода.',
      category: 'Уход',
      categorySlug: 'care',

      beforeImage: '/site/img/works/care-01-before.webp',
      afterImage: '/site/img/works/care-01-after.webp',

      technique: 'Уход',
      duration: '1.5 часа',

      heroImage: '/site/img/works/care-01-after.webp',
      experienceImage: '/site/img/works/care-01-after.webp',
      heroQuote: 'Блеск, мягкость и волосы, к которым хочется прикасаться.',
      story:
        'Главная задача ухода — вернуть волосам мягкость, плотность и красивое отражение света. После процедуры полотно выглядит более гладким, живым и сияющим.',

      gallery: JSON.stringify([
        '/site/img/works/care-01-after.webp',
        '/site/img/works/care-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-03T10:00:00.000Z'),

      isPublished: true,
      showOnHome: false,
    },

    {
      slug: 'reconstruction-hair-length',
      title: 'Реконструкция длины',
      excerpt: 'Бережное восстановление полотна без потери естественного движения.',
      category: 'Реконструкция',
      categorySlug: 'reconstruction',

      beforeImage: '/site/img/works/reconstruction-01-before.webp',
      afterImage: '/site/img/works/reconstruction-01-after.webp',

      technique: 'Реконструкция',
      duration: '2 часа',

      heroImage: '/site/img/works/reconstruction-01-after.webp',
      experienceImage: '/site/img/works/reconstruction-01-after.webp',
      heroQuote: 'Восстановление, которое сохраняет естественность движения.',
      story:
        'Реконструкция помогает сделать длину визуально более плотной, мягкой и ухоженной. В этой работе мы сохранили естественное движение волос и усилили ощущение здорового полотна.',

      gallery: JSON.stringify([
        '/site/img/works/reconstruction-01-after.webp',
        '/site/img/works/reconstruction-01-before.webp',
        '/site/img/contacts/services-intro3.png',
      ]),

      createdAt: new Date('2026-07-02T10:00:00.000Z'),

      isPublished: true,
      showOnHome: false,
    },
  ];

  for (const work of works) {
    await prisma.work.upsert({
      where: {
        slug: work.slug,
      },
      update: work,
      create: work,
    });

    console.log(`Работа добавлена/обновлена: ${work.title}`);
  }
}

main()
  .then(async () => {
    console.log('Seed выполнен успешно.');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Ошибка seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
