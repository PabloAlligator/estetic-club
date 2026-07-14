'use strict';

// CONTACTS PAGE INIT

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSmoothAnchorScroll();
  initContactHero();
  initContactServicesIntro();
  initContactsFlowBackground();
  initContactEquipment();
  initContactBookingAnimation();
  initContactBookingForm();
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lerp = (start, end, progress) => start + (end - start) * progress;

const mixColor = (from, to, progress) =>
  from.map((channel, index) => Math.round(lerp(channel, to[index], progress)));

// HEADER + BURGER

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

// CONTACT HERO SCROLL ANIMATION
function initContactHero() {
  const section = document.querySelector('.js-contact-hero');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined')
    return;

  const content = section.querySelector('.contact-hero__content');
  const visual = section.querySelector('.contact-hero__visual');
  const image = section.querySelector('.contact-hero__visual img');
  const quote = section.querySelector('.contact-hero__quote');

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
      zIndex: 2,
    });

    gsap.set(image, {
      scale: 1,
      xPercent: 0,
      yPercent: 0,
      objectPosition: '62% 22%',
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

// интро анимация

function initContactServicesIntro() {
  const section = document.querySelector('.js-contact-services-intro');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined')
    return;

  const topLines = section.querySelectorAll('.js-services-intro-top');
  const smallWords = section.querySelectorAll('.js-services-intro-small');
  const text = section.querySelector('.js-services-intro-text');
  const bottom = section.querySelector('.js-services-intro-bottom');
  const image = section.querySelector('.contact-services-intro__visual img');

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

// смена цвета

function initContactsFlowBackground() {
  const wrapper = document.querySelector('[data-contacts-flow]');
  const whiteSection = document.querySelector('[data-contact-white-section]');

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
      wrapper.style.setProperty('--contacts-scene-bg', nextColor);
      lastColor = nextColor;
    }

    requestAnimationFrame(updateBackground);
  }

  updateBackground();
}

// анимация оборудования

function initContactEquipment() {
  const section = document.querySelector('.js-contact-equipment');

  if (!section) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined')
    return;

  const title = section.querySelector('.contact-equipment__title');
  const fades = section.querySelectorAll('.js-equipment-fade');
  const cards = section.querySelectorAll('.js-equipment-card');

  if (!title || !cards.length) return;

  gsap.registerPlugin(ScrollTrigger);

  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 72%',
      end: 'bottom 38%',
      toggleActions: 'play none none reverse',
    },
  });

  timeline
    .from(title, {
      y: 44,
      opacity: 0,
      filter: 'blur(12px)',
      duration: 1.05,
      ease: 'power3.out',
    })
    .from(
      fades,
      {
        y: 24,
        opacity: 0,
        filter: 'blur(8px)',
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out',
      },
      '-=0.68',
    )
    .to(
      cards,
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1,
        stagger: 0.12,
        ease: 'power3.out',
      },
      '-=0.42',
    );
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

// BOOKING FORM ANIMATION

function initContactBookingAnimation() {
  const section = document.querySelector('.js-contact-booking');

  if (!section) return;
  if (
    typeof gsap === 'undefined' ||
    typeof ScrollTrigger === 'undefined'
  ) {
    return;
  }

  const intro = section.querySelector(
    '.contact-booking__intro',
  );

  const formSide = section.querySelector(
    '.contact-booking__form-side',
  );

  if (!intro || !formSide) return;

  gsap.registerPlugin(ScrollTrigger);

  gsap.from(intro, {
    y: 42,
    opacity: 0,
    filter: 'blur(10px)',
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: section,
      start: 'top 72%',
      toggleActions: 'play none none reverse',
    },
  });

  gsap.from(formSide, {
    y: 56,
    opacity: 0,
    scale: 0.985,
    filter: 'blur(10px)',
    duration: 1.05,
    delay: 0.08,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: section,
      start: 'top 68%',
      toggleActions: 'play none none reverse',
    },
  });
}

// BOOKING FORM

function initContactBookingForm() {
  const form = document.querySelector(
    '[data-contact-booking-form]',
  );

  if (!form) return;

  const nameInput = form.querySelector(
    '[data-booking-name]',
  );

  const phoneInput = form.querySelector(
    '[data-booking-phone]',
  );

  const serviceInput = form.querySelector(
    '[data-booking-service]',
  );

  const messageInput = form.querySelector(
    '[data-booking-message]',
  );

  const consentInput = form.querySelector(
    '[data-booking-consent]',
  );

  const honeypotInput = form.querySelector(
    '[data-booking-honeypot]',
  );

  const submitButton = form.querySelector(
    '[data-booking-submit]',
  );

  const submitText = form.querySelector(
    '[data-booking-submit-text]',
  );

  const loader = form.querySelector(
    '[data-booking-loader]',
  );

  const status = form.querySelector(
    '[data-booking-status]',
  );

  const counter = form.querySelector(
    '[data-booking-counter]',
  );

  const success = document.querySelector(
    '[data-booking-success]',
  );

  const newRequestButton = document.querySelector(
    '[data-booking-new-request]',
  );

  if (
    !nameInput ||
    !phoneInput ||
    !serviceInput ||
    !messageInput ||
    !consentInput ||
    !submitButton ||
    !status
  ) {
    return;
  }

  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatRussianPhone(
      phoneInput.value,
    );

    clearFieldError('phone', phoneInput);
  });

  nameInput.addEventListener('input', () => {
    clearFieldError('name', nameInput);
  });

  serviceInput.addEventListener('change', () => {
    clearFieldError('service', serviceInput);
  });

  consentInput.addEventListener('change', () => {
    clearFieldError('consent');
  });

  messageInput.addEventListener('input', () => {
    if (counter) {
      counter.textContent =
        `${messageInput.value.length} / 1000`;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearAllErrors();
    hideBookingStatus(status);

    const payload = {
      name: nameInput.value.trim(),
      phone: normalizeRussianPhone(phoneInput.value),
      service: serviceInput.value,
      message: messageInput.value.trim(),
      source: 'contacts-page',
      company: honeypotInput?.value || '',
      consentAccepted: consentInput.checked,
    };

    const isValid = validateBookingForm(payload);

    if (!isValid) {
      const firstInvalidField = form.querySelector(
        '.is-invalid',
      );

      firstInvalidField?.focus();
      return;
    }

    setBookingLoading(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(payload),
      });

      let data = null;

      const contentType =
        response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        if (response.status === 429) {
          showBookingStatus(
            status,
            'Слишком много попыток. Подождите немного и попробуйте снова.',
          );

          return;
        }

        showBookingStatus(
          status,
          data?.message ||
            'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.',
        );

        return;
      }

      form.reset();

      phoneInput.value = '';

      if (counter) {
        counter.textContent = '0 / 1000';
      }

      form.hidden = true;

      if (success) {
        success.hidden = false;
        success.focus?.();
      }
    } catch (error) {
      console.error('Ошибка отправки заявки:', error);

      showBookingStatus(
        status,
        'Не удалось связаться с сервером. Попробуйте ещё раз или позвоните нам.',
      );
    } finally {
      setBookingLoading(false);
    }
  });

  newRequestButton?.addEventListener('click', () => {
    if (success) {
      success.hidden = true;
    }

    form.hidden = false;
    hideBookingStatus(status);

    nameInput.focus();
  });

  function validateBookingForm(payload) {
    let isValid = true;

    if (
      payload.name.length < 2 ||
      payload.name.length > 80
    ) {
      setFieldError(
        'name',
        'Введите имя от 2 до 80 символов.',
        nameInput,
      );

      isValid = false;
    }

    const phoneDigits = payload.phone.replace(/\D/g, '');

    if (
      phoneDigits.length !== 11 ||
      phoneDigits[0] !== '7'
    ) {
      setFieldError(
        'phone',
        'Введите корректный номер телефона.',
        phoneInput,
      );

      isValid = false;
    }

    if (!payload.service) {
      setFieldError(
        'service',
        'Выберите интересующую услугу.',
        serviceInput,
      );

      isValid = false;
    }

    if (!payload.consentAccepted) {
      setFieldError(
        'consent',
        'Необходимо согласие на обработку персональных данных.',
      );

      isValid = false;
    }

    return isValid;
  }

  function setBookingLoading(isLoading) {
    submitButton.disabled = isLoading;

    submitButton.setAttribute(
      'aria-busy',
      String(isLoading),
    );

    if (submitText) {
      submitText.textContent = isLoading
        ? 'Отправляем…'
        : 'Отправить заявку';
    }

    if (loader) {
      loader.hidden = !isLoading;
    }
  }

  function setFieldError(
    fieldName,
    message,
    input = null,
  ) {
    const error = form.querySelector(
      `[data-booking-error="${fieldName}"]`,
    );

    if (error) {
      error.textContent = message;
    }

    input?.classList.add('is-invalid');
    input?.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(
    fieldName,
    input = null,
  ) {
    const error = form.querySelector(
      `[data-booking-error="${fieldName}"]`,
    );

    if (error) {
      error.textContent = '';
    }

    input?.classList.remove('is-invalid');
    input?.removeAttribute('aria-invalid');
  }

  function clearAllErrors() {
    form
      .querySelectorAll('[data-booking-error]')
      .forEach((element) => {
        element.textContent = '';
      });

    form
      .querySelectorAll('.is-invalid')
      .forEach((element) => {
        element.classList.remove('is-invalid');
        element.removeAttribute('aria-invalid');
      });
  }
}

function formatRussianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  if (!digits.startsWith('7')) {
    digits = `7${digits}`;
  }

  digits = digits.slice(0, 11);

  const body = digits.slice(1);

  let result = '+7';

  if (body.length > 0) {
    result += ` (${body.slice(0, 3)}`;
  }

  if (body.length >= 3) {
    result += ')';
  }

  if (body.length > 3) {
    result += ` ${body.slice(3, 6)}`;
  }

  if (body.length > 6) {
    result += `-${body.slice(6, 8)}`;
  }

  if (body.length > 8) {
    result += `-${body.slice(8, 10)}`;
  }

  return result;
}

function normalizeRussianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    digits = `7${digits}`;
  }

  return digits ? `+${digits.slice(0, 11)}` : '';
}

function showBookingStatus(element, message) {
  element.textContent = message;
  element.hidden = false;
  element.classList.remove('is-success');
}

function hideBookingStatus(element) {
  element.textContent = '';
  element.hidden = true;
  element.classList.remove('is-success');
}
