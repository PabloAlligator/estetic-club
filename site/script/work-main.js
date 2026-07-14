'use strict';

const WORKS_API_URL = '/api/works?status=published';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothAnchorScroll();
  initWorksHero();
  initWorksExperience();
  initWorksFlowBackground();
  initWorksCatalog();
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
    }
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
    }
  );

  updateHeader();
}

function initSmoothAnchorScroll() {
  const header = document.querySelector('[data-header]');
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
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

  if (window.location.hash) {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(targetId);

    if (!target) return;

    window.setTimeout(() => {
      scrollToTarget(target, false);
    }, 120);
  }
}

function initWorksHero() {
  const hero = document.querySelector('.js-works-hero');

  if (!hero) return;

  const revealItems = hero.querySelectorAll('.js-works-hero-reveal');
  const heroImage = hero.querySelector('.works-hero__media img');

  const showFallback = () => {
    revealItems.forEach((item) => {
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
      item.style.filter = 'blur(0)';
    });

    if (heroImage) {
      heroImage.style.transform = 'scale(1.02)';
    }
  };

  if (!window.gsap) {
    showFallback();
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) {
    showFallback();
    return;
  }

  gsap.set(revealItems, {
    y: 42,
    autoAlpha: 0,
    filter: 'blur(16px)',
  });

  if (heroImage) {
    gsap.set(heroImage, {
      scale: 1.08,
      transformOrigin: 'center center',
    });
  }

  const timeline = gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
  });

  timeline.to(revealItems, {
    y: 0,
    autoAlpha: 1,
    filter: 'blur(0px)',
    duration: 1.08,
    stagger: 0.12,
    delay: 0.1,
    clearProps: 'filter',
  });

  if (heroImage) {
    timeline.to(
      heroImage,
      {
        scale: 1.02,
        duration: 1.8,
        ease: 'power2.out',
      },
      0
    );
  }
}

function initWorksExperience() {
  const section = document.querySelector('.js-works-experience');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return;
  }

  const topLines = section.querySelectorAll('.js-works-experience-top');
  const smallWords = section.querySelectorAll('.js-works-experience-small');
  const text = section.querySelector('.js-works-experience-text');
  const bottom = section.querySelector('.js-works-experience-bottom');
  const image = section.querySelector('.works-experience__visual img');

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
      '-=0.68'
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
      '-=0.42'
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
      '-=0.5'
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
    }
  );
}

function initWorksFlowBackground() {
  const wrapper = document.querySelector('[data-works-flow]');
  const whiteSection = document.querySelector('[data-works-white-section]');

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
      wrapper.style.setProperty('--works-scene-bg', nextColor);
      lastColor = nextColor;
    }

    requestAnimationFrame(updateBackground);
  }

  updateBackground();
}

// ренедер каталога работ

function initWorksCatalog() {
  const section = document.querySelector('[data-works-section]');
  if (!section) return;

  const grid = section.querySelector('[data-works-grid]');
  const empty = section.querySelector('[data-works-empty]');
  const filters = section.querySelectorAll('[data-work-filter]');

  if (!grid) return;

  const state = {
    activeFilter: 'all',
    works: [],
  };

  const renderWorks = () => {
    const filteredWorks =
      state.activeFilter === 'all'
        ? state.works
        : state.works.filter((work) => work.categorySlug === state.activeFilter);

    grid.innerHTML = '';

    if (empty) {
      empty.hidden = Boolean(filteredWorks.length);
    }

    if (!filteredWorks.length) return;

    grid.innerHTML = filteredWorks.map(createWorkCardTemplate).join('');

    initWorkCardImages(grid);
    revealWorkCards(grid);
  };

  const loadWorks = async () => {
    try {
      const response = await fetch(WORKS_API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Works API error: ${response.status}`);
      }

      const payload = await response.json();

      state.works = normalizeWorks(payload).filter(
        (work) => work.isPublished !== false
      );

      renderWorks();
    } catch (error) {
      console.error(error);

      grid.innerHTML = '';

      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Не получилось загрузить работы. Обновите страницу.';
      }
    }
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      const filterValue = button.dataset.workFilter || 'all';

      if (filterValue === state.activeFilter) return;

      state.activeFilter = filterValue;

      filters.forEach((filterButton) => {
        filterButton.classList.toggle('is-active', filterButton === button);
      });

      animateGridChange(grid, renderWorks);
    });
  });

  loadWorks();
}

function normalizeWorks(payload) {
  const rawWorks = Array.isArray(payload)
    ? payload
    : payload.works || payload.items || payload.data || [];

  return rawWorks
    .map((work) => {
      const slug = work.slug || work.id || '';
      const title = work.title || work.name || 'Работа NADIA HAIR';

      return {
        id: work.id || slug,
        slug,
        title,
        excerpt:
          work.excerpt ||
          work.description ||
          'Результат бережной работы с волосами.',
        category: work.category || 'Работа',
        categorySlug:
          work.categorySlug ||
          work.category_slug ||
          normalizeWorkCategorySlug(work.category || ''),
        beforeImage:
          work.beforeImage ||
          work.before_image ||
          '/site/img/works/work-before-placeholder.webp',
        afterImage:
          work.afterImage ||
          work.after_image ||
          '/site/img/works/work-after-placeholder.webp',
        technique: work.technique || '',
        duration: work.duration || '',
        isPublished:
          work.isPublished ??
          work.is_published ??
          work.published ??
          true,
      };
    })
    .filter((work) => work.slug);
}

function normalizeWorkCategorySlug(value) {
  const normalizedValue = String(value).trim().toLowerCase();

  const categories = {
    аиртач: 'airtouch',
    airtouch: 'airtouch',
    'air touch': 'airtouch',

    'тотал блонд': 'total-blond',
    'total blond': 'total-blond',
    blond: 'total-blond',

    шатуш: 'shatush',
    shatush: 'shatush',

    тонирование: 'toning',
    toning: 'toning',

    'работа с сединой': 'gray-hair',
    седина: 'gray-hair',
    gray: 'gray-hair',
    'gray hair': 'gray-hair',

    восстановление: 'recovery',
    recovery: 'recovery',

    уход: 'care',
    care: 'care',

    реконструкция: 'reconstruction',
    reconstruction: 'reconstruction',
  };

  return categories[normalizedValue] || normalizedValue || 'airtouch';
}

function createWorkCardTemplate(work) {
  const detailUrl = `/public/works/work-detail.html?slug=${encodeURIComponent(
    work.slug
  )}`;

  return `
    <article class="work-card js-work-card" data-category="${escapeHtml(
      work.categorySlug
    )}">
      <a class="work-card__link" href="${detailUrl}" aria-label="Смотреть работу: ${escapeHtml(
        work.title
      )}">
        <div class="work-card__media">
          <div class="work-card__image work-card__image--after">
            <img
              src="${escapeHtml(work.afterImage)}"
              alt="После: ${escapeHtml(work.title)}"
              loading="lazy"
            />
            <span>После</span>
          </div>

          <div class="work-card__image work-card__image--before">
            <img
              src="${escapeHtml(work.beforeImage)}"
              alt="До: ${escapeHtml(work.title)}"
              loading="lazy"
            />
            <span>До</span>
          </div>
        </div>

        <div class="work-card__body">
          <span class="work-card__category">${escapeHtml(work.category)}</span>

          <h3 class="work-card__title">${escapeHtml(work.title)}</h3>

          <p class="work-card__text">${escapeHtml(work.excerpt)}</p>

          <div class="work-card__more">
            Смотреть работу <span>→</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

function initWorkCardImages(container) {
  const images = container.querySelectorAll('.work-card__image img');

  images.forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        const wrapper = image.closest('.work-card__image');

        if (wrapper) {
          wrapper.classList.add('is-empty');
        }

        image.remove();
      },
      { once: true }
    );
  });
}

function revealWorkCards(container) {
  const cards = container.querySelectorAll('.js-work-card');

  if (!cards.length) return;

  if (!window.gsap) {
    cards.forEach((card) => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });

    return;
  }

  gsap.fromTo(
    cards,
    {
      y: 34,
      autoAlpha: 0,
      scale: 0.985,
    },
    {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration: 0.72,
      stagger: 0.045,
      ease: 'power3.out',
    }
  );
}

function animateGridChange(grid, callback) {
  if (!window.gsap) {
    callback();
    return;
  }

  gsap.to(grid, {
    autoAlpha: 0,
    y: 12,
    duration: 0.22,
    ease: 'power2.out',
    onComplete: () => {
      callback();

      gsap.fromTo(
        grid,
        {
          autoAlpha: 0,
          y: 12,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
        }
      );
    },
  });
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
