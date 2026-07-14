'use strict';

const WORK_DETAIL_DEMO = {
  slug: 'demo-beauty-story',
  title: 'Аиртач на натуральной базе',
  excerpt:
    'Мягкое осветление, чистый оттенок и естественный переход, который подчёркивает красоту волос без перегруза.',
  category: 'AirTouch',
  technique: 'AirTouch',
  duration: '5 часов',
  createdAt: '2026-07-09',
  heroImage: '/site/img/img2aft.jpg',
  experienceImage: '/site/img/contacts/services-intro3.png',
  heroQuote: 'Это не просто цвет. Это ощущение себя красивой.',
  story:
    'Задача была сохранить мягкость образа, добавить светлые переливы и сделать цвет чище, не перегружая волосы осветлением. Работа началась с диагностики полотна, подбора техники и бережного распределения прядей.',
  gallery: [
    '/site/img/main-hero-bg.png',
    '/site/img/contacts/services-intro3.png',
    '/site/img/contacts/contact-hero.png',
    '/site/img/contacts/equipment-mirror.png',
    '/site/img/contacts/equipment-wash.png',
    '/site/img/contacts/equipment-dyson.png',
    '/site/img/contacts/equipment-climazon.png',
    '/site/img/main-hero-bg.png',
  ],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

document.addEventListener('DOMContentLoaded', async () => {
  initHeader();
  initSmoothAnchorScroll();

  await initWorkDetailPage();

  initWorkDetailHero();
  initWorkDetailExperience();
  initWorkDetailFlowBackground();
});

function initHeader() {
  const header = document.querySelector('[data-header]');
  const burger = document.querySelector('[data-burger]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  if (!header || !burger || !mobileMenu) return;

  let lastScrollY = window.scrollY;
  let isTicking = false;
  let touchStartY = 0;

  function updateHeader() {
    const currentScrollY = window.scrollY;
    const isScrolled = currentScrollY > 24;
    const isScrollingDown = currentScrollY > lastScrollY;
    const isMenuOpen = header.classList.contains('is-menu-open');

    header.classList.toggle('is-scrolled', isScrolled);

    if (currentScrollY > 140 && isScrollingDown && !isMenuOpen) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }

    lastScrollY = Math.max(currentScrollY, 0);
    isTicking = false;
  }

  function requestHeaderUpdate() {
    if (isTicking) return;

    window.requestAnimationFrame(updateHeader);
    isTicking = true;
  }

  function openMobileMenu() {
    header.classList.add('is-menu-open');
    document.body.classList.add('is-lock');

    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');

    header.classList.remove('is-hidden');
  }

  function closeMobileMenu() {
    header.classList.remove('is-menu-open');
    document.body.classList.remove('is-lock');

    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
  }

  function toggleMobileMenu() {
    const isOpen = header.classList.contains('is-menu-open');

    if (isOpen) {
      closeMobileMenu();
      return;
    }

    openMobileMenu();
  }

  function closeMenuAfterScrollIntent() {
    if (!header.classList.contains('is-menu-open')) return;

    closeMobileMenu();

    if (window.scrollY > 140) {
      header.classList.add('is-hidden');
    }
  }

  burger.addEventListener('click', toggleMobileMenu);

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileMenu();
    }
  });

  window.addEventListener('scroll', requestHeaderUpdate, {
    passive: true,
  });

  window.addEventListener('wheel', closeMenuAfterScrollIntent, {
    passive: true,
  });

  document.addEventListener(
    'touchstart',
    (event) => {
      if (!header.classList.contains('is-menu-open')) return;
      if (event.target.closest('[data-burger]')) return;

      touchStartY = event.touches[0].clientY;
    },
    {
      passive: true,
    },
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!header.classList.contains('is-menu-open')) return;
      if (event.target.closest('[data-burger]')) return;

      const currentY = event.touches[0].clientY;
      const diff = Math.abs(currentY - touchStartY);

      if (diff > 12) {
        closeMenuAfterScrollIntent();
      }
    },
    {
      passive: true,
    },
  );

  updateHeader();
}

function initSmoothAnchorScroll() {
  const header = document.querySelector('[data-header]');
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  const getHeaderOffset = () => {
    if (!header) return 24;

    const headerHeight = header.getBoundingClientRect().height;

    return headerHeight + 28;
  };

  const closeMobileMenu = () => {
    if (!header) return;

    const burger = header.querySelector('[data-burger]');

    header.classList.remove('is-menu-open');
    document.body.classList.remove('is-lock');

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
    }
  };

  const scrollToTarget = (target, shouldUpdateHash = true) => {
    if (!target) return;

    const targetTop =
      target.getBoundingClientRect().top +
      window.pageYOffset -
      getHeaderOffset();

    closeMobileMenu();

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    if (shouldUpdateHash && target.id) {
      window.history.pushState(null, '', `#${target.id}`);
    }
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');

    if (!link) return;

    const href = link.getAttribute('href');

    if (!href || href === '#') return;

    let url;

    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }

    if (!url.hash) return;

    const isSamePage =
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname;

    if (!isSamePage) return;

    const targetId = decodeURIComponent(url.hash.slice(1));
    const target = document.getElementById(targetId);

    if (!target) return;

    event.preventDefault();

    scrollToTarget(target);
  });
}

async function initWorkDetailPage() {
  const work = await loadWorkDetail();

  renderWorkDetail(work);
  renderWorkGallery(work.gallery || []);

  window.setTimeout(() => {
    if (window.ScrollTrigger) {
      ScrollTrigger.refresh();
    }
  }, 150);
}

async function loadWorkDetail() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    return WORK_DETAIL_DEMO;
  }

  try {
    const response = await fetch(`/api/works/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Work detail API error: ${response.status}`);
    }

    const payload = await response.json();
    const work = payload.work || payload.item || payload.data || payload;

    return normalizeWorkDetail(work);
  } catch (error) {
    console.error(error);
    return WORK_DETAIL_DEMO;
  }
}

function normalizeWorkDetail(work) {
  const gallery = normalizeGallery(work.gallery);

  return {
    slug: work.slug || WORK_DETAIL_DEMO.slug,
    title: work.title || work.name || WORK_DETAIL_DEMO.title,
    excerpt: work.excerpt || work.description || WORK_DETAIL_DEMO.excerpt,
    category: work.category || WORK_DETAIL_DEMO.category,
    technique: work.technique || WORK_DETAIL_DEMO.technique,
    duration: work.duration || WORK_DETAIL_DEMO.duration,
    createdAt:
      work.createdAt ||
      work.created_at ||
      work.publishedAt ||
      work.published_at ||
      WORK_DETAIL_DEMO.createdAt,
    heroImage:
      work.heroImage ||
      work.hero_image ||
      work.afterImage ||
      work.after_image ||
      WORK_DETAIL_DEMO.heroImage,
    experienceImage:
      work.experienceImage ||
      work.experience_image ||
      work.heroImage ||
      work.hero_image ||
      work.afterImage ||
      work.after_image ||
      WORK_DETAIL_DEMO.experienceImage,
    heroQuote: work.heroQuote || work.hero_quote || WORK_DETAIL_DEMO.heroQuote,
    story:
      work.story ||
      work.content ||
      work.task ||
      work.result ||
      WORK_DETAIL_DEMO.story,
    gallery: gallery.length
      ? gallery
      : [
          work.afterImage || work.after_image || WORK_DETAIL_DEMO.heroImage,
          work.beforeImage || work.before_image || WORK_DETAIL_DEMO.gallery[1],
        ].filter(Boolean),
  };
}

function normalizeGallery(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function renderWorkDetail(work) {
  setText('[data-work-title]', work.title);
  setText('[data-work-excerpt]', work.excerpt);
  setText('[data-work-date]', formatWorkDate(work.createdAt));
  setText('[data-work-technique]', work.category);
  setText('[data-work-duration]', work.duration);
  setText('[data-work-story]', work.story);
  setText('[data-work-hero-quote]', work.heroQuote);

  setImage('[data-work-hero-image]', work.heroImage, work.title);
  setImage('[data-work-experience-image]', work.experienceImage, work.title);

  const pageTitle = document.querySelector('[data-page-title]');
  const pageDescription = document.querySelector('[data-page-description]');

  if (pageTitle) {
    pageTitle.textContent = `${work.title} | NADIA HAIR`;
  }

  if (pageDescription) {
    pageDescription.setAttribute('content', work.excerpt);
  }
}

function renderWorkGallery(images) {
  const gallery = document.querySelector('[data-work-gallery]');

  if (!gallery) return;

  const normalizedImages = images.length ? images : WORK_DETAIL_DEMO.gallery;

  gallery.innerHTML = normalizedImages
    .map((image, index) => {
      const modifier = getGalleryModifier(index);

      return `
        <figure class="work-detail-gallery__item ${modifier}">
          <img
            src="${escapeHtml(image)}"
            alt="Фотография преображения NADIA HAIR ${index + 1}"
            loading="lazy"
          />
        </figure>
      `;
    })
    .join('');

  initGalleryAnimation(gallery);
}

function getGalleryModifier(index) {
  const pattern = [
    'work-detail-gallery__item--large',
    '',
    '',
    'work-detail-gallery__item--tall',
    'work-detail-gallery__item--wide',
    '',
    '',
    'work-detail-gallery__item--wide',
  ];

  return pattern[index % pattern.length];
}

function initWorkDetailHero() {
  const section = document.querySelector('.js-work-detail-hero');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return;
  }

  const content = section.querySelector('.work-detail-hero__content');
  const visual = section.querySelector('.work-detail-hero__visual');
  const image = section.querySelector('.work-detail-hero__visual img');
  const quote = section.querySelector('.work-detail-hero__quote');

  if (!content || !visual || !image || !quote) return;

  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  mm.add('(min-width: 769px)', () => {
    gsap.set(content, {
      autoAlpha: 1,
      xPercent: 0,
      filter: 'blur(0px)',
      zIndex: 5,
    });

    gsap.set(visual, {
      width: '50%',
      xPercent: 0,
      zIndex: 3,
    });

    gsap.set(image, {
      scale: 1,
      xPercent: 0,
      yPercent: 0,
      objectPosition: '62% 14%',
      transformOrigin: '62% 28%',
    });

    gsap.set(quote, {
      autoAlpha: 0,
      y: 28,
      zIndex: 6,
    });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=180%',
        scrub: 1.15,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline
      .to(
        content,
        {
          autoAlpha: 0,
          xPercent: -12,
          filter: 'blur(8px)',
          duration: 0.34,
          ease: 'none',
        },
        0,
      )
      .to(
        visual,
        {
          width: '100%',
          duration: 0.58,
          ease: 'none',
        },
        0,
      )
      .to(
        image,
        {
          scale: 1.16,
          yPercent: -4,
          objectPosition: '62% 14%',
          duration: 0.82,
          ease: 'none',
        },
        0.22,
      )
      .to(
        quote,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: 'none',
        },
        0.58,
      )
      .to(
        quote,
        {
          autoAlpha: 0,
          y: -18,
          duration: 0.2,
          ease: 'none',
        },
        0.92,
      );

    if (image.complete) {
      ScrollTrigger.refresh();
    } else {
      image.addEventListener(
        'load',
        () => {
          ScrollTrigger.refresh();
        },
        {
          once: true,
        },
      );
    }

    return () => {
      timeline.kill();
    };
  });

  mm.add('(max-width: 768px)', () => {
    gsap.set([content, visual, image, quote], {
      clearProps: 'all',
    });
  });
}

function initWorkDetailExperience() {
  const section = document.querySelector('.js-work-detail-experience');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return;
  }

  const topLines = section.querySelectorAll('.js-work-detail-experience-top');
  const smallWords = section.querySelectorAll(
    '.js-work-detail-experience-small',
  );
  const text = section.querySelector('.js-work-detail-experience-text');
  const bottom = section.querySelector('.js-work-detail-experience-bottom');
  const image = section.querySelector('.work-detail-experience__visual img');

  if (!topLines.length || !smallWords.length || !text || !bottom || !image) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 68%',
      end: 'bottom 42%',
      toggleActions: 'play none none reverse',
    },
  });

  timeline
    .to(topLines, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 1.05,
      stagger: 0.16,
      ease: 'power3.out',
    })
    .to(
      smallWords,
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out',
      },
      '-=0.68',
    )
    .to(
      text,
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.9,
        ease: 'power3.out',
      },
      '-=0.42',
    )
    .to(
      bottom,
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1,
        ease: 'power3.out',
      },
      '-=0.5',
    );

  gsap.fromTo(
    image,
    {
      scale: 1.035,
    },
    {
      scale: 1,
      duration: 1.4,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 74%',
        toggleActions: 'play none none reverse',
      },
    },
  );
}

function initWorkDetailFlowBackground() {
  const wrapper = document.querySelector('[data-work-detail-flow]');
  const whiteSection = document.querySelector(
    '[data-work-detail-white-section]',
  );

  if (!wrapper || !whiteSection) return;

  const brownColor = [121, 96, 70]; // #796046
  const whiteColor = [251, 247, 240]; // #fbf7f0

  let lastColor = '';

  function getScrollProgress(element, startRatio = 0.95, endRatio = 0.34) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const start = windowHeight * startRatio;
    const end = windowHeight * endRatio;

    return clamp((start - rect.top) / (start - end), 0, 1);
  }

  function updateBackground() {
    const progress = getScrollProgress(whiteSection, 0.98, 0.42);
    const currentColor = mixColor(brownColor, whiteColor, progress);
    const [r, g, b] = currentColor;

    const nextColor = `rgb(${r}, ${g}, ${b})`;

    if (nextColor !== lastColor) {
      wrapper.style.setProperty('--work-detail-scene-bg', nextColor);
      lastColor = nextColor;
    }

    requestAnimationFrame(updateBackground);
  }

  updateBackground();
}

function initGalleryAnimation(gallery) {
  const items = gallery.querySelectorAll('.work-detail-gallery__item');

  if (!items.length) return;

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    items.forEach((item) => {
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
      item.style.filter = 'blur(0)';
    });

    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  items.forEach((item) => {
    gsap.to(item, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 88%',
        toggleActions: 'play none none reverse',
      },
    });
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (!element || !value) return;

  element.textContent = value;
}

function setImage(selector, src, alt = '') {
  const image = document.querySelector(selector);

  if (!image || !src) return;

  image.src = src;
  image.alt = alt ? `NADIA HAIR — ${alt}` : 'NADIA HAIR';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char];
  });
}

// функция даты

function formatWorkDate(value) {
  if (!value) return 'Дата не указана';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Дата не указана';
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
