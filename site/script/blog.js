'use strict';

const BLOG_API_URL = '/api/blog-posts?status=published';
const BLOG_ARTICLE_PAGE_URL = '/public/blog/article.html';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSafe();
  initSmoothAnchorScroll();
  initBlogHero();
  initBlogArticles();
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

function initBlogHero() {
  const hero = document.querySelector('.js-blog-hero');
  if (!hero) return;

  const items = hero.querySelectorAll('.js-blog-hero-reveal');
  const image = hero.querySelector('.blog-hero__bg img');

  if (!items.length) return;

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

  gsap.set(items, {
    y: 38,
    autoAlpha: 0,
    filter: 'blur(14px)',
  });

  if (image) {
    gsap.set(image, {
      scale: 1.06,
      transformOrigin: 'center center',
    });
  }

  const tl = gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
  });

  tl.to(items, {
    y: 0,
    autoAlpha: 1,
    filter: 'blur(0px)',
    duration: 1.15,
    stagger: 0.13,
    delay: 0.15,
    clearProps: 'filter',
  });

  if (image) {
    tl.to(
      image,
      {
        scale: 1.02,
        duration: 2,
        ease: 'power2.out',
      },
      0
    );
  }
}

function initBlogArticles() {
  const root = document.querySelector('[data-blog-list]');
  if (!root) return;

  const grid = root.querySelector('[data-blog-grid]');
  const loading = root.querySelector('[data-blog-loading]');
  const error = root.querySelector('[data-blog-error]');
  const empty = root.querySelector('[data-blog-empty]');
  const filters = root.querySelectorAll('[data-blog-filter]');

  if (!grid) return;

  const state = {
    posts: [],
    activeFilter: 'all',
  };

  const setLoading = (isLoading) => {
    if (loading) loading.hidden = !isLoading;
  };

  const setError = (isError) => {
    if (error) error.hidden = !isError;
  };

  const setEmpty = (isEmpty) => {
    if (empty) empty.hidden = !isEmpty;
  };

  const render = () => {
    const filteredPosts =
      state.activeFilter === 'all'
        ? state.posts
        : state.posts.filter((post) => post.categorySlug === state.activeFilter);

    grid.innerHTML = '';

    setEmpty(!filteredPosts.length);
    setError(false);

    if (!filteredPosts.length) return;

    grid.innerHTML = filteredPosts.map(createBlogCardTemplate).join('');

    initBlogCardImages(grid);
    revealBlogCards(grid);
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      const filterValue = button.dataset.blogFilter || 'all';

      state.activeFilter = filterValue;

      filters.forEach((filterButton) => {
        filterButton.classList.toggle(
          'is-active',
          filterButton === button
        );
      });

      render();
    });
  });

  const loadPosts = async () => {
    setLoading(true);
    setError(false);
    setEmpty(false);

    try {
      const response = await fetch(BLOG_API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Blog API error: ${response.status}`);
      }

      const payload = await response.json();
      const posts = normalizeBlogPosts(payload);

      state.posts = posts.filter((post) => post.isPublished !== false);

      render();
    } catch (err) {
      console.error(err);

      grid.innerHTML = '';
      setError(true);
      setEmpty(false);
    } finally {
      setLoading(false);
    }
  };

  loadPosts();
}

function normalizeBlogPosts(payload) {
  const rawPosts = Array.isArray(payload)
    ? payload
    : payload.posts || payload.articles || payload.data || [];

  return rawPosts
    .map((post) => {
      const title = post.title || post.name || 'Без названия';
      const slug = post.slug || post.id || '';
      const category = post.category || 'Журнал';
      const categorySlug = normalizeCategorySlug(
        post.categorySlug || post.category_slug || post.category || ''
      );

      return {
        id: post.id || slug,
        slug,
        title,
        excerpt:
          post.excerpt ||
          post.description ||
          post.preview ||
          'Материал из журнала эстетики NADIA HAIR.',
        category,
        categorySlug,
        coverImage:
          post.coverImage ||
          post.cover_image ||
          post.image ||
          post.photo ||
          '/site/img/blog/blog-hero.png',
        publishedAt:
          post.publishedAt ||
          post.published_at ||
          post.createdAt ||
          post.created_at ||
          '',
        readingTime:
          post.readingTime ||
          post.reading_time ||
          post.readTime ||
          '3 мин',
        isPublished:
          post.isPublished ??
          post.is_published ??
          post.published ??
          true,
      };
    })
    .filter((post) => post.slug);
}

function createBlogCardTemplate(post) {
  const postUrl = `${BLOG_ARTICLE_PAGE_URL}?slug=${encodeURIComponent(
    post.slug
  )}`;

  const dateLabel = formatBlogDate(post.publishedAt);
  const dateAttribute = post.publishedAt
    ? ` datetime="${escapeHtml(post.publishedAt)}"`
    : '';

  return `
    <article class="blog-card js-blog-card" data-category="${escapeHtml(
      post.categorySlug
    )}">
      <a class="blog-card__link" href="${postUrl}" aria-label="Читать статью: ${escapeHtml(
        post.title
      )}">
        <div class="blog-card__image">
          <img
            src="${escapeHtml(post.coverImage)}"
            alt="${escapeHtml(post.title)}"
            loading="lazy"
          />
        </div>

        <div class="blog-card__body">
          <div class="blog-card__meta">
            <span>${escapeHtml(post.category)}</span>
            ${
              dateLabel
                ? `<time${dateAttribute}>${escapeHtml(dateLabel)}</time>`
                : ''
            }
          </div>

          <h3 class="blog-card__title">${escapeHtml(post.title)}</h3>

          <p class="blog-card__excerpt">${escapeHtml(post.excerpt)}</p>

          <div class="blog-card__bottom">
            <span class="blog-card__read-time">${escapeHtml(
              post.readingTime
            )}</span>
            <span class="blog-card__more">Читать статью</span>
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

        if (wrapper) {
          wrapper.classList.add('is-empty');
        }

        image.remove();
      },
      { once: true }
    );
  });
}

function revealBlogCards(container) {
  const cards = container.querySelectorAll('.js-blog-card');

  if (!cards.length) return;

  if (!window.gsap) {
    cards.forEach((card) => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });

    return;
  }

  gsap.set(cards, {
    y: 28,
    autoAlpha: 0,
  });

  gsap.to(cards, {
    y: 0,
    autoAlpha: 1,
    duration: 0.85,
    stagger: 0.08,
    ease: 'power3.out',
  });
}

function normalizeCategorySlug(value) {
  const normalizedValue = String(value).trim().toLowerCase();

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

//  скролл

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
