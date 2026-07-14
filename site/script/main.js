'use strict';

// ======================================================
// APP INIT
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothAnchorScroll();
  initHeroAnimation();
  initSectionTwoMarquee();
  initBeautyFlowBackground();
  initSectionThreeDecorReveal();
  initCompareSliders();
});;

// ======================================================
// HELPERS
// ======================================================

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

const getClientX = (event) => {
  if (event.touches && event.touches.length) {
    return event.touches[0].clientX;
  }

  return event.clientX;
};

// header + burger

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

// hero animation

function initHeroAnimation() {
  const hero = document.querySelector('.hero');
  const heroSpan = document.querySelector('.hero span');
  const heroTitle = document.querySelector('.hero h1');

  if (!hero || !heroSpan || !heroTitle) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  gsap
    .timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=70%',
        scrub: 1.2,
        pin: true,
      },
    })
    .to(heroSpan, {
      y: '-20vh',
      scale: 1.04,
      ease: 'none',
    })
    .to(
      heroTitle,
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        ease: 'none',
      },
      '<35%'
    );
}

// карсел секции два

function initSectionTwoMarquee() {
  const marquee = document.querySelector('[data-section-two-marquee]');
  const track = document.querySelector('[data-section-two-track]');

  if (!marquee || !track) return;

  const originalCards = Array.from(track.children);

  if (!originalCards.length) return;

  originalCards.forEach((card, index) => {
    card.dataset.marqueeCard = String((index % originalCards.length) + 1);
  });

  let setWidth = 0;
  let rawPosition = 0;
  let targetPosition = 0;

  let isPointerDown = false;
  let startX = 0;
  let startTargetPosition = 0;
  let hasMoved = false;
  let rafId = null;

  const speed = 0.36;
  const dragPower = 1.06;
  const smooth = 0.105;
  const dragThreshold = 6;

  function getGap() {
    const styles = window.getComputedStyle(track);

    return parseFloat(styles.columnGap || styles.gap || 0) || 0;
  }

  function getSetWidth(cards) {
    const gap = getGap();

    return cards.reduce((width, card) => {
      const cardWidth = card.getBoundingClientRect().width;

      /*
        ВАЖНО:
        gap считаем после каждой карточки, включая последнюю.
        Между последней оригинальной и первой клонированной карточкой
        flex тоже ставит gap. Без этого будет рывок на стыке.
      */

      return width + cardWidth + gap;
    }, 0);
  }

  function clearClones() {
    track.querySelectorAll('[data-clone="true"]').forEach((clone) => {
      clone.remove();
    });
  }

  function buildClones() {
    clearClones();

    setWidth = getSetWidth(originalCards);

    if (!setWidth) return;

    const marqueeWidth = marquee.getBoundingClientRect().width;
    const minWidth = marqueeWidth + setWidth * 4;

    while (track.scrollWidth < minWidth) {
      originalCards.forEach((card, index) => {
        const clone = card.cloneNode(true);

        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('tabindex', '-1');
        clone.dataset.clone = 'true';
        clone.dataset.marqueeCard = String((index % originalCards.length) + 1);

        track.appendChild(clone);
      });
    }
  }

  function normalizeForRender(value) {
    if (!setWidth) return 0;

    return ((value % setWidth) + setWidth) % setWidth;
  }

  function setTrackPosition(value) {
    const normalized = normalizeForRender(value);
    const renderX = -normalized;

    track.style.setProperty('--marquee-x', `${renderX}px`);
  }

  function animate() {
    if (!isPointerDown) {
      targetPosition += speed;
    }

    rawPosition += (targetPosition - rawPosition) * smooth;

    setTrackPosition(rawPosition);

    rafId = requestAnimationFrame(animate);
  }

  function startDrag(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    isPointerDown = true;
    hasMoved = false;

    marquee.classList.add('is-dragging');

    startX = event.clientX;
    startTargetPosition = targetPosition;

    marquee.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!isPointerDown) return;

    const delta = event.clientX - startX;

    if (Math.abs(delta) > dragThreshold) {
      hasMoved = true;
    }

    targetPosition = startTargetPosition - delta * dragPower;

    event.preventDefault();
  }

  function endDrag(event) {
    if (!isPointerDown) return;

    isPointerDown = false;
    marquee.classList.remove('is-dragging');

    marquee.releasePointerCapture?.(event.pointerId);

    window.setTimeout(() => {
      hasMoved = false;
    }, 0);
  }

  function preventClickAfterDrag(event) {
    if (!hasMoved) return;

    event.preventDefault();
    event.stopPropagation();
  }

  function refresh() {
    const progress = setWidth ? normalizeForRender(rawPosition) / setWidth : 0;

    buildClones();

    rawPosition = progress * setWidth;
    targetPosition = rawPosition;

    setTrackPosition(rawPosition);
  }

  function start() {
    buildClones();
    setTrackPosition(rawPosition);

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    animate();
  }

  marquee.addEventListener('pointerdown', startDrag);
  marquee.addEventListener('pointermove', moveDrag);
  marquee.addEventListener('pointerup', endDrag);
  marquee.addEventListener('pointercancel', endDrag);
  marquee.addEventListener('lostpointercapture', endDrag);
  marquee.addEventListener('click', preventClickAfterDrag, true);

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(refresh);
  });

  originalCards.forEach((card) => {
    const image = card.querySelector('img');

    if (!image || image.complete) return;

    image.addEventListener(
      'load',
      () => {
        window.requestAnimationFrame(refresh);
      },
      {
        once: true,
      }
    );
  });

  start();
}

// анимация перехода цвета

function initBeautyFlowBackground() {
  const wrapper = document.querySelector('[data-beauty-flow]');
  const sectionThree = document.querySelector('.section-three');
  const personalService = document.querySelector('.personal-service');

  if (!wrapper || !sectionThree || !personalService) return;

  const beigeColor = [121, 96, 70]; // #796046
  const whiteColor = [251, 247, 240]; // #fbf7f0

  function getScrollProgress(element, startRatio = 0.95, endRatio = 0.25) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const start = windowHeight * startRatio;
    const end = windowHeight * endRatio;

    return clamp((start - rect.top) / (start - end), 0, 1);
  }

  function updateBackground() {
    const toWhiteProgress = getScrollProgress(sectionThree, 0.95, 0.25);
    const toBeigeProgress = getScrollProgress(personalService, 0.95, 0.25);

    let currentColor;

    if (toBeigeProgress > 0) {
      currentColor = mixColor(whiteColor, beigeColor, toBeigeProgress);
    } else {
      currentColor = mixColor(beigeColor, whiteColor, toWhiteProgress);
    }

    const [r, g, b] = currentColor;

    wrapper.style.setProperty('--scene-bg', `rgb(${r}, ${g}, ${b})`);

    requestAnimationFrame(updateBackground);
  }

  updateBackground();
}

// секция три декор

function initSectionThreeDecorReveal() {
  const section = document.querySelector('.section-three');
  const decors = document.querySelectorAll('.section-three__decor');

  if (!section || !decors.length) return;

  let isFloating = false;
  let lastProgress = -1;

  function updateDecorReveal() {
    const rect = section.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const start = windowHeight * 0.92;
    const end = windowHeight * 0.28;

    const progress = clamp((start - rect.top) / (start - end), 0, 1);

    if (Math.abs(progress - lastProgress) > 0.002) {
      decors.forEach((decor, index) => {
        const delay = index * 0.055;
        const localProgress = clamp((progress - delay) / (1 - delay), 0, 1);
        const eased = 1 - Math.pow(1 - localProgress, 3);

        const y = lerp(180, 0, eased);
        const scale = lerp(0.92, 1, eased);
        const opacity = lerp(0, 1, eased);
        const blur = lerp(18, 0, eased);

        decor.style.setProperty('--reveal-y', `${y.toFixed(2)}px`);
        decor.style.setProperty('--decor-scale', scale.toFixed(3));
        decor.style.setProperty('--decor-opacity', opacity.toFixed(3));
        decor.style.setProperty('--decor-blur', `${blur.toFixed(2)}px`);
      });

      lastProgress = progress;
    }

    if (progress > 0.98 && !isFloating) {
      section.classList.add('is-decor-floating');
      isFloating = true;
    }

    if (progress < 0.96 && isFloating) {
      section.classList.remove('is-decor-floating');
      isFloating = false;
    }

    requestAnimationFrame(updateDecorReveal);
  }

  updateDecorReveal();
}

function initCompareSliders() {
  const compares = document.querySelectorAll('.js-compare');

  if (!compares.length) return;

  compares.forEach((compare) => {
    const min = 2;
    const max = 98;
    const start = Number(compare.dataset.start || 50);

    let isDragging = false;
    let targetPosition = clampCompare(start, min, max);
    let currentPosition = targetPosition;
    let animationFrame = null;

    const setComparePosition = (value) => {
      const position = clampCompare(value, min, max);

      compare.style.setProperty('--compare-position', `${position.toFixed(2)}%`);
      compare.setAttribute('aria-valuenow', String(Math.round(position)));
    };

    const getPositionFromClientX = (clientX) => {
      const rect = compare.getBoundingClientRect();
      const x = clientX - rect.left;

      return (x / rect.width) * 100;
    };

    const requestAnimation = () => {
      if (animationFrame) return;

      animationFrame = requestAnimationFrame(animate);
    };

    const animate = () => {
      const diff = targetPosition - currentPosition;

      if (Math.abs(diff) < 0.08) {
        currentPosition = targetPosition;
      } else {
        currentPosition += diff * 0.22;
      }

      setComparePosition(currentPosition);

      if (currentPosition !== targetPosition || isDragging) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      animationFrame = null;
    };

    const updateTarget = (clientX) => {
      targetPosition = clampCompare(getPositionFromClientX(clientX), min, max);
      requestAnimation();
    };

    const startDrag = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      isDragging = true;
      compare.classList.add('is-dragging');

      compare.setPointerCapture?.(event.pointerId);

      updateTarget(event.clientX);
      event.preventDefault();
    };

    const moveDrag = (event) => {
      if (!isDragging) return;

      updateTarget(event.clientX);
      event.preventDefault();
    };

    const endDrag = (event) => {
      if (!isDragging) return;

      isDragging = false;
      compare.classList.remove('is-dragging');

      compare.releasePointerCapture?.(event.pointerId);

      requestAnimation();
    };

    const moveByKeyboard = (event) => {
      const step = event.shiftKey ? 10 : 4;

      if (event.key === 'ArrowLeft') {
        targetPosition = clampCompare(targetPosition - step, min, max);
        requestAnimation();
        event.preventDefault();
      }

      if (event.key === 'ArrowRight') {
        targetPosition = clampCompare(targetPosition + step, min, max);
        requestAnimation();
        event.preventDefault();
      }

      if (event.key === 'Home') {
        targetPosition = min;
        requestAnimation();
        event.preventDefault();
      }

      if (event.key === 'End') {
        targetPosition = max;
        requestAnimation();
        event.preventDefault();
      }
    };

    compare.addEventListener('pointerdown', startDrag);
    compare.addEventListener('pointermove', moveDrag);
    compare.addEventListener('pointerup', endDrag);
    compare.addEventListener('pointercancel', endDrag);
    compare.addEventListener('lostpointercapture', endDrag);
    compare.addEventListener('keydown', moveByKeyboard);

    compare.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    setComparePosition(currentPosition);
  });
}

function clampCompare(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
