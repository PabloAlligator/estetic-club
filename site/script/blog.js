'use strict';

const BLOG_API_URL = '/api/blog-posts';

const BLOG_ARTICLE_PAGE_URL = '/public/blog/article.html';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSafe();
  initSmoothAnchorScroll();
  initBlogHero();
  initBlogArticles();
});

function initHeaderSafe() {
  const header = document.querySelector('[data-header]');

  if (!header) {
    return;
  }

  const burger = header.querySelector('[data-burger]');

  const mobileMenu = header.querySelector('[data-mobile-menu]');

  let lastScrollY = window.scrollY;

  let ticking = false;

  const closeMenu = () => {
    header.classList.remove('is-menu-open');

    document.body.classList.remove('is-lock');

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');

      burger.setAttribute('aria-label', 'Открыть меню');
    }
  };

  const toggleMenu = () => {
    const isOpen = header.classList.contains('is-menu-open');

    header.classList.toggle('is-menu-open', !isOpen);

    document.body.classList.toggle('is-lock', !isOpen);

    if (burger) {
      burger.setAttribute('aria-expanded', String(!isOpen));

      burger.setAttribute(
        'aria-label',
        isOpen ? 'Открыть меню' : 'Закрыть меню',
      );
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
        !header.classList.contains('is-menu-open'),
    );

    lastScrollY = Math.max(currentScrollY, 0);

    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) {
        return;
      }

      window.requestAnimationFrame(updateHeader);

      ticking = true;
    },
    {
      passive: true,
    },
  );

  updateHeader();
}

function initBlogHero() {
  const hero = document.querySelector('.js-blog-hero');

  if (!hero) {
    return;
  }

  const items = hero.querySelectorAll('.js-blog-hero-reveal');

  const image = hero.querySelector('.blog-hero__bg img');

  if (!items.length) {
    return;
  }

  const showFallback = () => {
    items.forEach((item) => {
      item.style.opacity = '1';

      item.style.transform = 'translateY(0)';

      item.style.filter = 'blur(0)';
    });

    if (image) {
      image.style.transform = 'scale(1.02)';
    }
  };

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (!window.gsap || prefersReducedMotion) {
    showFallback();

    return;
  }

  window.gsap.set(items, {
    y: 38,
    autoAlpha: 0,
    filter: 'blur(14px)',
  });

  if (image) {
    window.gsap.set(image, {
      scale: 1.06,
      transformOrigin: 'center center',
    });
  }

  const timeline = window.gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
  });

  timeline.to(items, {
    y: 0,
    autoAlpha: 1,
    filter: 'blur(0px)',
    duration: 1.15,
    stagger: 0.13,
    delay: 0.15,
    clearProps: 'filter',
  });

  if (image) {
    timeline.to(
      image,
      {
        scale: 1.02,
        duration: 2,
        ease: 'power2.out',
      },
      0,
    );
  }
}

function initBlogArticles() {
  const root = document.querySelector('[data-blog-list]');

  if (!root) {
    return;
  }

  const grid = root.querySelector('[data-blog-grid]');

  const loading = root.querySelector('[data-blog-loading]');

  const error = root.querySelector('[data-blog-error]');

  const empty = root.querySelector('[data-blog-empty]');

  const filters = root.querySelectorAll('[data-blog-filter]');

  if (!grid) {
    return;
  }

  const state = {
    posts: [],
    activeFilter: 'all',
    isLoading: false,
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      if (state.isLoading) {
        return;
      }

      state.activeFilter = String(button.dataset.blogFilter || 'all');

      filters.forEach((filterButton) => {
        const isActive = filterButton === button;

        filterButton.classList.toggle('is-active', isActive);

        filterButton.setAttribute('aria-pressed', String(isActive));
      });

      renderPosts();
    });
  });

  loadPosts();

  async function loadPosts() {
    setLoading(true);

    try {
      const response = await fetch(BLOG_API_URL, {
        method: 'GET',

        headers: {
          Accept: 'application/json',
        },

        cache: 'no-store',
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.message || `Blog API error: ${response.status}`,
        );
      }

      state.posts = normalizeBlogPosts(payload).filter(
        (post) => post.isPublished !== false,
      );

      renderPosts();
    } catch (requestError) {
      console.error('Ошибка загрузки статей:', requestError);

      state.posts = [];

      grid.innerHTML = '';

      setError(true);

      setEmpty(false);
    } finally {
      setLoading(false);
    }
  }

  function renderPosts() {
    const filteredPosts =
      state.activeFilter === 'all'
        ? state.posts
        : state.posts.filter(
            (post) => post.categorySlug === state.activeFilter,
          );

    grid.innerHTML = '';

    setError(false);

    setEmpty(!filteredPosts.length);

    if (!filteredPosts.length) {
      grid.setAttribute('aria-busy', 'false');

      return;
    }

    grid.innerHTML = filteredPosts.map(createBlogCardTemplate).join('');

    grid.setAttribute('aria-busy', 'false');

    initBlogCardImages(grid);

    revealBlogCards(grid);
  }

  function setLoading(isLoading) {
    state.isLoading = isLoading;

    if (loading) {
      loading.hidden = !isLoading;
    }

    grid.setAttribute('aria-busy', String(isLoading));

    filters.forEach((button) => {
      button.disabled = isLoading;
    });

    if (isLoading) {
      setError(false);

      setEmpty(false);
    }
  }

  function setError(isError) {
    if (error) {
      error.hidden = !isError;
    }
  }

  function setEmpty(isEmpty) {
    if (empty) {
      empty.hidden = !isEmpty;
    }
  }
}

function normalizeBlogPosts(payload) {
  const rawPosts = Array.isArray(payload)
    ? payload
    : payload.posts || payload.articles || payload.data || [];

  if (!Array.isArray(rawPosts)) {
    return [];
  }

  return rawPosts
    .map((post) => {
      const slug = String(post.slug || '').trim();

      const title = String(post.title || '').trim() || 'Без названия';

      const category = String(post.category || '').trim() || 'Журнал';

      const categorySlug = normalizeCategorySlug(
        post.categorySlug || post.category_slug || category,
      );

      const coverImage =
        String(post.coverImage || post.cover_image || '').trim() ||
        '/site/img/blog/blog-hero.png';

      const coverAlt =
        String(post.coverAlt || post.cover_alt || '').trim() || title;

      return {
        id: post.id || slug,

        slug,

        title,

        excerpt:
          String(
            post.excerpt || post.description || post.preview || '',
          ).trim() || 'Материал из журнала Клуба Эстетики.',

        category,

        categorySlug,

        coverImage,

        coverAlt,

        publishedAt:
          post.publishedAt ||
          post.published_at ||
          post.createdAt ||
          post.created_at ||
          '',

        readingTime:
          String(
            post.readingTime || post.reading_time || post.readTime || '',
          ).trim() || '3 мин',

        isPublished:
          post.isPublished ?? post.is_published ?? post.published ?? true,
      };
    })
    .filter((post) => isValidBlogSlug(post.slug));
}

function createBlogCardTemplate(post) {
  const postUrl =
    `${BLOG_ARTICLE_PAGE_URL}?slug=` + encodeURIComponent(post.slug);

  const dateLabel = formatBlogDate(post.publishedAt);

  const dateAttribute =
    post.publishedAt && dateLabel
      ? ` datetime="${escapeHtml(post.publishedAt)}"`
      : '';

  return `
    <article
      class="blog-card js-blog-card"
      data-category="${escapeHtml(post.categorySlug)}"
    >
      <a
        class="blog-card__link"
        href="${postUrl}"
        aria-label="Читать статью: ${escapeHtml(post.title)}"
      >
        <div class="blog-card__image">
          <img
            src="${escapeHtml(post.coverImage)}"
            alt="${escapeHtml(post.coverAlt)}"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="blog-card__body">
          <div class="blog-card__meta">
            <span>
              ${escapeHtml(post.category)}
            </span>

            ${
              dateLabel
                ? `
                  <time${dateAttribute}>
                    ${escapeHtml(dateLabel)}
                  </time>
                `
                : ''
            }
          </div>

          <h3 class="blog-card__title">
            ${escapeHtml(post.title)}
          </h3>

          <p class="blog-card__excerpt">
            ${escapeHtml(post.excerpt)}
          </p>

          <div class="blog-card__bottom">
            <span class="blog-card__read-time">
              ${escapeHtml(post.readingTime)}
            </span>

            <span class="blog-card__more">
              Читать статью
            </span>
          </div>
        </div>
      </a>
    </article>
  `;
}

function initBlogCardImages(container) {
  const images = container.querySelectorAll('.blog-card__image img');

  images.forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        const wrapper = image.closest('.blog-card__image');

        wrapper?.classList.add('is-empty');

        image.remove();
      },
      {
        once: true,
      },
    );
  });
}

function revealBlogCards(container) {
  const cards = container.querySelectorAll('.js-blog-card');

  if (!cards.length) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (!window.gsap || prefersReducedMotion) {
    cards.forEach((card) => {
      card.style.opacity = '1';

      card.style.transform = 'translateY(0)';
    });

    return;
  }

  window.gsap.set(cards, {
    y: 28,
    autoAlpha: 0,
  });

  window.gsap.to(cards, {
    y: 0,
    autoAlpha: 1,
    duration: 0.85,
    stagger: 0.08,
    ease: 'power3.out',
  });
}

function normalizeCategorySlug(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  const categories = {
    уход: 'hair-care',

    'уход за волосами': 'hair-care',

    hair: 'hair-care',

    'hair-care': 'hair-care',

    окрашивание: 'coloring',

    color: 'coloring',

    coloring: 'coloring',

    airtouch: 'airtouch',

    'air touch': 'airtouch',

    'домашний уход': 'home-care',

    home: 'home-care',

    'home-care': 'home-care',
  };

  return categories[normalizedValue] || normalizedValue || 'hair-care';
}

function isValidBlogSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
}

function formatBlogDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',

    month: 'long',

    year: 'numeric',

    timeZone: 'Asia/Krasnoyarsk',
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',

      '<': '&lt;',

      '>': '&gt;',

      '"': '&quot;',

      "'": '&#039;',
    };

    return entities[character];
  });
}

// скролл

function initSmoothAnchorScroll() {
  const header = document.querySelector('[data-header]');

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  const getHeaderOffset = () => {
    if (!header) {
      return 24;
    }

    return header.getBoundingClientRect().height + 28;
  };

  const closeMobileMenu = () => {
    if (!header) {
      return;
    }

    const burger = header.querySelector('[data-burger]');

    header.classList.remove('is-menu-open');

    document.body.classList.remove('is-lock');

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');

      burger.setAttribute('aria-label', 'Открыть меню');
    }
  };

  const scrollToTarget = (target, shouldUpdateHash = true) => {
    if (!target) {
      return;
    }

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

    if (!link) {
      return;
    }

    const href = link.getAttribute('href');

    if (!href || href === '#') {
      return;
    }

    let url;

    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }

    const isSamePage =
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname;

    if (!url.hash || !isSamePage) {
      return;
    }

    const targetId = decodeURIComponent(url.hash.slice(1));

    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();

    scrollToTarget(target);
  });

  if (!window.location.hash) {
    return;
  }

  const targetId = decodeURIComponent(window.location.hash.slice(1));

  const target = document.getElementById(targetId);

  if (!target) {
    return;
  }

  window.setTimeout(() => {
    scrollToTarget(target, false);
  }, 120);
}
