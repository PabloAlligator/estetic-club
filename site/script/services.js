'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothAnchorScroll();
  initServicesBackground();
  initServicesReveal();
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

// хедер

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

    lastScrollY = currentScrollY;
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
    } else {
      openMobileMenu();
    }
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

// скролл

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

  if (window.location.hash) {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(targetId);

    if (!target) return;

    window.setTimeout(() => {
      scrollToTarget(target, false);
    }, 120);
  }
}

// переход фона

function initServicesBackground() {
  const flow = document.querySelector('[data-services-flow]');
  const transitionTarget = document.querySelector(
    '.services-catalog, .service-detail-intro',
  );

  if (!flow || !transitionTarget) return;

  const darkColor = [47, 35, 26];
  const lightColor = [251, 247, 240];

  let isTicking = false;

  function update() {
    const rect = transitionTarget.getBoundingClientRect();
    const start = window.innerHeight * 0.92;
    const end = window.innerHeight * 0.3;
    const progress = clamp((start - rect.top) / (start - end), 0, 1);

    const [red, green, blue] = mixColor(darkColor, lightColor, progress);

    const [textRed, textGreen, textBlue] = mixColor(
      [255, 247, 239],
      [47, 35, 26],
      progress,
    );

    const [mutedRed, mutedGreen, mutedBlue] = mixColor(
      [232, 215, 195],
      [91, 69, 52],
      progress,
    );

    flow.style.setProperty('--services-bg', `rgb(${red}, ${green}, ${blue})`);

    flow.style.setProperty(
      '--services-copy',
      `rgb(${textRed}, ${textGreen}, ${textBlue})`,
    );

    flow.style.setProperty(
      '--services-copy-muted',
      `rgb(${mutedRed}, ${mutedGreen}, ${mutedBlue})`,
    );
    document.body.classList.toggle(
      'is-services-light-header',
      progress >= 0.45,
    );

    isTicking = false;
  }

  function requestUpdate() {
    if (isTicking) return;

    isTicking = true;
    window.requestAnimationFrame(update);
  }

  update();

  window.addEventListener('scroll', requestUpdate, {
    passive: true,
  });

  window.addEventListener('resize', requestUpdate);
}

// появление блоков

function initServicesReveal() {
  const elements = document.querySelectorAll('[data-services-reveal]');

  if (!elements.length) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (prefersReducedMotion) {
    elements.forEach((element) => {
      element.classList.add('is-visible');
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
    },
  );

  elements.forEach((element) => {
    observer.observe(element);
  });
}
