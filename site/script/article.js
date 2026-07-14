'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSafe();
  initSmoothAnchorScroll();
  initArticlePage();
});

function initHeaderSafe() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const burger = header.querySelector('[data-burger]');
  const mobileMenu = header.querySelector('[data-mobile-menu]');

  let lastScrollY = window.scrollY;
  let ticking = false;

  const closeMenu = () => {
    header.classList.remove('is-menu-open');
    document.body.classList.remove('is-lock');

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
    }
  };

  const toggleMenu = () => {
    const isOpen = header.classList.contains('is-menu-open');

    header.classList.toggle('is-menu-open', !isOpen);
    document.body.classList.toggle('is-lock', !isOpen);

    if (burger) {
      burger.setAttribute('aria-expanded', String(!isOpen));
    }
  };

  if (burger && mobileMenu) {
    burger.addEventListener('click', toggleMenu);

    mobileMenu.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        closeMenu();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMenu();
      }
    });
  }

  const updateHeader = () => {
    const currentScrollY = window.scrollY;
    const isScrollingDown = currentScrollY > lastScrollY;

    header.classList.toggle('is-scrolled', currentScrollY > 20);
    header.classList.toggle(
      'is-hidden',
      isScrollingDown &&
        currentScrollY > 120 &&
        !header.classList.contains('is-menu-open')
    );

    lastScrollY = Math.max(currentScrollY, 0);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    },
    { passive: true }
  );

  updateHeader();
}

async function initArticlePage() {
  const page = document.querySelector('[data-article-page]');
  if (!page) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  const loading = document.querySelector('[data-article-loading]');
  const error = document.querySelector('[data-article-error]');
  const body = document.querySelector('[data-article-body]');

  if (!slug) {
    showArticleError();
    return;
  }

  try {
    const response = await fetch(`/api/blog-posts/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.post) {
      throw new Error(payload.message || 'Статья не найдена');
    }

    renderArticle(payload.post);
  } catch (err) {
    console.error(err);
    showArticleError();
  } finally {
    if (loading) loading.hidden = true;
  }

  function showArticleError() {
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (body) body.hidden = true;

    document.title = 'Статья не найдена | NADIA HAIR';
  }
}

function renderArticle(post) {
  const title = document.querySelector('[data-article-title]');
  const excerpt = document.querySelector('[data-article-excerpt]');
  const category = document.querySelector('[data-article-category]');
  const date = document.querySelector('[data-article-date]');
  const readingTime = document.querySelector('[data-article-reading-time]');
  const cover = document.querySelector('[data-article-cover]');
  const body = document.querySelector('[data-article-body]');

  const safeTitle = post.title || 'Статья NADIA HAIR';
  const safeExcerpt = post.excerpt || 'Материал журнала NADIA HAIR.';
  const safeCategory = post.category || 'Журнал';
  const safeReadingTime = post.readingTime || '3 мин';
  const safeCover = post.coverImage || '/site/img/blog/blog-hero.png';

  document.title = `${safeTitle} | NADIA HAIR`;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', safeExcerpt);
  }

  if (title) title.textContent = safeTitle;
  if (excerpt) excerpt.textContent = safeExcerpt;
  if (category) category.textContent = safeCategory;
  if (readingTime) readingTime.textContent = safeReadingTime;

  if (date) {
    const formattedDate = formatBlogDate(post.publishedAt || post.createdAt);

    date.textContent = formattedDate;

    if (post.publishedAt || post.createdAt) {
      date.setAttribute('datetime', post.publishedAt || post.createdAt);
    }

    if (!formattedDate) {
      date.hidden = true;
    }
  }

  if (cover) {
    cover.src = safeCover;
    cover.alt = safeTitle;
  }

  if (body) {
    body.innerHTML = post.content || `<p>${escapeHtml(safeExcerpt)}</p>`;
    body.hidden = false;
  }
}

function formatBlogDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
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

// скролл

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
      target.getBoundingClientRect().top + window.pageYOffset - getHeaderOffset();

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
