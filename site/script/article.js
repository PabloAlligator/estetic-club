'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSafe();
  initSmoothAnchorScroll();
  initArticlePage();
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

function getArticleSlug() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const pathSlug =
    pathParts[0] === 'blog' && pathParts.length === 2 ? pathParts[1] : '';
  const params = new URLSearchParams(window.location.search);
  const rawSlug = pathSlug || params.get('slug') || '';

  try {
    return decodeURIComponent(String(rawSlug)).trim().toLowerCase();
  } catch {
    return '';
  }
}

async function initArticlePage() {
  const page = document.querySelector('[data-article-page]');

  if (!page) {
    return;
  }

  const slug = getArticleSlug();

  const loading = document.querySelector('[data-article-loading]');

  const error = document.querySelector('[data-article-error]');

  const body = document.querySelector('[data-article-body]');

  if (!isValidArticleSlug(slug)) {
    showArticleError();

    return;
  }

  try {
    const response = await fetch(
      `/api/blog-posts/${encodeURIComponent(slug)}`,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json',
        },

        cache: 'no-store',
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.post) {
      if (response.status === 404) {
        showArticleError({
          title: 'Статья снята с публикации',
          description:
            'Этот материал больше не доступен. Вернитесь в журнал, чтобы посмотреть другие статьи.',
        });

        return;
      }

      throw new Error(payload.message || 'Не удалось загрузить статью');
    }

    renderArticle(payload.post, slug);
  } catch (requestError) {
    console.error('Ошибка загрузки статьи:', requestError);

    showArticleError({
      title: 'Не удалось загрузить статью',
      description:
        'Произошла ошибка соединения с сервером. Попробуйте обновить страницу.',
    });
  } finally {
    if (loading) {
      loading.hidden = true;
    }
  }

  function showArticleError({
    title = 'Статья временно недоступна',
    description = 'Не удалось загрузить материал. Попробуйте открыть страницу позже.',
  } = {}) {
    const articleTitle = document.querySelector('[data-article-title]');

    const articleExcerpt = document.querySelector('[data-article-excerpt]');

    const articleCategory = document.querySelector('[data-article-category]');

    const articleDate = document.querySelector('[data-article-date]');

    const articleReadingTime = document.querySelector(
      '[data-article-reading-time]',
    );

    const articleMedia = document.querySelector('.article-hero__media');

    const author = document.querySelector('[data-article-author]');

    const expert = document.querySelector('[data-article-expert]');

    if (loading) {
      loading.hidden = true;
    }

    if (body) {
      body.hidden = true;
    }

    if (author) {
      author.hidden = true;
    }

    if (expert) {
      expert.hidden = true;
    }

    if (error) {
      error.textContent = description;
      error.hidden = false;
    }

    if (articleTitle) {
      articleTitle.textContent = title;
    }

    if (articleExcerpt) {
      articleExcerpt.textContent = description;
    }

    if (articleCategory) {
      articleCategory.textContent = 'Журнал';
    }

    if (articleDate) {
      articleDate.hidden = true;
      articleDate.removeAttribute('datetime');
    }

    if (articleReadingTime) {
      articleReadingTime.hidden = true;
    }

    if (articleMedia) {
      articleMedia.hidden = true;
    }

    page.classList.add('is-unavailable');

    document.title = `${title} | Культура волос`;

    setMetaContent('[data-article-description]', description);

    setMetaContent('[data-article-og-title]', `${title} | Культура волос`);

    setMetaContent('[data-article-og-description]', description);

    setMetaContent('[data-article-twitter-title]', `${title} | Культура волос`);

    setMetaContent('[data-article-twitter-description]', description);

    const robotsMeta = document.querySelector('meta[name="robots"]');

    robotsMeta?.setAttribute('content', 'noindex, nofollow');
  }
}

function renderArticle(post, slug) {
  const title = document.querySelector('[data-article-title]');

  const excerpt = document.querySelector('[data-article-excerpt]');

  const category = document.querySelector('[data-article-category]');

  const date = document.querySelector('[data-article-date]');

  const readingTime = document.querySelector('[data-article-reading-time]');

  const cover = document.querySelector('[data-article-cover]');

  const body = document.querySelector('[data-article-body]');

  const author = document.querySelector('[data-article-author]');

  const authorName = document.querySelector('[data-article-author-name]');

  const authorRole = document.querySelector('[data-article-author-role]');

  const expert = document.querySelector('[data-article-expert]');

  const expertNote = document.querySelector('[data-article-expert-note]');

  const expertAuthor = document.querySelector('[data-article-expert-author]');

  const expertName = document.querySelector('[data-article-expert-name]');

  const expertRole = document.querySelector('[data-article-expert-role]');

  const articleTitle =
    String(post.title || '').trim() || 'Статья студии «Культура волос»';

  const articleExcerpt =
    String(post.excerpt || '').trim() || 'Экспертный материал студии «Культура волос».';

  const articleCategory = String(post.category || '').trim() || 'Журнал';

  const articleReadingTime = String(post.readingTime || '').trim() || '3 мин';

  const articleCover =
    String(post.coverImage || '').trim() || '/site/img/blog/blog-hero.webp';

  const articleCoverAlt = String(post.coverAlt || '').trim() || articleTitle;

  const articleAuthorName = String(post.authorName || '').trim();

  const articleAuthorRole = String(post.authorRole || '').trim();

  const articleExpertNote = String(post.expertNote || '').trim();

  if (title) {
    title.textContent = articleTitle;
  }

  if (excerpt) {
    excerpt.textContent = articleExcerpt;
  }

  if (category) {
    category.textContent = articleCategory;
  }

  if (readingTime) {
    readingTime.textContent = articleReadingTime;
  }

  renderArticleDate(date, post.publishedAt || post.createdAt);

  if (cover) {
    window.KulturaImage.apply(cover, articleCover, {
      sizes: '(max-width: 860px) 100vw, 50vw',
      loading: 'eager',
      fetchpriority: 'high',
      fallbackWidth: 1000,
      fallbackHeight: 1075,
    });

    cover.alt = articleCoverAlt;

    cover.addEventListener(
      'error',
      () => {
        window.KulturaImage.apply(cover, '/site/img/blog/blog-hero.webp', {
          sizes: '(max-width: 860px) 100vw, 50vw',
          loading: 'eager',
          fetchpriority: 'high',
        });

        cover.alt = articleTitle;
      },
      {
        once: true,
      },
    );
  }

  if (body) {
    const fallbackContent = `<p>${escapeHtml(articleExcerpt)}</p>`;

    body.innerHTML = sanitizeArticleHtml(post.content || fallbackContent);

    body.hidden = false;
  }

  if (author) {
    const hasAuthor = Boolean(articleAuthorName) || Boolean(articleAuthorRole);

    author.hidden = !hasAuthor;

    if (authorName) {
      authorName.textContent = articleAuthorName || 'Команда студии «Культура волос»';
    }

    if (authorRole) {
      authorRole.textContent = articleAuthorRole;

      authorRole.hidden = !articleAuthorRole;
    }
  }

  if (expert) {
    expert.hidden = !articleExpertNote;

    if (expertNote) {
      expertNote.textContent = articleExpertNote;
    }

    const hasExpertAuthor =
      Boolean(articleAuthorName) || Boolean(articleAuthorRole);

    if (expertAuthor) {
      expertAuthor.hidden = !hasExpertAuthor;
    }

    if (expertName) {
      expertName.textContent = articleAuthorName;
    }

    if (expertRole) {
      expertRole.textContent = articleAuthorRole;

      expertRole.hidden = !articleAuthorRole;
    }
  }

  updateArticleSeo({
    post,
    slug,
    articleTitle,
    articleExcerpt,
    articleCover,
    articleCoverAlt,
    articleAuthorName,
  });
}

function updateArticleSeo({
  post,
  slug,
  articleTitle,
  articleExcerpt,
  articleCover,
  articleCoverAlt,
  articleAuthorName,
}) {
  const seoTitle = String(post.seoTitle || '').trim() || articleTitle;

  const seoDescription =
    String(post.seoDescription || '').trim() || articleExcerpt;

  const documentTitle = /клуб эстетики/i.test(seoTitle)
    ? seoTitle
    : `${seoTitle} | Культура волос`;

  const canonicalUrl = new URL(
    `/blog/${encodeURIComponent(slug)}`,
    window.location.origin,
  );

  const absoluteCoverUrl = new URL(articleCover, window.location.origin).href;

  document.title = documentTitle;

  setMetaContent('[data-article-description]', seoDescription);

  setLinkHref('[data-article-canonical]', canonicalUrl.href);

  setMetaContent('[data-article-og-title]', documentTitle);

  setMetaContent('[data-article-og-description]', seoDescription);

  setMetaContent('[data-article-og-url]', canonicalUrl.href);

  setMetaContent('[data-article-og-image]', absoluteCoverUrl);

  setMetaContent('[data-article-og-image-alt]', articleCoverAlt);

  setMetaContent('[data-article-twitter-title]', documentTitle);

  setMetaContent('[data-article-twitter-description]', seoDescription);

  setMetaContent('[data-article-twitter-image]', absoluteCoverUrl);

  setOptionalMetaContent('[data-article-published-time]', post.publishedAt);

  setOptionalMetaContent('[data-article-modified-time]', post.updatedAt);

  updateArticleJsonLd({
    post,
    articleTitle,
    seoDescription,
    absoluteCoverUrl,
    canonicalUrl: canonicalUrl.href,
    articleAuthorName,
  });
}

function updateArticleJsonLd({
  post,
  articleTitle,
  seoDescription,
  absoluteCoverUrl,
  canonicalUrl,
  articleAuthorName,
}) {
  const script = document.querySelector('[data-article-json-ld]');

  if (!script) {
    return;
  }

  const schema = {
    '@context': 'https://schema.org',

    '@type': 'Article',

    headline: articleTitle,

    description: seoDescription,

    image: [absoluteCoverUrl],

    mainEntityOfPage: {
      '@type': 'WebPage',

      '@id': canonicalUrl,
    },

    author: articleAuthorName
      ? {
          '@type': 'Person',

          name: articleAuthorName,
        }
      : {
          '@type': 'Organization',

          name: 'Культура волос',
        },

    publisher: {
      '@type': 'Organization',

      name: 'Культура волос',

      logo: {
        '@type': 'ImageObject',

        url: new URL('/site/img/logo.png', window.location.origin).href,
      },
    },
  };

  if (post.publishedAt) {
    schema.datePublished = post.publishedAt;
  }

  if (post.updatedAt) {
    schema.dateModified = post.updatedAt;
  }

  script.textContent = JSON.stringify(schema);
}

function renderArticleDate(element, value) {
  if (!element) {
    return;
  }

  const formattedDate = formatBlogDate(value);

  if (!formattedDate) {
    element.hidden = true;

    element.removeAttribute('datetime');

    return;
  }

  element.textContent = formattedDate;

  element.setAttribute('datetime', value);

  element.hidden = false;
}

function sanitizeArticleHtml(value) {
  const template = document.createElement('template');

  template.innerHTML = String(value || '');

  const allowedTags = new Set([
    'p',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'blockquote',
    'a',
    'br',
  ]);

  const elements = Array.from(template.content.querySelectorAll('*')).reverse();

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();

      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }

      element.replaceWith(fragment);

      return;
    }

    const href =
      tagName === 'a' ? String(element.getAttribute('href') || '').trim() : '';

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });

    if (tagName === 'a' && isSafeArticleHref(href)) {
      element.setAttribute('href', href);

      element.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return template.innerHTML.trim();
}

function isSafeArticleHref(value) {
  if (!value) {
    return false;
  }

  if (value.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(value, window.location.origin);

    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function setMetaContent(selector, value) {
  const element = document.querySelector(selector);

  if (!element) {
    return;
  }

  element.setAttribute('content', String(value || '').trim());
}

function setOptionalMetaContent(selector, value) {
  const element = document.querySelector(selector);

  if (!element) {
    return;
  }

  if (!value) {
    element.removeAttribute('content');

    return;
  }

  element.setAttribute('content', value);
}

function setLinkHref(selector, value) {
  const element = document.querySelector(selector);

  if (!element) {
    return;
  }

  element.setAttribute('href', value);
}

function isValidArticleSlug(value) {
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
