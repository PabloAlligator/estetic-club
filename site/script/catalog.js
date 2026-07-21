'use strict';

(() => {
  const CART_KEY = 'nadiaCatalogCartV1';
  const ORDER_KEY = 'nadiaCatalogOrderKeyV1';
  const MAX_CART_QUANTITY = 20;

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initCatalogCommerce();

    if (document.querySelector('[data-catalog-page]')) {
      initCatalogPage();
    }

    if (document.querySelector('[data-product-page]')) {
      initProductPage();
    }

    if (document.querySelector('[data-cart-page]')) {
      initCartPage();
    }

    if (document.querySelector('[data-checkout-page]')) {
      initCheckoutPage();
    }

    if (document.querySelector('[data-order-success-page]')) {
      initOrderSuccessPage();
    }
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

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        closeMobileMenu();
      }
    });

    updateHeader();
  }

  function initCatalogCommerce() {
    const header = document.querySelector('[data-header]');
    const openButton = header?.querySelector('[data-header-search-open]');

    if (!header || !openButton) return;

    ensureCatalogSearchOverlay();
    bindCatalogSearchOverlay(openButton);
    updateHeaderCartCount();

    window.addEventListener('storage', updateHeaderCartCount);
    window.addEventListener('nadia:cart-updated', updateHeaderCartCount);
  }

  function ensureCatalogSearchOverlay() {
    if (document.querySelector('[data-catalog-search-overlay]')) return;

    const overlay = document.createElement('div');
    overlay.className = 'catalog-search-overlay';
    overlay.dataset.catalogSearchOverlay = '';
    overlay.hidden = true;
    overlay.innerHTML = `
      <button
        class="catalog-search-overlay__backdrop"
        type="button"
        aria-label="Закрыть поиск"
        data-header-search-close
      ></button>

      <section
        class="catalog-search-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-search-title"
      >
        <div class="catalog-search-overlay__head">
          <div>
            <span>КУЛЬТУРА ВОЛОС — КАТАЛОГ</span>
            <h2 id="catalog-search-title">Поиск по каталогу</h2>
          </div>

          <button
            class="catalog-search-overlay__close"
            type="button"
            aria-label="Закрыть поиск"
            data-header-search-close
          >
            ×
          </button>
        </div>

        <form class="catalog-search-overlay__form" data-header-search-form>
          <label for="global-catalog-search">Что вы ищете?</label>

          <div>
            <input
              id="global-catalog-search"
              type="search"
              maxlength="120"
              autocomplete="off"
              placeholder="Маска, фен, кисть, бренд…"
              data-header-search-input
            />

            <button type="submit">Найти</button>
          </div>
        </form>

        <div class="catalog-search-overlay__suggestions">
          <span>Популярные направления</span>

          <div>
            <a href="/catalog?category=hair">Волосы</a>
            <a href="/catalog?category=tools">Инструменты</a>
            <a href="/catalog?category=lashes-brows">Ресницы и брови</a>
            <a href="/catalog?category=consumables">Расходные материалы</a>
          </div>
        </div>
      </section>
    `;

    document.body.append(overlay);
  }

  function bindCatalogSearchOverlay(openButton) {
    const overlay = document.querySelector('[data-catalog-search-overlay]');
    const form = overlay?.querySelector('[data-header-search-form]');
    const input = overlay?.querySelector('[data-header-search-input]');

    if (!overlay || !form || !input) return;

    const open = () => {
      overlay.hidden = false;
      document.body.classList.add('is-catalog-search-open');
      openButton.setAttribute('aria-expanded', 'true');

      window.requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });

      window.setTimeout(() => input.focus(), 80);
    };

    const close = ({ restoreFocus = true } = {}) => {
      if (overlay.hidden) return;

      overlay.classList.remove('is-open');
      document.body.classList.remove('is-catalog-search-open');
      openButton.setAttribute('aria-expanded', 'false');

      window.setTimeout(() => {
        overlay.hidden = true;

        if (restoreFocus) {
          openButton.focus();
        }
      }, 220);
    };

    openButton.addEventListener('click', open);

    overlay.querySelectorAll('[data-header-search-close]').forEach((button) => {
      button.addEventListener('click', () => close());
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const value = input.value.trim();
      const url = new URL('/catalog', window.location.origin);

      if (value) {
        url.searchParams.set('search', value);
      }

      close({ restoreFocus: false });
      window.location.assign(`${url.pathname}${url.search}`);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) {
        close();
      }
    });
  }

  function updateHeaderCartCount() {
    const count = getCart().reduce(
      (total, item) => total + Math.max(0, Number(item.quantity) || 0),
      0,
    );

    document.querySelectorAll('[data-header-cart-count]').forEach((element) => {
      element.textContent = String(count);
      element.hidden = count <= 0;
    });
  }

  function getCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(cart) ? cart : [];
    } catch {
      localStorage.removeItem(CART_KEY);
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateHeaderCartCount();
    window.dispatchEvent(new CustomEvent('nadia:cart-updated'));
  }

  function addVariantToCart(variantId, quantity = 1) {
    const id = Number(variantId);
    const normalizedQuantity = Math.max(1, Math.min(MAX_CART_QUANTITY, Number(quantity) || 1));

    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    const cart = getCart();
    const existing = cart.find((item) => Number(item.variantId) === id);

    if (existing) {
      existing.quantity = Math.min(MAX_CART_QUANTITY, Number(existing.quantity || 0) + normalizedQuantity);
    } else {
      cart.push({ variantId: id, quantity: normalizedQuantity });
    }

    saveCart(cart);
    showToast('Добавлено в корзину', 'Товар сохранён в вашей корзине.');
  }

  function updateCartItem(variantId, quantity) {
    const id = Number(variantId);
    const cart = getCart();
    const item = cart.find((entry) => Number(entry.variantId) === id);

    if (!item) return;

    const nextQuantity = Math.max(0, Math.min(MAX_CART_QUANTITY, Number(quantity) || 0));

    if (nextQuantity <= 0) {
      saveCart(cart.filter((entry) => Number(entry.variantId) !== id));
      return;
    }

    item.quantity = nextQuantity;
    saveCart(cart);
  }

  function removeCartItem(variantId) {
    saveCart(getCart().filter((item) => Number(item.variantId) !== Number(variantId)));
  }

  async function validateCart() {
    const items = getCart();

    if (!items.length) {
      return { items: [], total: 0, removedVariantIds: [] };
    }

    const response = await fetch('/api/catalog/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ items }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || 'Не удалось обновить корзину');
    }

    const validItems = Array.isArray(data.items) ? data.items : [];
    saveCart(validItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity })));

    return data;
  }

  function formatMoney(kopecks) {
    return `${(Number(kopecks || 0) / 100).toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} ₽`;
  }

  function escapeHtml(value) {
    const symbols = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(value ?? '').replace(/[&<>"']/g, (symbol) => symbols[symbol]);
  }

  function createProductCard(product) {
    const variant = product.variants?.[0];
    const price = product.minPrice || variant?.price || 0;
    const oldPrice = variant?.oldPrice;
    const image = product.mainImage || product.images?.[0];
    const hasVariants = (product.variants?.length || 0) > 1;
    const variantLabel = hasVariants
      ? `От ${product.variants.length} вариантов`
      : variant?.name || 'Стандарт';

    return `
      <article
        class="catalog-product-card"
        tabindex="0"
        data-product-card="${product.id}"
      >
        <a
          class="catalog-product-card__media"
          href="/catalog/product/${encodeURIComponent(product.slug)}"
          aria-label="Открыть товар ${escapeHtml(product.title)}"
        >
          ${
            image
              ? `<img
                  ${window.KulturaImage.attrs(image.imagePath, {
                    loading: 'lazy',
                    fallbackWidth: 1000,
                    fallbackHeight: 1080,
                  })}
                  alt="${escapeHtml(image.alt || product.title)}"
                />`
              : '<span>Изображение готовится</span>'
          }

          ${
            product.badge
              ? `<b class="catalog-product-card__badge">${escapeHtml(product.badge)}</b>`
              : ''
          }
        </a>

        <div class="catalog-product-card__body">
          <span class="catalog-product-card__meta">
            ${escapeHtml(product.brand?.name || product.category?.name || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ')}
          </span>

          <h3>
            <a href="/catalog/product/${encodeURIComponent(product.slug)}">
              ${escapeHtml(product.title)}
            </a>
          </h3>

          <p class="catalog-product-card__description">
            ${escapeHtml(product.shortDescription || '')}
          </p>

          <span class="catalog-product-card__variant">
            ${escapeHtml(variantLabel)}
          </span>

          <div class="catalog-product-card__bottom">
            <div class="catalog-product-card__price">
              <strong>${formatMoney(price)}</strong>
              ${oldPrice ? `<span>${formatMoney(oldPrice)}</span>` : ''}
            </div>

            <button
              class="catalog-product-card__add"
              type="button"
              aria-label="${hasVariants ? 'Выбрать вариант' : 'Добавить в корзину'}"
              data-card-add
              data-product-id="${product.id}"
            >
              +
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function initCatalogPage() {
    const page = document.querySelector('[data-catalog-page]');
    const directionList = document.querySelector('[data-catalog-directions]');
    const productsGrid = document.querySelector('[data-catalog-products]');
    const filters = document.querySelector('[data-catalog-filters]');
    const mobileFilters = document.querySelector('[data-catalog-mobile-filters]');
    const searchForm = document.querySelector('[data-catalog-search-form]');
    const searchInput = document.querySelector('[data-catalog-search-input]');
    const mobileSearchForm = document.querySelector('[data-catalog-search-form-mobile]');
    const mobileSearchInput = document.querySelector('[data-catalog-search-input-mobile]');
    const sortSelect = document.querySelector('[data-catalog-sort]');
    const count = document.querySelector('[data-catalog-result-count]');
    const title = document.querySelector('[data-catalog-title]');
    const breadcrumbCurrent = document.querySelector('[data-catalog-breadcrumb-current]');
    const loading = document.querySelector('[data-catalog-loading]');
    const empty = document.querySelector('[data-catalog-empty]');
    const error = document.querySelector('[data-catalog-error]');
    const loadMore = document.querySelector('[data-catalog-load-more]');
    const filterSheet = document.querySelector('[data-filter-sheet]');
    const sortSheet = document.querySelector('[data-sort-sheet]');
    const variantSheet = document.querySelector('[data-variant-sheet]');
    const preview = document.querySelector('[data-catalog-preview]');
    const previewEmpty = document.querySelector('[data-catalog-preview-empty]');
    const previewContent = document.querySelector('[data-catalog-preview-content]');
    const activeFilters = document.querySelector('[data-catalog-active-filters]');
    const mobileAdd = document.querySelector('[data-catalog-mobile-add]');
    const heroImages = document.querySelectorAll('[data-hero-product-image]');

    if (
      !page ||
      !directionList ||
      !productsGrid ||
      !filters ||
      !mobileFilters ||
      !searchForm ||
      !searchInput ||
      !sortSelect ||
      !count ||
      !loading ||
      !empty ||
      !error ||
      !loadMore ||
      !filterSheet ||
      !sortSheet ||
      !variantSheet
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const state = {
      category: params.get('category') || '',
      search: params.get('search') || '',
      brand: params.get('brand') || '',
      sort: params.get('sort') || 'default',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      selectedFilters: new Map(),
      page: 1,
      limit: 24,
      pages: 1,
      products: [],
      meta: { categories: [], brands: [], filterGroups: [] },
      activeProductId: null,
      mobileVariantId: null,
      isLoading: false,
    };

    searchInput.value = state.search;
    sortSelect.value = state.sort;

    if (mobileSearchInput) {
      mobileSearchInput.value = state.search;
    }

    searchForm.addEventListener('submit', submitSearch);
    mobileSearchForm?.addEventListener('submit', submitSearch);

    sortSelect.addEventListener('change', async () => {
      state.sort = sortSelect.value;
      state.page = 1;
      state.products = [];
      syncUrl();
      renderQuickControls();
      await loadProducts();
    });

    directionList.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-direction]');

      if (!button || state.isLoading) {
        return;
      }

      state.category = button.dataset.direction || '';
      state.brand = '';
      state.selectedFilters.clear();
      state.minPrice = '';
      state.maxPrice = '';
      state.page = 1;
      state.products = [];
      state.activeProductId = null;

      updateDirectionState();
      syncUrl();
      await loadMeta();
      await loadProducts();
    });

    filters.addEventListener('change', onFilterChange);
    mobileFilters.addEventListener('change', onFilterChange);
    filters.addEventListener('submit', applyPriceFilter);
    mobileFilters.addEventListener('submit', applyPriceFilter);

    loadMore.addEventListener('click', async () => {
      if (state.isLoading || state.page >= state.pages) {
        return;
      }

      state.page += 1;
      await loadProducts(true);
    });

    document
      .querySelectorAll(
        '[data-catalog-filter-open], [data-catalog-filter-open-mobile], [data-chip-filter-open], [data-chip-brand-open]',
      )
      .forEach((button) => {
        button.addEventListener('click', (event) => openSheet(filterSheet, event.currentTarget));
      });

    document
      .querySelectorAll('[data-catalog-sort-open], [data-chip-sort-open]')
      .forEach((button) => {
        button.addEventListener('click', (event) => openSheet(sortSheet, event.currentTarget));
      });

    document.querySelectorAll('[data-sheet-close]').forEach((button) => {
      button.addEventListener('click', () => {
        closeSheet(button.closest('[data-sheet]'));
      });
    });

    filterSheet
      .querySelector('[data-filter-apply]')
      ?.addEventListener('click', () => closeSheet(filterSheet));

    filterSheet
      .querySelector('[data-filter-reset]')
      ?.addEventListener('click', resetFilters);

    document
      .querySelector('[data-filter-reset-desktop]')
      ?.addEventListener('click', resetFilters);

    sortSheet.querySelectorAll('[data-sort-value]').forEach((button) => {
      button.addEventListener('click', async () => {
        state.sort = button.dataset.sortValue || 'default';
        sortSelect.value = state.sort;
        state.page = 1;
        state.products = [];
        closeSheet(sortSheet);
        syncUrl();
        renderQuickControls();
        await loadProducts();
      });
    });

    productsGrid.addEventListener('mouseover', (event) => {
      if (isCompactCatalog()) {
        return;
      }

      const card = event.target.closest('[data-product-card]');

      if (card) {
        selectProduct(Number(card.dataset.productCard));
      }
    });

    productsGrid.addEventListener('focusin', (event) => {
      const card = event.target.closest('[data-product-card]');

      if (card) {
        selectProduct(Number(card.dataset.productCard));
      }
    });

    productsGrid.addEventListener('click', (event) => {
      const addButton = event.target.closest('[data-card-add]');
      const card = event.target.closest('[data-product-card]');

      if (!card) {
        return;
      }

      const product = state.products.find(
        (item) => item.id === Number(card.dataset.productCard),
      );

      if (!product) {
        return;
      }

      selectProduct(product.id);

      if (!addButton) {
        return;
      }

      event.preventDefault();

      if ((product.variants?.length || 0) === 1) {
        if (isCompactCatalog()) {
          openMobileAdd(product, product.variants[0]);
        } else {
          addVariantToCart(product.variants[0].id);
        }
      } else {
        openVariantSheet(product, addButton);
      }
    });

    preview?.addEventListener('click', (event) => {
      const variantButton = event.target.closest('[data-preview-variant]');
      const addButton = event.target.closest('[data-preview-add]');

      if (variantButton) {
        preview
          .querySelectorAll('[data-preview-variant]')
          .forEach((button) => button.classList.toggle('is-active', button === variantButton));

        updatePreviewPrice(Number(variantButton.dataset.previewVariant));
        return;
      }

      if (addButton) {
        const selected = preview.querySelector('[data-preview-variant].is-active');
        const variantId = Number(selected?.dataset.previewVariant || addButton.dataset.previewAdd);

        if (Number.isInteger(variantId) && variantId > 0) {
          addVariantToCart(variantId);
        }
      }
    });

    variantSheet.addEventListener('click', (event) => {
      const option = event.target.closest('[data-variant-choice]');

      if (!option) {
        return;
      }

      variantSheet
        .querySelectorAll('[data-variant-choice]')
        .forEach((item) => item.classList.toggle('is-active', item === option));
    });

    variantSheet.querySelector('[data-variant-add]')?.addEventListener('click', () => {
      const selected = variantSheet.querySelector('[data-variant-choice].is-active');

      if (!selected) {
        return;
      }

      addVariantToCart(Number(selected.dataset.variantChoice));
      closeSheet(variantSheet);
    });

    mobileAdd?.querySelector('[data-mobile-add-close]')?.addEventListener('click', () => {
      mobileAdd.hidden = true;
      state.mobileVariantId = null;
    });

    mobileAdd?.querySelector('[data-mobile-add-submit]')?.addEventListener('click', () => {
      if (state.mobileVariantId) {
        addVariantToCart(state.mobileVariantId);
        mobileAdd.hidden = true;
        state.mobileVariantId = null;
      }
    });

    activeFilters?.addEventListener('click', async (event) => {
      const reset = event.target.closest('[data-active-filter-reset]');

      if (reset) {
        await resetFilters();
      }
    });

    initialize();

    async function initialize() {
      updateDirectionState();
      await loadMeta();
      await loadProducts();
    }

    async function submitSearch(event) {
      event.preventDefault();

      const sourceInput = event.currentTarget.querySelector('input[type="search"]');
      state.search = sourceInput?.value.trim() || '';
      state.page = 1;
      state.products = [];

      searchInput.value = state.search;

      if (mobileSearchInput) {
        mobileSearchInput.value = state.search;
      }

      syncUrl();
      await loadProducts();
    }

    async function loadMeta() {
      try {
        const url = new URL('/api/catalog/meta', window.location.origin);

        if (state.category) {
          url.searchParams.set('category', state.category);
        }

        const response = await fetch(`${url.pathname}${url.search}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить фильтры');
        }

        state.meta = data;

        renderDirections();
        renderFilters();
        renderCatalogHeading();
        renderQuickControls();
      } catch (requestError) {
        console.error('Catalog meta error:', requestError);
      }
    }

    async function loadProducts(append = false) {
      state.isLoading = true;
      loading.hidden = false;
      error.hidden = true;
      empty.hidden = true;
      loadMore.hidden = true;

      if (!append) {
        productsGrid.setAttribute('aria-busy', 'true');
      }

      const url = new URL('/api/catalog/products', window.location.origin);

      if (state.category) url.searchParams.set('category', state.category);
      if (state.search) url.searchParams.set('search', state.search);
      if (state.brand) url.searchParams.set('brand', state.brand);
      if (state.minPrice) {
        url.searchParams.set('minPrice', String(Math.round(Number(state.minPrice) * 100)));
      }
      if (state.maxPrice) {
        url.searchParams.set('maxPrice', String(Math.round(Number(state.maxPrice) * 100)));
      }

      const filterValue = serializeFilters();

      if (filterValue) {
        url.searchParams.set('filters', filterValue);
      }

      url.searchParams.set('sort', state.sort);
      url.searchParams.set('page', String(state.page));
      url.searchParams.set('limit', String(state.limit));

      try {
        const response = await fetch(`${url.pathname}${url.search}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить товары');
        }

        const products = Array.isArray(data.products) ? data.products : [];
        state.products = append ? [...state.products, ...products] : products;
        state.pages = Number(data.pagination?.pages) || 1;

        if (!state.products.some((product) => product.id === state.activeProductId)) {
          state.activeProductId = state.products[0]?.id || null;
        }

        renderProducts();
        renderHeroProducts();
        renderPreview();
        renderCatalogHeading();
        renderQuickControls();

        const total = Number(data.pagination?.total) || 0;
        count.textContent = `${total} ${productWord(total)}`;
        loadMore.hidden = state.page >= state.pages || !state.products.length;
      } catch (requestError) {
        console.error('Catalog products error:', requestError);

        if (!append) {
          productsGrid.innerHTML = '';
        }

        error.hidden = false;
        error.textContent = requestError.message || 'Не удалось загрузить товары.';
      } finally {
        state.isLoading = false;
        loading.hidden = true;
        productsGrid.setAttribute('aria-busy', 'false');
      }
    }

    function renderDirections() {
      const roots = Array.isArray(state.meta.categories) ? state.meta.categories : [];

      directionList.innerHTML = `
        <button
          type="button"
          class="catalog-direction-card catalog-direction-card--all ${state.category ? '' : 'is-active'}"
          data-direction=""
        >
          <span class="catalog-direction-card__content">
            <strong>Все товары</strong>
            <span>Полный каталог</span>
          </span>
          <span class="catalog-direction-card__arrow" aria-hidden="true">→</span>
        </button>
      ` + roots
        .map(
          (category) => `
            <button
              type="button"
              class="catalog-direction-card ${state.category === category.slug ? 'is-active' : ''}"
              data-direction="${escapeHtml(category.slug)}"
            >
              <span class="catalog-direction-card__media">
                ${
                  category.imagePath
                    ? `<img ${window.KulturaImage.attrs(category.imagePath, {
                        loading: 'lazy',
                        fallbackWidth: 640,
                        fallbackHeight: 480,
                      })} alt="" />`
                    : ''
                }
              </span>
              <span class="catalog-direction-card__content">
                <strong>${escapeHtml(category.name)}</strong>
                <span>${escapeHtml(category.description || 'Товары направления')}</span>
              </span>
              <span class="catalog-direction-card__arrow" aria-hidden="true">→</span>
            </button>
          `,
        )
        .join('');
    }

    function updateDirectionState() {
      directionList.querySelectorAll('[data-direction]').forEach((button) => {
        button.classList.toggle(
          'is-active',
          (button.dataset.direction || '') === state.category,
        );
      });
    }

    function renderFilters() {
      const markup = createFiltersMarkup();
      filters.innerHTML = markup;
      mobileFilters.innerHTML = markup;
      syncFilterControls(filters);
      syncFilterControls(mobileFilters);
      renderActiveFilters();
    }

    function createFiltersMarkup() {
      const brandMarkup = (state.meta.brands || []).length
        ? `
          <fieldset class="catalog-filter-group">
            <legend>Бренд</legend>
            <div>
              <label>
                <input type="radio" name="brand" value="" ${state.brand ? '' : 'checked'} />
                <span>Все бренды</span>
              </label>
              ${(state.meta.brands || [])
                .map(
                  (brand) => `
                    <label>
                      <input
                        type="radio"
                        name="brand"
                        value="${escapeHtml(brand.slug)}"
                        ${state.brand === brand.slug ? 'checked' : ''}
                      />
                      <span>${escapeHtml(brand.name)}</span>
                    </label>
                  `,
                )
                .join('')}
            </div>
          </fieldset>
        `
        : '';

      const dynamic = (state.meta.filterGroups || [])
        .map((group) => {
          const selected = state.selectedFilters.get(group.id) || new Set();

          return `
            <fieldset class="catalog-filter-group">
              <legend>${escapeHtml(group.name)}</legend>
              <div>
                ${(group.options || [])
                  .map(
                    (option) => `
                      <label>
                        <input
                          type="checkbox"
                          name="filter-${group.id}"
                          value="${option.id}"
                          data-filter-group="${group.id}"
                          ${selected.has(option.id) ? 'checked' : ''}
                        />
                        <span>${escapeHtml(option.name)}</span>
                      </label>
                    `,
                  )
                  .join('')}
              </div>
            </fieldset>
          `;
        })
        .join('');

      return `
        ${brandMarkup}
        ${dynamic}
        <fieldset class="catalog-filter-group catalog-filter-group--price">
          <legend>Цена</legend>
          <div>
            <label>
              <span>От</span>
              <input type="number" min="0" step="1" name="minPrice" value="${escapeHtml(state.minPrice)}" placeholder="0" />
            </label>
            <label>
              <span>До</span>
              <input type="number" min="0" step="1" name="maxPrice" value="${escapeHtml(state.maxPrice)}" placeholder="10000" />
            </label>
          </div>
          <button type="submit">Применить цену</button>
        </fieldset>
      `;
    }

    async function onFilterChange(event) {
      const input = event.target;

      if (input.name === 'brand') {
        state.brand = input.value;
      }

      if (input.dataset.filterGroup) {
        const groupId = Number(input.dataset.filterGroup);
        const selected = state.selectedFilters.get(groupId) || new Set();

        if (input.checked) {
          selected.add(Number(input.value));
        } else {
          selected.delete(Number(input.value));
        }

        if (selected.size) {
          state.selectedFilters.set(groupId, selected);
        } else {
          state.selectedFilters.delete(groupId);
        }
      }

      state.page = 1;
      state.products = [];
      syncUrl();
      renderFilters();
      renderQuickControls();
      await loadProducts();
    }

    async function applyPriceFilter(event) {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);
      state.minPrice = String(formData.get('minPrice') || '').trim();
      state.maxPrice = String(formData.get('maxPrice') || '').trim();
      state.page = 1;
      state.products = [];

      syncUrl();
      renderFilters();
      await loadProducts();
    }

    async function resetFilters() {
      state.brand = '';
      state.selectedFilters.clear();
      state.minPrice = '';
      state.maxPrice = '';
      state.page = 1;
      state.products = [];

      renderFilters();
      renderQuickControls();
      syncUrl();
      await loadProducts();
    }

    function syncFilterControls(container) {
      container.querySelectorAll('[data-filter-group]').forEach((input) => {
        const selected = state.selectedFilters.get(Number(input.dataset.filterGroup));
        input.checked = selected?.has(Number(input.value)) || false;
      });
    }

    function serializeFilters() {
      return [...state.selectedFilters.entries()]
        .filter(([, values]) => values.size)
        .map(([groupId, values]) => `${groupId}:${[...values].join(',')}`)
        .join('|');
    }

    function renderProducts() {
      productsGrid.innerHTML = state.products.map(createProductCard).join('');
      empty.hidden = state.products.length > 0;

      productsGrid.querySelectorAll('[data-product-card]').forEach((card) => {
        card.classList.toggle(
          'is-active',
          Number(card.dataset.productCard) === state.activeProductId,
        );
      });
    }

    function selectProduct(productId) {
      if (!state.products.some((product) => product.id === productId)) {
        return;
      }

      state.activeProductId = productId;

      productsGrid.querySelectorAll('[data-product-card]').forEach((card) => {
        card.classList.toggle(
          'is-active',
          Number(card.dataset.productCard) === state.activeProductId,
        );
      });

      renderPreview();
    }

    function renderPreview() {
      if (!preview || !previewContent || !previewEmpty) {
        return;
      }

      const product = state.products.find((item) => item.id === state.activeProductId);

      if (!product) {
        previewContent.hidden = true;
        previewEmpty.hidden = false;
        return;
      }

      const image = product.mainImage || product.images?.[0];
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const selectedVariant = variants[0];

      previewContent.innerHTML = `
        <div class="catalog-preview__media">
          ${
            image
              ? `<img ${window.KulturaImage.attrs(image.imagePath, {
                  loading: 'lazy',
                  fallbackWidth: 1000,
                  fallbackHeight: 1080,
                })} alt="${escapeHtml(image.alt || product.title)}" />`
              : ''
          }
          ${
            product.badge
              ? `<span class="catalog-preview__badge">${escapeHtml(product.badge)}</span>`
              : ''
          }
        </div>

        <div class="catalog-preview__body">
          <span class="catalog-preview__brand">
            ${escapeHtml(product.brand?.name || product.category?.name || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ')}
          </span>

          <h3>${escapeHtml(product.title)}</h3>

          <p>${escapeHtml(product.shortDescription || '')}</p>

          ${
            variants.length
              ? `
                <div class="catalog-preview__variants">
                  <span>${variants.length > 1 ? 'Выберите вариант' : 'Вариант'}</span>
                  <div>
                    ${variants
                      .map(
                        (variant, index) => `
                          <button
                            type="button"
                            class="${index === 0 ? 'is-active' : ''}"
                            data-preview-variant="${variant.id}"
                          >
                            ${escapeHtml(variant.name)}
                          </button>
                        `,
                      )
                      .join('')}
                  </div>
                </div>
              `
              : ''
          }

          <div class="catalog-preview__price" data-preview-price>
            ${renderPrice(selectedVariant)}
          </div>

          <div class="catalog-preview__actions">
            <button
              type="button"
              data-preview-add="${selectedVariant?.id || ''}"
            >
              В корзину
            </button>

            <a href="/catalog/product/${encodeURIComponent(product.slug)}">
              Подробнее о товаре
            </a>
          </div>
        </div>
      `;

      previewEmpty.hidden = true;
      previewContent.hidden = false;
    }

    function updatePreviewPrice(variantId) {
      const product = state.products.find((item) => item.id === state.activeProductId);
      const variant = product?.variants?.find((item) => item.id === variantId);
      const price = preview?.querySelector('[data-preview-price]');
      const addButton = preview?.querySelector('[data-preview-add]');

      if (price) {
        price.innerHTML = renderPrice(variant);
      }

      if (addButton) {
        addButton.dataset.previewAdd = String(variantId);
      }
    }

    function renderPrice(variant) {
      if (!variant) {
        return '<strong>Цена уточняется</strong>';
      }

      return `
        <strong>${formatMoney(variant.price)}</strong>
        ${variant.oldPrice ? `<span>${formatMoney(variant.oldPrice)}</span>` : ''}
      `;
    }

    function renderHeroProducts() {
      if (!heroImages.length || !state.products.length) {
        return;
      }

      heroImages.forEach((imageElement, index) => {
        const product = state.products[index];
        const image = product?.mainImage || product?.images?.[0];

        if (image?.imagePath) {
          window.KulturaImage.apply(imageElement, image.imagePath, {
            loading: 'eager',
            fetchpriority: index === 0 ? 'high' : '',
            fallbackWidth: 1000,
            fallbackHeight: 1080,
          });
          imageElement.alt = '';
        }
      });
    }

    function renderCatalogHeading() {
      const selectedCategory = findSelectedCategory();
      const name = selectedCategory?.name || 'Все товары';

      if (title) {
        title.textContent = name;
      }

      if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = selectedCategory ? name : '';
      }
    }

    function findSelectedCategory() {
      const categories = Array.isArray(state.meta.categories) ? state.meta.categories : [];

      for (const category of categories) {
        if (category.slug === state.category) {
          return category;
        }

        const child = (category.children || []).find(
          (item) => item.slug === state.category,
        );

        if (child) {
          return child;
        }
      }

      return null;
    }

    function renderActiveFilters() {
      if (!activeFilters) {
        return;
      }

      const labels = [];
      const brand = (state.meta.brands || []).find((item) => item.slug === state.brand);

      if (brand) {
        labels.push(brand.name);
      }

      for (const group of state.meta.filterGroups || []) {
        const selected = state.selectedFilters.get(group.id);

        if (!selected?.size) {
          continue;
        }

        for (const option of group.options || []) {
          if (selected.has(option.id)) {
            labels.push(option.name);
          }
        }
      }

      if (state.minPrice || state.maxPrice) {
        labels.push(`Цена ${state.minPrice || '0'}–${state.maxPrice || '∞'} ₽`);
      }

      activeFilters.innerHTML = labels.length
        ? labels
            .map((label) => `<span>${escapeHtml(label)}</span>`)
            .join('') +
          '<button type="button" data-active-filter-reset>Сбросить всё</button>'
        : '<span>Все товары</span>';
    }

    function renderQuickControls() {
      const sortLabels = {
        default: 'По умолчанию',
        'price-asc': 'Сначала дешевле',
        'price-desc': 'Сначала дороже',
        newest: 'Сначала новые',
      };

      const brand = (state.meta.brands || []).find((item) => item.slug === state.brand);
      const sortLabel = document.querySelector('[data-chip-sort-label]');
      const brandLabel = document.querySelector('[data-chip-brand-label]');

      if (sortLabel) {
        sortLabel.textContent = sortLabels[state.sort] || sortLabels.default;
      }

      if (brandLabel) {
        brandLabel.textContent = brand?.name || 'Бренд';
      }

      renderActiveFilters();
    }

    function openVariantSheet(product, trigger) {
      variantSheet
        .querySelectorAll('[data-variant-product-title]')
        .forEach((element) => {
          element.textContent = product.title;
        });

      const productName = variantSheet.querySelector('[data-variant-product-name]');
      const productMeta = variantSheet.querySelector('[data-variant-product-meta]');
      const image = product.mainImage || product.images?.[0];
      const imageElement = variantSheet.querySelector('[data-variant-product-image]');

      if (productName) {
        productName.textContent = product.title;
      }

      if (productMeta) {
        productMeta.textContent = product.brand?.name || product.category?.name || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ';
      }

      if (image) {
        window.KulturaImage.apply(imageElement, image.imagePath, {
          loading: 'eager',
          fallbackWidth: 1000,
          fallbackHeight: 1080,
        });
        imageElement.alt = image.alt || product.title;
        imageElement.hidden = false;
      } else {
        imageElement.hidden = true;
      }

      variantSheet.querySelector('[data-variant-choices]').innerHTML = (
        product.variants || []
      )
        .map(
          (variant, index) => `
            <button
              type="button"
              class="${index === 0 ? 'is-active' : ''}"
              data-variant-choice="${variant.id}"
            >
              <span>${escapeHtml(variant.name)}</span>
              <strong>${formatMoney(variant.price)}</strong>
            </button>
          `,
        )
        .join('');

      openSheet(variantSheet, trigger);
    }

    function openMobileAdd(product, variant) {
      if (!mobileAdd || !variant) {
        addVariantToCart(variant?.id);
        return;
      }

      const image = product.mainImage || product.images?.[0];
      const imageElement = mobileAdd.querySelector('[data-mobile-add-image]');
      const brandElement = mobileAdd.querySelector('[data-mobile-add-brand]');
      const titleElement = mobileAdd.querySelector('[data-mobile-add-title]');
      const variantElement = mobileAdd.querySelector('[data-mobile-add-variant]');
      const priceElement = mobileAdd.querySelector('[data-mobile-add-price]');

      state.mobileVariantId = variant.id;

      if (image?.imagePath) {
        window.KulturaImage.apply(imageElement, image.imagePath, {
          loading: 'eager',
          fallbackWidth: 800,
          fallbackHeight: 800,
        });
        imageElement.alt = image.alt || product.title;
        imageElement.hidden = false;
      } else {
        imageElement.hidden = true;
      }

      brandElement.textContent = product.brand?.name || product.category?.name || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ';
      titleElement.textContent = product.title;
      variantElement.textContent = variant.name;
      priceElement.textContent = formatMoney(variant.price);
      mobileAdd.hidden = false;
    }

    function isCompactCatalog() {
      return window.matchMedia('(max-width: 900px)').matches;
    }

    function syncUrl() {
      const url = new URL(window.location.href);

      ['category', 'search', 'brand', 'sort', 'minPrice', 'maxPrice'].forEach(
        (key) => url.searchParams.delete(key),
      );

      if (state.category) url.searchParams.set('category', state.category);
      if (state.search) url.searchParams.set('search', state.search);
      if (state.brand) url.searchParams.set('brand', state.brand);
      if (state.sort !== 'default') url.searchParams.set('sort', state.sort);
      if (state.minPrice) url.searchParams.set('minPrice', state.minPrice);
      if (state.maxPrice) url.searchParams.set('maxPrice', state.maxPrice);

      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }

  function initProductPage() {
    const page = document.querySelector('[data-product-page]');
    const loading = document.querySelector('[data-product-loading]');
    const error = document.querySelector('[data-product-error]');
    const content = document.querySelector('[data-product-content]');

    if (!page || !loading || !error || !content) return;

    const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');
    let product = null;
    let selectedVariantId = null;
    let quantity = 1;

    loadProduct();

    async function loadProduct() {
      try {
        const initialScript = document.querySelector('[data-initial-product]');
        let initialProduct = null;

        if (initialScript) {
          try {
            const initialPayload = JSON.parse(initialScript.textContent || '{}');
            initialProduct = initialPayload?.product || null;
          } catch {
            initialProduct = null;
          }
        }

        if (initialProduct) {
          product = initialProduct;
          selectedVariantId = product.variants?.[0]?.id || null;
          renderProduct();
          loading.hidden = true;
          content.hidden = false;

          return;
        }

        const response = await fetch(`/api/catalog/products/${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!response.ok || !data.product) throw new Error(data?.message || 'Товар не найден');
        product = data.product;
        selectedVariantId = product.variants?.[0]?.id || null;
        renderProduct();
        loading.hidden = true;
        content.hidden = false;
      } catch (requestError) {
        loading.hidden = true;
        error.hidden = false;
        error.querySelector('p').textContent = requestError.message || 'Товар временно недоступен.';
      }
    }

    function renderProduct() {
      const rawTitle = String(product.seoTitle || product.title || '').trim();
      document.title = /культура волос/i.test(rawTitle)
        ? rawTitle
        : `${rawTitle} | Культура волос`;

      const descriptionMeta = document.querySelector('meta[name="description"]');
      const seoDescription = String(
        product.seoDescription || product.shortDescription || '',
      ).trim();

      if (descriptionMeta && seoDescription) {
        descriptionMeta.content = seoDescription;
      }

      const images = product.images || [];
      const selected = product.variants.find((variant) => variant.id === selectedVariantId) || product.variants[0];

      content.innerHTML = `
        <div class="product-detail__breadcrumbs"><a href="/catalog">Каталог</a><span>/</span><a href="/catalog?category=${escapeHtml(product.category?.slug || '')}">${escapeHtml(product.category?.name || 'Категория')}</a><span>/</span><span>${escapeHtml(product.title)}</span></div>
        <div class="product-detail__grid">
          <section class="product-detail__gallery">
            <div class="product-detail__main-image">${images[0] ? `<img ${window.KulturaImage.attrs(images[0].imagePath, {
              loading: 'eager',
              fetchpriority: 'high',
              fallbackWidth: 1200,
              fallbackHeight: 1200,
            })} alt="${escapeHtml(images[0].alt || product.title)}" data-product-main-image />` : ''}${product.badge ? `<b>${escapeHtml(product.badge)}</b>` : ''}</div>
            <div class="product-detail__thumbs">${images.map((image, index) => `<button type="button" class="${index === 0 ? 'is-active' : ''}" data-product-thumb="${index}"><img ${window.KulturaImage.attrs(image.imagePath, {
              loading: 'lazy',
              fallbackWidth: 320,
              fallbackHeight: 320,
            })} alt="" /></button>`).join('')}</div>
          </section>
          <section class="product-detail__info">
            <span class="product-detail__brand">${escapeHtml(product.brand?.name || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ')}</span>
            <h1>${escapeHtml(product.title)}</h1>
            <div class="product-detail__price" data-product-price>${renderVariantPrice(selected)}</div>
            <p class="product-detail__lead">${escapeHtml(product.shortDescription || '')}</p>
            ${product.variants.length > 1 ? `<div class="product-detail__variants"><span>Выберите вариант</span><div>${product.variants.map((variant, index) => `<button type="button" class="${index === 0 ? 'is-active' : ''}" data-product-variant="${variant.id}"><span>${escapeHtml(variant.name)}</span><strong>${formatMoney(variant.price)}</strong></button>`).join('')}</div></div>` : `<div class="product-detail__single-variant"><span>Формат</span><strong>${escapeHtml(selected?.name || 'Стандарт')}</strong></div>`}
            <div class="product-detail__quantity"><span>Количество</span><div><button type="button" data-quantity="minus">−</button><strong data-product-quantity>1</strong><button type="button" data-quantity="plus">+</button></div></div>
            <button class="product-detail__add" type="button" data-product-add>Добавить в корзину</button>
            <div class="product-detail__benefits"><div><strong>Подбор мастером</strong><span>Поможем выбрать продукт под состояние волос и задачу.</span></div><div><strong>Бережная упаковка</strong><span>Проверяем товар перед передачей клиенту.</span></div><div><strong>Самовывоз или доставка</strong><span>Способ получения уточняется при оформлении заказа.</span></div></div>
          </section>
        </div>
        <section class="product-detail__description"><span>О продукте</span><div>${product.description || `<p>${escapeHtml(product.shortDescription || '')}</p>`}</div></section>
        <div class="product-detail__mobile-bar"><div data-product-mobile-price>${renderVariantPrice(selected)}</div><button type="button" data-product-add>В корзину</button></div>
      `;

      bindProductEvents();
    }

    function bindProductEvents() {
      content.querySelectorAll('[data-product-thumb]').forEach((button) => button.addEventListener('click', () => {
        const image = product.images[Number(button.dataset.productThumb)];
        const mainImage = content.querySelector('[data-product-main-image]');
        if (image && mainImage) {
          window.KulturaImage.apply(mainImage, image.imagePath, {
            loading: 'eager',
            fetchpriority: 'high',
            fallbackWidth: 1200,
            fallbackHeight: 1200,
          });
          mainImage.alt = image.alt || product.title;
          content.querySelectorAll('[data-product-thumb]').forEach((item) => item.classList.toggle('is-active', item === button));
        }
      }));

      content.querySelectorAll('[data-product-variant]').forEach((button) => button.addEventListener('click', () => {
        selectedVariantId = Number(button.dataset.productVariant);
        content.querySelectorAll('[data-product-variant]').forEach((item) => item.classList.toggle('is-active', item === button));
        const selected = product.variants.find((variant) => variant.id === selectedVariantId);
        content.querySelectorAll('[data-product-price], [data-product-mobile-price]').forEach((element) => { element.innerHTML = renderVariantPrice(selected); });
      }));

      content.querySelectorAll('[data-quantity]').forEach((button) => button.addEventListener('click', () => {
        quantity = button.dataset.quantity === 'plus' ? Math.min(MAX_CART_QUANTITY, quantity + 1) : Math.max(1, quantity - 1);
        content.querySelector('[data-product-quantity]').textContent = String(quantity);
      }));

      content.querySelectorAll('[data-product-add]').forEach((button) => button.addEventListener('click', () => {
        if (selectedVariantId) addVariantToCart(selectedVariantId, quantity);
      }));
    }

    function renderVariantPrice(variant) {
      if (!variant) return '<strong>Цена уточняется</strong>';
      return `<strong>${formatMoney(variant.price)}</strong>${variant.oldPrice ? `<span>${formatMoney(variant.oldPrice)}</span>` : ''}`;
    }
  }

  function initCartPage() {
    const list = document.querySelector('[data-cart-items]');
    const loading = document.querySelector('[data-cart-loading]');
    const empty = document.querySelector('[data-cart-empty]');
    const content = document.querySelector('[data-cart-content]');
    const subtotal = document.querySelector('[data-cart-subtotal]');
    const total = document.querySelector('[data-cart-total]');
    const count = document.querySelector('[data-cart-count]');
    const checkout = document.querySelector('[data-cart-checkout]');
    const message = document.querySelector('[data-cart-message]');

    if (!list || !loading || !empty || !content || !subtotal || !total || !count || !checkout || !message) return;

    list.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-cart-action]');
      if (!action) return;
      const variantId = Number(action.dataset.variantId);
      const current = getCart().find((item) => Number(item.variantId) === variantId);
      if (!current) return;
      if (action.dataset.cartAction === 'increase') updateCartItem(variantId, Number(current.quantity) + 1);
      if (action.dataset.cartAction === 'decrease') updateCartItem(variantId, Number(current.quantity) - 1);
      if (action.dataset.cartAction === 'remove') removeCartItem(variantId);
      await renderCart();
    });

    renderCart();

    async function renderCart() {
      loading.hidden = false;
      message.hidden = true;
      try {
        const data = await validateCart();
        loading.hidden = true;
        if (!data.items.length) {
          empty.hidden = false;
          content.hidden = true;
          return;
        }
        empty.hidden = true;
        content.hidden = false;
        list.innerHTML = data.items.map((item) => `
          <article class="cart-product">
            <a class="cart-product__image" href="/catalog/product/${encodeURIComponent(item.product.slug)}">${item.product.image ? `<img ${window.KulturaImage.attrs(item.product.image.imagePath, {
              loading: 'lazy',
              fallbackWidth: 600,
              fallbackHeight: 600,
            })} alt="${escapeHtml(item.product.image.alt || item.product.title)}" />` : ''}</a>
            <div class="cart-product__info"><span>${escapeHtml(item.product.badge || 'КУЛЬТУРА ВОЛОС — КАТАЛОГ')}</span><h2><a href="/catalog/product/${encodeURIComponent(item.product.slug)}">${escapeHtml(item.product.title)}</a></h2><p>${escapeHtml(item.variantName)}</p><strong>${formatMoney(item.price)}</strong></div>
            <div class="cart-product__quantity"><button type="button" data-cart-action="decrease" data-variant-id="${item.variantId}">−</button><span>${item.quantity}</span><button type="button" data-cart-action="increase" data-variant-id="${item.variantId}">+</button></div>
            <strong class="cart-product__total">${formatMoney(item.lineTotal)}</strong>
            <button class="cart-product__remove" type="button" aria-label="Удалить товар" data-cart-action="remove" data-variant-id="${item.variantId}">×</button>
          </article>
        `).join('');
        const quantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
        subtotal.textContent = formatMoney(data.total);
        total.textContent = formatMoney(data.total);
        count.textContent = String(quantity);
        checkout.href = '/checkout';
      } catch (requestError) {
        loading.hidden = true;
        message.hidden = false;
        message.textContent = requestError.message || 'Не удалось обновить корзину.';
      }
    }
  }

  function initCheckoutPage() {
    const form = document.querySelector('[data-checkout-form]');
    const loading = document.querySelector('[data-checkout-loading]');
    const content = document.querySelector('[data-checkout-content]');
    const items = document.querySelector('[data-checkout-items]');
    const total = document.querySelector('[data-checkout-total]');
    const message = document.querySelector('[data-checkout-message]');
    const deliveryAddress = document.querySelector('[data-delivery-address]');
    const fulfillmentInputs = document.querySelectorAll('[name="fulfillmentMethod"]');

    if (!form || !loading || !content || !items || !total || !message || !deliveryAddress) return;

    let cartData = null;

    fulfillmentInputs.forEach((input) => input.addEventListener('change', () => {
      const isDelivery = form.elements.fulfillmentMethod.value === 'DELIVERY';
      deliveryAddress.hidden = !isDelivery;
      deliveryAddress.querySelector('input').required = isDelivery;
    }));

    form.addEventListener('submit', submitOrder);
    initialize();

    async function initialize() {
      try {
        cartData = await validateCart();
        if (!cartData.items.length) {
          window.location.replace('/cart');
          return;
        }
        items.innerHTML = cartData.items.map((item) => `<div class="checkout-summary-item"><span>${escapeHtml(item.product.title)} · ${escapeHtml(item.variantName)} × ${item.quantity}</span><strong>${formatMoney(item.lineTotal)}</strong></div>`).join('');
        total.textContent = formatMoney(cartData.total);
        loading.hidden = true;
        content.hidden = false;
      } catch (error) {
        loading.hidden = true;
        message.hidden = false;
        message.textContent = error.message || 'Не удалось подготовить оформление.';
      }
    }

    async function submitOrder(event) {
      event.preventDefault();
      if (!cartData?.items?.length) return;
      message.hidden = true;
      const submit = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const idempotencyKey = getOrderKey();
      const payload = {
        idempotencyKey,
        customerName: String(formData.get('customerName') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        fulfillmentMethod: String(formData.get('fulfillmentMethod') || 'PICKUP'),
        deliveryAddress: String(formData.get('deliveryAddress') || '').trim(),
        comment: String(formData.get('comment') || '').trim(),
        source: 'checkout-page',
        company: String(formData.get('company') || '').trim(),
        consentAccepted: formData.get('consentAccepted') === 'true',
        items: getCart(),
      };

      submit.disabled = true;
      submit.textContent = 'Оформляем заказ…';

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data.order) throw new Error(data?.message || 'Не удалось оформить заказ');
        saveCart([]);
        sessionStorage.removeItem(ORDER_KEY);
        const url = new URL('/order-success', window.location.origin);
        url.searchParams.set('number', data.order.publicNumber);
        url.searchParams.set('total', String(data.order.total));
        window.location.replace(`${url.pathname}${url.search}`);
      } catch (error) {
        message.hidden = false;
        message.textContent = error.message || 'Не удалось оформить заказ.';
        submit.disabled = false;
        submit.textContent = 'Подтвердить заказ';
      }
    }
  }

  function initOrderSuccessPage() {
    const params = new URLSearchParams(window.location.search);
    const number = params.get('number');
    const total = Number(params.get('total'));
    const numberElement = document.querySelector('[data-success-number]');
    const totalElement = document.querySelector('[data-success-total]');
    if (numberElement) numberElement.textContent = number || 'Заказ принят';
    if (totalElement) totalElement.textContent = Number.isFinite(total) && total > 0 ? formatMoney(total) : 'Сумма подтверждается';
  }

  function getOrderKey() {
    let value = sessionStorage.getItem(ORDER_KEY);

    if (!value) {
      value = createClientUuid();
      sessionStorage.setItem(ORDER_KEY, value);
    }

    return value;
  }

  function createClientUuid() {
    if (typeof window.crypto?.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);

    if (typeof window.crypto?.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));

    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  const sheetFocusSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function getOpenSheet() {
    return [...document.querySelectorAll('[data-sheet]')].find(
      (sheet) => !sheet.hidden,
    );
  }

  function getSheetFocusableElements(sheet) {
    const scope = sheet.querySelector('.catalog-sheet__dialog') || sheet;

    return [...scope.querySelectorAll(sheetFocusSelectors)].filter(
      (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
    );
  }

  function openSheet(sheet, trigger = document.activeElement) {
    if (!sheet) return;

    sheet._returnFocus = trigger instanceof HTMLElement ? trigger : null;
    sheet.hidden = false;
    document.body.classList.add('is-sheet-open');

    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      getSheetFocusableElements(sheet)[0]?.focus();
    });
  }

  function closeSheet(sheet, { restoreFocus = true } = {}) {
    if (!sheet || sheet.hidden) return;

    const returnFocus = sheet._returnFocus;
    sheet.classList.remove('is-open');
    document.body.classList.remove('is-sheet-open');

    window.setTimeout(() => {
      sheet.hidden = true;
      sheet._returnFocus = null;

      if (restoreFocus && returnFocus?.isConnected) {
        returnFocus.focus();
      }
    }, 220);
  }

  document.addEventListener('keydown', (event) => {
    const sheet = getOpenSheet();

    if (!sheet) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet(sheet);
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getSheetFocusableElements(sheet);

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function showToast(title, text) {
    let toast = document.querySelector('[data-catalog-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'catalog-toast';
      toast.dataset.catalogToast = '';
      toast.innerHTML = '<span>✓</span><div><strong></strong><p></p></div>';
      document.body.append(toast);
    }
    toast.querySelector('strong').textContent = title;
    toast.querySelector('p').textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toast.hideTimer);
    toast.hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function productWord(count) {
    const last = count % 10;
    const lastTwo = count % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return 'товаров';
    if (last === 1) return 'товар';
    if (last >= 2 && last <= 4) return 'товара';
    return 'товаров';
  }
})();
