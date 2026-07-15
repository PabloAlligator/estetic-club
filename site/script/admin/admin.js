'use strict';

(() => {
  const page = String(document.body?.dataset.adminPage || '');

  let csrfToken = '';

  document.addEventListener('DOMContentLoaded', () => {
    if (page === 'login') {
      initLoginPage();
      return;
    }

    initProtectedAdminPage();
  });

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });

    let data = null;

    if (response.status !== 204) {
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        data = await response.json();
      }
    }

    return {
      response,
      data,
    };
  }

  // вход

  async function initLoginPage() {
    const form = document.querySelector('[data-admin-login-form]');

    const emailInput = document.querySelector('[data-admin-email]');

    const passwordInput = document.querySelector('[data-admin-password]');

    const submitButton = document.querySelector('[data-admin-login-submit]');

    const submitText = document.querySelector('[data-admin-login-submit-text]');

    const loader = document.querySelector('[data-admin-login-loader]');

    const message = document.querySelector('[data-admin-login-message]');

    const passwordToggle = document.querySelector('[data-password-toggle]');

    const passwordToggleText = document.querySelector(
      '[data-password-toggle-text]',
    );

    if (!form || !emailInput || !passwordInput || !submitButton || !message) {
      return;
    }

    passwordToggle?.addEventListener('click', () => {
      const passwordIsVisible = passwordInput.type === 'text';

      passwordInput.type = passwordIsVisible ? 'password' : 'text';

      passwordToggle.setAttribute('aria-pressed', String(!passwordIsVisible));

      passwordToggle.setAttribute(
        'aria-label',
        passwordIsVisible ? 'Показать пароль' : 'Скрыть пароль',
      );

      if (passwordToggleText) {
        passwordToggleText.textContent = passwordIsVisible
          ? 'Показать'
          : 'Скрыть';
      }

      passwordInput.focus();
    });

    await redirectAuthenticatedUser();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      hideMessage(message);

      const email = emailInput.value.trim().toLowerCase();

      const password = passwordInput.value;

      if (!email || !password) {
        showMessage(message, 'Введите электронную почту и пароль.');

        return;
      }

      setLoginLoading({
        isLoading: true,
        submitButton,
        submitText,
        loader,
      });

      try {
        const { response, data } = await requestJson('/admin/api/auth/login', {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
            password,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            showMessage(
              message,
              'Слишком много попыток входа. Попробуйте позже.',
            );

            return;
          }

          showMessage(message, data?.message || 'Не удалось выполнить вход.');

          passwordInput.value = '';
          passwordInput.focus();

          return;
        }

        showMessage(message, 'Вход выполнен. Открываем панель…', true);

        const role = data?.user?.role;

        window.location.replace(
          role === 'STAFF' ? '/admin/requests' : '/admin/dashboard',
        );
      } catch (error) {
        console.error('Ошибка входа:', error);

        showMessage(
          message,
          'Не удалось связаться с сервером. Попробуйте ещё раз.',
        );
      } finally {
        setLoginLoading({
          isLoading: false,
          submitButton,
          submitText,
          loader,
        });
      }
    });
  }

  async function redirectAuthenticatedUser() {
    try {
      const { response, data } = await requestJson('/admin/api/auth/me');

      if (!response.ok || !data?.user) {
        return;
      }

      window.location.replace(
        data.user.role === 'STAFF' ? '/admin/requests' : '/admin/dashboard',
      );
    } catch {
      // оставляем страницу входа доступной
    }
  }

  // защищенная админка

  async function initProtectedAdminPage() {
    try {
      const { response, data } = await requestJson('/admin/api/auth/me');

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !data?.user) {
        throw new Error('Не удалось получить пользователя');
      }

      renderAdminUser(data.user);
      applyRoleVisibility(data.user.role);

      const csrfResult = await requestJson('/admin/api/auth/csrf');

      if (csrfResult.response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!csrfResult.response.ok || !csrfResult.data?.csrfToken) {
        throw new Error('Не удалось получить CSRF-токен');
      }

      csrfToken = csrfResult.data.csrfToken;

      bindLogout();

      if (page === 'dashboard') {
        await initDashboardPage();
      }

      if (page === 'requests') {
        await initRequestsPage(data.user);
      }

      if (page === 'staff') {
        await initStaffPage(data.user);
      }

      if (page === 'works') {
        await initAdminWorksPage(data.user);
      }

      if (page === 'work-edit') {
        await initAdminWorkEditorPage(data.user);
      }

      if (page === 'blog-edit') {
        await initAdminBlogEditorPage(data.user);
      }

      if (page === 'blog') {
        await initAdminBlogPage(data.user);
      }
    } catch (error) {
      console.error('Ошибка инициализации админ-панели:', error);

      redirectToLogin();
    }
  }

  function renderAdminUser(user) {
    setText('[data-admin-user-name]', user.name || 'пользователь');

    setText('[data-admin-user-email]', user.email || '—');

    setText('[data-admin-user-role]', formatRole(user.role));

    setText('[data-admin-role-card]', formatRole(user.role));
  }

  function applyRoleVisibility(role) {
    if (role === 'OWNER') {
      return;
    }

    document.querySelectorAll('[data-owner-only]').forEach((element) => {
      element.remove();
    });
  }

  // выход

  function bindLogout() {
    const logoutButtons = document.querySelectorAll('[data-admin-logout]');

    logoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        if (!csrfToken) {
          redirectToLogin();
          return;
        }

        button.disabled = true;

        try {
          const { response } = await requestJson('/admin/api/auth/logout', {
            method: 'POST',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          });

          if (response.ok || response.status === 401) {
            window.location.replace('/admin/login');

            return;
          }

          throw new Error('Сервер отклонил выход');
        } catch (error) {
          console.error('Ошибка выхода:', error);

          button.disabled = false;
        }
      });
    });
  }

  // dashboard

  async function initDashboardPage() {
    const content = document.querySelector('[data-dashboard-content]');

    const loading = document.querySelector('[data-dashboard-loading]');

    const message = document.querySelector('[data-dashboard-message]');

    const refreshButton = document.querySelector('[data-dashboard-refresh]');

    const latestLeadsList = document.querySelector(
      '[data-dashboard-latest-leads]',
    );

    const empty = document.querySelector('[data-dashboard-empty]');

    if (
      !content ||
      !loading ||
      !message ||
      !refreshButton ||
      !latestLeadsList ||
      !empty
    ) {
      return;
    }

    refreshButton.addEventListener('click', async () => {
      await loadDashboard();
    });

    await loadDashboard();

    async function loadDashboard() {
      setLoading(true);
      hideDashboardMessage();

      try {
        const { response, data } = await requestJson('/admin/api/dashboard');

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить dashboard');
        }

        renderDashboardCounts(data?.leads || {}, data?.content || {});

        renderLatestDashboardLeads(
          Array.isArray(data?.latestLeads) ? data.latestLeads : [],
        );

        content.hidden = false;
      } catch (error) {
        console.error('Ошибка загрузки dashboard:', error);

        content.hidden = true;

        showDashboardMessage(
          error.message || 'Не удалось загрузить данные dashboard.',
        );
      } finally {
        setLoading(false);
      }
    }

    function setLoading(isLoading) {
      loading.hidden = !isLoading;
      refreshButton.disabled = isLoading;

      if (isLoading) {
        content.hidden = true;
      }
    }

    function renderDashboardCounts(leads, contentCounts) {
      const leadCounts = {
        all: leads.all || 0,
        NEW: leads.NEW || 0,
        IN_PROGRESS: leads.IN_PROGRESS || 0,
        COMPLETED: leads.COMPLETED || 0,
        CANCELLED: leads.CANCELLED || 0,
      };

      Object.entries(leadCounts).forEach(([status, value]) => {
        setText(`[data-dashboard-lead-count="${status}"]`, String(value));
      });

      const values = {
        publishedWorks: contentCounts.publishedWorks || 0,
        articles: contentCounts.articles || 0,
        activeStaff: contentCounts.activeStaff || 0,
      };

      Object.entries(values).forEach(([name, value]) => {
        setText(`[data-dashboard-content-count="${name}"]`, String(value));
      });
    }

    function renderLatestDashboardLeads(leads) {
      if (!leads.length) {
        latestLeadsList.innerHTML = '';
        latestLeadsList.hidden = true;
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      latestLeadsList.innerHTML = leads
        .map((lead) => {
          const id = Number(lead.id);

          const status = getValidLeadStatus(lead.status);

          const phone = escapeHtml(lead.phone || '');

          const assignedName = lead.assignedTo?.name
            ? escapeHtml(lead.assignedTo.name)
            : 'Не назначена';

          return `
            <article
              class="admin-latest-lead"
              data-status="${status}"
            >
              <div class="admin-latest-lead__main">
                <span class="admin-latest-lead__number">
                  Заявка №${Number.isInteger(id) ? id : '—'}
                </span>

                <strong class="admin-latest-lead__name">
                  ${escapeHtml(lead.name || 'Без имени')}
                </strong>

                <span class="admin-latest-lead__service">
                  ${escapeHtml(lead.service || 'Услуга не указана')}
                </span>
              </div>

              <div class="admin-latest-lead__contact">
                <a href="tel:${phone}">
                  ${escapeHtml(formatPhone(lead.phone))}
                </a>

                <span>
                  ${escapeHtml(formatDate(lead.createdAt))}
                </span>
              </div>

              <div class="admin-latest-lead__state">
                <span class="admin-latest-lead__status">
                  ${formatLeadStatus(status)}
                </span>

                <span class="admin-latest-lead__assigned">
                  ${assignedName}
                </span>
              </div>
            </article>
          `;
        })
        .join('');

      latestLeadsList.hidden = false;
    }

    function showDashboardMessage(text) {
      message.textContent = text;
      message.hidden = false;
    }

    function hideDashboardMessage() {
      message.textContent = '';
      message.hidden = true;
    }
  }

  // заявки

  async function initRequestsPage(adminUser) {
    const canDeleteLeads = adminUser?.role === 'OWNER';

    const list = document.querySelector('[data-requests-list]');

    const loading = document.querySelector('[data-requests-loading]');

    const empty = document.querySelector('[data-requests-empty]');

    const message = document.querySelector('[data-requests-message]');

    const refreshButton = document.querySelector('[data-requests-refresh]');

    const searchForm = document.querySelector('[data-requests-search-form]');

    const searchInput = document.querySelector('[data-requests-search]');

    const searchReset = document.querySelector('[data-requests-search-reset]');

    const dateForm = document.querySelector('[data-requests-date-form]');

    const dateFromInput = document.querySelector('[data-requests-date-from]');

    const dateToInput = document.querySelector('[data-requests-date-to]');

    const dateReset = document.querySelector('[data-requests-date-reset]');

    const filterButtons = document.querySelectorAll('[data-request-filter]');

    const pagination = document.querySelector('[data-requests-pagination]');

    const paginationInfo = document.querySelector(
      '[data-requests-pagination-info]',
    );

    const prevButton = document.querySelector('[data-requests-prev]');

    const nextButton = document.querySelector('[data-requests-next]');

    if (
      !list ||
      !loading ||
      !empty ||
      !message ||
      !refreshButton ||
      !searchForm ||
      !searchInput ||
      !searchReset ||
      !dateForm ||
      !dateFromInput ||
      !dateToInput ||
      !dateReset ||
      !pagination ||
      !paginationInfo ||
      !prevButton ||
      !nextButton
    ) {
      return;
    }

    const searchSubmitButton = searchForm.querySelector(
      'button[type="submit"]',
    );

    const dateSubmitButton = dateForm.querySelector('button[type="submit"]');

    const state = {
      status: '',
      search: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 20,
      pages: 1,
      total: 0,
      isLoading: false,
    };

    let requestNumber = 0;

    refreshButton.addEventListener('click', async () => {
      await loadRequests();
    });

    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      state.search = searchInput.value.trim();

      state.page = 1;

      searchReset.hidden = !state.search;

      await loadRequests();
    });

    searchReset.addEventListener('click', async () => {
      searchInput.value = '';
      state.search = '';
      state.page = 1;

      searchReset.hidden = true;

      await loadRequests();
    });

    dateForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const dateFrom = dateFromInput.value;

      const dateTo = dateToInput.value;

      if (dateFrom && dateTo && dateFrom > dateTo) {
        showRequestsMessage('Дата «с» не может быть позже даты «по».');

        return;
      }

      state.dateFrom = dateFrom;
      state.dateTo = dateTo;
      state.page = 1;

      dateReset.hidden = !state.dateFrom && !state.dateTo;

      await loadRequests();
    });

    dateReset.addEventListener('click', async () => {
      dateFromInput.value = '';
      dateToInput.value = '';

      state.dateFrom = '';
      state.dateTo = '';
      state.page = 1;

      dateReset.hidden = true;

      await loadRequests();
    });

    filterButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        state.status = String(button.dataset.requestFilter || '');

        state.page = 1;

        updateActiveFilter();

        await loadRequests();
      });
    });

    prevButton.addEventListener('click', async () => {
      if (state.isLoading || state.page <= 1) {
        return;
      }

      state.page -= 1;

      await loadRequests();
    });

    nextButton.addEventListener('click', async () => {
      if (state.isLoading || state.page >= state.pages) {
        return;
      }

      state.page += 1;

      await loadRequests();
    });

    await loadRequests();

    async function loadRequests(options = {}) {
      const preserveMessage = options.preserveMessage === true;

      const currentRequest = ++requestNumber;

      if (!preserveMessage) {
        hideRequestsMessage();
      }

      setRequestsLoading(true);

      const params = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
      });

      if (state.status) {
        params.set('status', state.status);
      }

      if (state.search) {
        params.set('search', state.search);
      }

      if (state.dateFrom) {
        params.set('dateFrom', state.dateFrom);
      }

      if (state.dateTo) {
        params.set('dateTo', state.dateTo);
      }

      try {
        const { response, data } = await requestJson(
          `/admin/api/leads?${params.toString()}`,
        );

        if (currentRequest !== requestNumber) {
          return;
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить заявки');
        }

        const leads = Array.isArray(data?.leads) ? data.leads : [];

        state.page = Number(data?.pagination?.page) || 1;

        state.pages = Number(data?.pagination?.pages) || 1;

        state.total = Number(data?.pagination?.total) || 0;

        renderRequestCounts(data?.counts || {});

        renderRequests(leads);

        updatePagination();
        updateActiveFilter();

        searchReset.hidden = !state.search;

        dateReset.hidden = !state.dateFrom && !state.dateTo;
      } catch (error) {
        console.error('Ошибка загрузки заявок:', error);

        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;

        showRequestsMessage(error.message || 'Не удалось загрузить заявки.');
      } finally {
        if (currentRequest === requestNumber) {
          setRequestsLoading(false);
        }
      }
    }

    function setRequestsLoading(isLoading) {
      state.isLoading = isLoading;

      loading.hidden = !isLoading;
      refreshButton.disabled = isLoading;

      if (searchSubmitButton) {
        searchSubmitButton.disabled = isLoading;
      }

      if (dateSubmitButton) {
        dateSubmitButton.disabled = isLoading;
      }

      dateFromInput.disabled = isLoading;
      dateToInput.disabled = isLoading;

      filterButtons.forEach((button) => {
        button.disabled = isLoading;
      });

      if (isLoading) {
        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;
      }
    }

    function renderRequestCounts(counts) {
      const values = {
        all: counts.all || 0,
        NEW: counts.NEW || 0,
        IN_PROGRESS: counts.IN_PROGRESS || 0,
        COMPLETED: counts.COMPLETED || 0,
        CANCELLED: counts.CANCELLED || 0,
      };

      Object.entries(values).forEach(([status, value]) => {
        const element = document.querySelector(
          `[data-request-count="${status}"]`,
        );

        if (element) {
          element.textContent = String(value);
        }
      });
    }

    function renderRequests(leads) {
      if (!leads.length) {
        list.innerHTML = '';
        list.hidden = true;
        empty.hidden = false;

        return;
      }

      empty.hidden = true;

      list.innerHTML = leads.map(renderRequestCard).join('');

      list.hidden = false;

      bindRequestCards();
    }

    function renderRequestCard(lead) {
      const id = Number(lead.id);

      const status = getValidLeadStatus(lead.status);

      const statusLabel = formatLeadStatus(status);

      const name = escapeHtml(lead.name || 'Без имени');

      const phone = escapeHtml(lead.phone || '');

      const formattedPhone = escapeHtml(formatPhone(lead.phone));

      const service = escapeHtml(lead.service || 'Не указана');

      const messageText = lead.message
        ? escapeHtml(lead.message)
        : 'Комментарий не указан';

      const source = escapeHtml(formatLeadSource(lead.source));

      const createdAt = escapeHtml(formatDate(lead.createdAt));

      const updatedAt = escapeHtml(formatDate(lead.updatedAt));

      const consentText = lead.consentAccepted ? 'Получено' : 'Не получено';

      const consentDate = lead.consentAcceptedAt
        ? formatDate(lead.consentAcceptedAt)
        : '';

      const assignedName =
        lead.assignedTo?.name || lead.assignedTo?.email || 'Не назначена';

      const internalComment = escapeHtml(lead.internalComment || '');

      return `
        <article
          class="admin-request-card"
          data-lead-card="${id}"
          data-status="${status}"
        >
          <div class="admin-request-card__head">
            <div class="admin-request-card__identity">
              <span class="admin-request-card__number">
                Заявка №${id}
              </span>

              <h3 class="admin-request-card__name">
                ${name}
              </h3>

              <time class="admin-request-card__date">
                ${createdAt}
              </time>
            </div>

            <span
              class="admin-request-card__status"
              data-lead-status-badge
            >
              ${statusLabel}
            </span>
          </div>

          <div class="admin-request-card__body">
            <div class="admin-request-card__details">
              <div class="admin-request-card__info-grid">
                <div class="admin-request-card__info">
                  <span class="admin-request-card__label">
                    Телефон
                  </span>

                  <a
                    class="admin-request-card__phone"
                    href="tel:${phone}"
                  >
                    ${formattedPhone}
                  </a>
                </div>

                <div class="admin-request-card__info">
                  <span class="admin-request-card__label">
                    Услуга
                  </span>

                  <p class="admin-request-card__value">
                    ${service}
                  </p>
                </div>

                <div class="admin-request-card__info">
                  <span class="admin-request-card__label">
                    Источник
                  </span>

                  <p class="admin-request-card__value">
                    ${source}
                  </p>
                </div>

                <div class="admin-request-card__info">
                  <span class="admin-request-card__label">
                    Согласие
                  </span>

                  <p class="admin-request-card__value">
                    ${consentText}
                    ${consentDate ? ` · ${escapeHtml(consentDate)}` : ''}
                  </p>
                </div>
              </div>

              <div class="admin-request-card__message">
                <span class="admin-request-card__label">
                  Комментарий клиента
                </span>

                <p>${messageText}</p>
              </div>

              <div class="admin-request-card__meta">
                <span>
                  Создана: ${createdAt}
                </span>

                <span>
                  Обновлена: ${updatedAt}
                </span>
              </div>
            </div>

            <div class="admin-request-card__controls">
              <div class="admin-request-card__field">
                <label
                  class="admin-request-card__control-label"
                  for="lead-status-${id}"
                >
                  Статус заявки
                </label>

                <select
                  class="admin-request-card__select"
                  id="lead-status-${id}"
                  data-lead-status
                >
                  ${renderStatusOptions(status)}
                </select>
              </div>

              <div class="admin-request-card__field">
                <label
                  class="admin-request-card__control-label"
                  for="lead-comment-${id}"
                >
                  Внутренний комментарий
                </label>

                <textarea
                  class="admin-request-card__textarea"
                  id="lead-comment-${id}"
                  maxlength="2000"
                  placeholder="Например: позвонить вечером или уточнить историю окрашиваний"
                  data-lead-comment
                >${internalComment}</textarea>

                <span
                  class="admin-request-card__counter"
                  data-lead-comment-counter
                >
                  ${String(lead.internalComment || '').length} / 2000
                </span>
              </div>

              <p class="admin-request-card__assigned">
                Назначена:

                <strong data-lead-assigned>
                  ${escapeHtml(assignedName)}
                </strong>
              </p>

              <div class="admin-request-card__actions">
                <button
                  class="admin-request-card__save"
                  type="button"
                  data-lead-save
                >
                  Сохранить
                </button>

                <span
                  class="admin-request-card__save-status"
                  role="status"
                  aria-live="polite"
                  data-lead-save-status
                ></span>

                ${
                  canDeleteLeads
                    ? `
                      <button
                        class="admin-request-card__delete"
                        type="button"
                        aria-label="Удалить заявку №${id}"
                        data-lead-delete
                      >
                        Удалить
                      </button>
                    `
                    : ''
                }
              </div>
            </div>
          </div>
        </article>
      `;
    }

    function renderStatusOptions(currentStatus) {
      const statuses = [
        {
          value: 'NEW',
          label: 'Новая',
        },
        {
          value: 'IN_PROGRESS',
          label: 'В работе',
        },
        {
          value: 'COMPLETED',
          label: 'Завершена',
        },
        {
          value: 'CANCELLED',
          label: 'Отменена',
        },
      ];

      return statuses
        .map((item) => {
          const selected = item.value === currentStatus ? ' selected' : '';

          return `
            <option
              value="${item.value}"
              ${selected}
            >
              ${item.label}
            </option>
          `;
        })
        .join('');
    }

    function bindRequestCards() {
      list.querySelectorAll('[data-lead-card]').forEach((card) => {
        const comment = card.querySelector('[data-lead-comment]');

        const deleteButton = card.querySelector('[data-lead-delete]');

        const counter = card.querySelector('[data-lead-comment-counter]');

        const saveButton = card.querySelector('[data-lead-save]');

        deleteButton?.addEventListener('click', async () => {
          await deleteRequestCard(card);
        });

        comment?.addEventListener('input', () => {
          if (counter) {
            counter.textContent = `${comment.value.length} / 2000`;
          }
        });

        saveButton?.addEventListener('click', async () => {
          await saveRequestCard(card);
        });
      });
    }

    async function saveRequestCard(card) {
      const leadId = Number(card.dataset.leadCard);

      const statusSelect = card.querySelector('[data-lead-status]');

      const commentInput = card.querySelector('[data-lead-comment]');

      const saveButton = card.querySelector('[data-lead-save]');

      const saveStatus = card.querySelector('[data-lead-save-status]');

      if (
        !Number.isInteger(leadId) ||
        leadId <= 0 ||
        !statusSelect ||
        !commentInput ||
        !saveButton ||
        !saveStatus
      ) {
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Сохраняем…';

      saveStatus.textContent = '';

      saveStatus.classList.remove('is-error');

      try {
        const { response, data } = await requestJson(
          `/admin/api/leads/${leadId}`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type': 'application/json',

              'X-CSRF-Token': csrfToken,
            },

            body: JSON.stringify({
              status: statusSelect.value,

              internalComment: commentInput.value.trim(),
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось сохранить заявку');
        }

        saveStatus.textContent = 'Сохранено';

        showRequestsMessage('Заявка успешно обновлена.', true);

        await loadRequests({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка обновления заявки:', error);

        saveStatus.textContent = error.message || 'Ошибка сохранения';

        saveStatus.classList.add('is-error');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Сохранить';
      }
    }

    async function deleteRequestCard(card) {
      const leadId = Number(card.dataset.leadCard);

      const deleteButton = card.querySelector('[data-lead-delete]');

      if (!Number.isInteger(leadId) || leadId <= 0 || !deleteButton) {
        return;
      }

      const confirmed = window.confirm(
        `Удалить заявку №${leadId}?\n\nЭто действие нельзя отменить.`,
      );

      if (!confirmed) {
        return;
      }

      const cardsOnPage = list.querySelectorAll('[data-lead-card]').length;

      deleteButton.disabled = true;
      deleteButton.textContent = 'Удаляем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/leads/${leadId}`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          throw new Error('Удалять заявки может только OWNER');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось удалить заявку');
        }

        if (cardsOnPage === 1 && state.page > 1) {
          state.page -= 1;
        }

        showRequestsMessage(`Заявка №${leadId} удалена.`, true);

        await loadRequests({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка удаления заявки:', error);

        showRequestsMessage(error.message || 'Не удалось удалить заявку.');

        deleteButton.disabled = false;
        deleteButton.textContent = 'Удалить';
      }
    }

    function updatePagination() {
      paginationInfo.textContent = `Страница ${state.page} из ${state.pages}`;

      prevButton.disabled = state.page <= 1;

      nextButton.disabled = state.page >= state.pages;

      pagination.hidden = state.pages <= 1;
    }

    function updateActiveFilter() {
      filterButtons.forEach((button) => {
        const buttonStatus = String(button.dataset.requestFilter || '');

        button.classList.toggle('is-active', buttonStatus === state.status);
      });
    }

    function showRequestsMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);
    }

    function hideRequestsMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }
  }

  // статьи

  async function initAdminBlogPage(adminUser) {
    if (adminUser?.role !== 'OWNER') {
      window.location.replace('/admin/requests');
      return;
    }

    const refreshButton = document.querySelector('[data-admin-blog-refresh]');

    const searchForm = document.querySelector('[data-admin-blog-search-form]');

    const searchInput = document.querySelector('[data-admin-blog-search]');

    const searchReset = document.querySelector(
      '[data-admin-blog-search-reset]',
    );

    const statusButtons = document.querySelectorAll('[data-admin-blog-status]');

    const categorySelect = document.querySelector('[data-admin-blog-category]');

    const list = document.querySelector('[data-admin-blog-list]');

    const loading = document.querySelector('[data-admin-blog-loading]');

    const empty = document.querySelector('[data-admin-blog-empty]');

    const message = document.querySelector('[data-admin-blog-message]');

    const pagination = document.querySelector('[data-admin-blog-pagination]');

    const paginationInfo = document.querySelector(
      '[data-admin-blog-pagination-info]',
    );

    const prevButton = document.querySelector('[data-admin-blog-prev]');

    const nextButton = document.querySelector('[data-admin-blog-next]');

    if (
      !refreshButton ||
      !searchForm ||
      !searchInput ||
      !searchReset ||
      !categorySelect ||
      !list ||
      !loading ||
      !empty ||
      !message ||
      !pagination ||
      !paginationInfo ||
      !prevButton ||
      !nextButton
    ) {
      return;
    }

    const searchSubmitButton = searchForm.querySelector(
      'button[type="submit"]',
    );

    const state = {
      search: '',
      status: 'all',
      category: '',
      page: 1,
      limit: 20,
      pages: 1,
      total: 0,
      isLoading: false,
    };

    let requestNumber = 0;

    refreshButton.addEventListener('click', async () => {
      await loadAdminBlogPosts();
    });

    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      state.search = searchInput.value.trim();
      state.page = 1;

      searchReset.hidden = !state.search;

      await loadAdminBlogPosts();
    });

    searchReset.addEventListener('click', async () => {
      searchInput.value = '';

      state.search = '';
      state.page = 1;

      searchReset.hidden = true;

      await loadAdminBlogPosts();
    });

    statusButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const status = String(button.dataset.adminBlogStatus || 'all');

        if (status === state.status || state.isLoading) {
          return;
        }

        state.status = status;
        state.page = 1;

        updateActiveStatus();

        await loadAdminBlogPosts();
      });
    });

    categorySelect.addEventListener('change', async () => {
      state.category = categorySelect.value;
      state.page = 1;

      await loadAdminBlogPosts();
    });

    prevButton.addEventListener('click', async () => {
      if (state.isLoading || state.page <= 1) {
        return;
      }

      state.page -= 1;

      await loadAdminBlogPosts();
    });

    nextButton.addEventListener('click', async () => {
      if (state.isLoading || state.page >= state.pages) {
        return;
      }

      state.page += 1;

      await loadAdminBlogPosts();
    });

    await loadAdminBlogPosts();

    async function loadAdminBlogPosts(options = {}) {
      const preserveMessage = options.preserveMessage === true;

      const currentRequest = ++requestNumber;

      if (!preserveMessage) {
        hideAdminBlogMessage();
      }

      setAdminBlogLoading(true);

      const params = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
        status: state.status,
      });

      if (state.search) {
        params.set('search', state.search);
      }

      if (state.category) {
        params.set('category', state.category);
      }

      try {
        const { response, data } = await requestJson(
          `/admin/api/blog-posts?${params.toString()}`,
        );

        if (currentRequest !== requestNumber) {
          return;
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить статьи');
        }

        const posts = Array.isArray(data?.posts) ? data.posts : [];

        state.page = Number(data?.pagination?.page) || 1;

        state.pages = Number(data?.pagination?.pages) || 1;

        state.total = Number(data?.pagination?.total) || 0;

        renderAdminBlogCounts(data?.counts || {});

        renderAdminBlogPosts(posts);

        updateAdminBlogPagination();
        updateActiveStatus();

        searchReset.hidden = !state.search;
      } catch (error) {
        console.error('Ошибка загрузки статей:', error);

        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;

        showAdminBlogMessage(error.message || 'Не удалось загрузить статьи.');
      } finally {
        if (currentRequest === requestNumber) {
          setAdminBlogLoading(false);
        }
      }
    }

    function setAdminBlogLoading(isLoading) {
      state.isLoading = isLoading;

      loading.hidden = !isLoading;

      refreshButton.disabled = isLoading;
      categorySelect.disabled = isLoading;

      if (searchSubmitButton) {
        searchSubmitButton.disabled = isLoading;
      }

      statusButtons.forEach((button) => {
        button.disabled = isLoading;
      });

      prevButton.disabled = isLoading;
      nextButton.disabled = isLoading;

      if (isLoading) {
        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;
      }
    }

    function renderAdminBlogCounts(counts) {
      const values = {
        all: Number(counts.all) || 0,

        published: Number(counts.published) || 0,

        drafts: Number(counts.drafts) || 0,

        categories: Number(counts.categories) || 0,
      };

      Object.entries(values).forEach(([name, value]) => {
        const element = document.querySelector(
          `[data-admin-blog-count="${name}"]`,
        );

        if (element) {
          element.textContent = String(value);
        }
      });
    }

    function renderAdminBlogPosts(posts) {
      if (!posts.length) {
        list.innerHTML = '';
        list.hidden = true;
        empty.hidden = false;

        return;
      }

      empty.hidden = true;

      list.innerHTML = posts.map(renderAdminBlogCard).join('');

      list.hidden = false;

      bindAdminBlogImages();
    }

    function renderAdminBlogCard(post) {
      const id = Number(post.id);

      const isPublished = post.isPublished === true;

      const slug = String(post.slug || '');

      const coverImage = String(post.coverImage || '');

      const editUrl = `/admin/blog/edit?id=${encodeURIComponent(id)}`;

      const publicUrl = `/public/blog/article.html?slug=${encodeURIComponent(slug)}`;

      const publicationDate =
        isPublished && post.publishedAt
          ? formatDate(post.publishedAt)
          : 'Не опубликована';

      return `
      <article
        class="admin-work-card admin-blog-card${isPublished ? '' : ' is-draft'}"
        data-admin-blog-card="${id}"
        data-admin-blog-published="${String(isPublished)}"
      >
        <div class="admin-work-card__preview admin-blog-card__preview">
       <div class="admin-work-card__image admin-blog-card__image${
         coverImage ? '' : ' is-empty'
       }">
    ${
      coverImage
        ? `
          <img
            src="${escapeHtml(coverImage)}"
            alt="Обложка статьи: ${escapeHtml(post.title || 'Статья')}"
            loading="lazy"
          />
        `
        : ''
    }

    <span>Обложка статьи</span>
  </div>
</div>

        <div class="admin-work-card__content">
          <div class="admin-work-card__top">
            <div class="admin-work-card__identity">
              <span class="admin-work-card__category">
                ${escapeHtml(post.category || 'Без категории')}
              </span>

              <h3 class="admin-work-card__title">
                ${escapeHtml(post.title || 'Без названия')}
              </h3>
            </div>

            <div class="admin-work-card__badges">
              <span
                class="admin-work-card__badge ${
                  isPublished
                    ? 'admin-work-card__badge--published'
                    : 'admin-work-card__badge--draft'
                }"
              >
                ${isPublished ? 'Опубликована' : 'Черновик'}
              </span>
            </div>
          </div>

          <p class="admin-work-card__excerpt">
            ${escapeHtml(
              post.excerpt || 'Краткое описание статьи не заполнено.',
            )}
          </p>

          <div class="admin-work-card__meta">
            <span class="admin-work-card__meta-item">
              Категория:

              <strong>
                ${escapeHtml(post.categorySlug || 'Не указана')}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Чтение:

              <strong>
                ${escapeHtml(post.readingTime || 'Не указано')}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Публикация:

              <strong>
                ${escapeHtml(publicationDate)}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Обновлена:

              <strong>
                ${escapeHtml(formatDate(post.updatedAt))}
              </strong>
            </span>
          </div>

          <p class="admin-work-card__slug">
            /${escapeHtml(slug)}
          </p>

          <div class="admin-work-card__actions">
            <a
              class="admin-work-card__action admin-work-card__action--primary"
              href="${editUrl}"
            >
              Редактировать
            </a>

            ${
              isPublished
                ? `
                  <a
                    class="admin-work-card__action"
                    href="${publicUrl}"
                    target="_blank"
                    rel="noopener"
                  >
                    Открыть на сайте
                  </a>
                `
                : ''
            }
          </div>
        </div>
      </article>
    `;
    }

    function bindAdminBlogImages() {
      list.querySelectorAll('.admin-work-card__image img').forEach((image) => {
        image.addEventListener(
          'error',
          () => {
            const wrapper = image.closest('.admin-work-card__image');

            wrapper?.classList.add('is-empty');

            image.remove();
          },
          {
            once: true,
          },
        );
      });
    }

    function updateActiveStatus() {
      statusButtons.forEach((button) => {
        const buttonStatus = String(button.dataset.adminBlogStatus || 'all');

        button.classList.toggle('is-active', buttonStatus === state.status);
      });
    }

    function updateAdminBlogPagination() {
      paginationInfo.textContent = `Страница ${state.page} из ${state.pages}`;

      prevButton.disabled = state.page <= 1;

      nextButton.disabled = state.page >= state.pages;

      pagination.hidden = state.pages <= 1;
    }

    function showAdminBlogMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);
    }

    function hideAdminBlogMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }
  }

  // редактор статьи

  async function initAdminBlogEditorPage(adminUser) {
    if (adminUser?.role !== 'OWNER') {
      window.location.replace('/admin/requests');
      return;
    }

    const form = document.querySelector('[data-blog-editor-form]');

    const loading = document.querySelector('[data-blog-editor-loading]');

    const message = document.querySelector('[data-blog-editor-message]');

    const modeText = document.querySelector('[data-blog-editor-mode]');

    const editorTitle = document.querySelector('[data-blog-editor-title]');

    const editorState = document.querySelector('[data-blog-editor-state]');

    const saveButton = document.querySelector('[data-blog-save]');

    const deleteButton = document.querySelector('[data-blog-delete]');

    const publicLink = document.querySelector('[data-blog-public-link]');

    const metaId = document.querySelector('[data-blog-meta-id]');

    const metaStatus = document.querySelector('[data-blog-meta-status]');

    const fields = {
      title: document.querySelector('[data-blog-title]'),

      slug: document.querySelector('[data-blog-slug]'),

      categorySlug: document.querySelector('[data-blog-category]'),

      readingTime: document.querySelector('[data-blog-reading-time]'),

      excerpt: document.querySelector('[data-blog-excerpt]'),

      authorName: document.querySelector('[data-blog-author-name]'),

      authorRole: document.querySelector('[data-blog-author-role]'),

      expertNote: document.querySelector('[data-blog-expert-note]'),

      coverImage: document.querySelector('[data-blog-cover-input]'),

      coverAlt: document.querySelector('[data-blog-cover-alt]'),

      content: document.querySelector('[data-blog-content]'),

      focusKeyword: document.querySelector('[data-blog-focus-keyword]'),

      seoTitle: document.querySelector('[data-blog-seo-title]'),

      seoDescription: document.querySelector('[data-blog-seo-description]'),

      isPublished: document.querySelector('[data-blog-published]'),

      publishedAt: document.querySelector('[data-blog-published-at]'),
    };

    const coverPreview = document.querySelector(
      '[data-blog-cover-preview-img]',
    );

    const coverEmpty = document.querySelector('[data-blog-cover-empty]');

    const coverClearButton = document.querySelector('[data-blog-cover-clear]');

    const coverSelectButton = document.querySelector(
      '[data-blog-cover-select]',
    );

    const coverFileInput = document.querySelector('[data-blog-cover-file]');

    const coverUploadStatus = document.querySelector(
      '[data-blog-cover-upload-status]',
    );

    const seoPreviewTitle = document.querySelector(
      '[data-blog-seo-preview-title]',
    );

    const seoPreviewUrl = document.querySelector('[data-blog-seo-preview-url]');

    const seoPreviewDescription = document.querySelector(
      '[data-blog-seo-preview-description]',
    );

    if (
      !form ||
      !loading ||
      !message ||
      !modeText ||
      !editorTitle ||
      !editorState ||
      !saveButton ||
      !deleteButton ||
      !metaId ||
      !metaStatus ||
      !fields.title ||
      !fields.slug ||
      !fields.categorySlug ||
      !fields.excerpt ||
      !fields.content ||
      !fields.isPublished
    ) {
      console.error('Не найдены обязательные элементы редактора статьи');

      loading.hidden = true;
      return;
    }

    const params = new URLSearchParams(window.location.search);

    const requestedId = Number(params.get('id'));

    let postId =
      Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null;

    let isSaving = false;
    let isDeleting = false;
    let isUploadingCover = false;
    let savedIsPublished = false;
    let savedSlug = '';

    const uploadedBlogPathsThisSession = new Set();
    let slugWasEdited = Boolean(postId);

    bindCounter(fields.excerpt, '[data-blog-excerpt-counter]');

    bindCounter(fields.expertNote, '[data-blog-expert-note-counter]');

    bindCounter(fields.content, '[data-blog-content-counter]');

    bindCounter(fields.seoTitle, '[data-blog-seo-title-counter]');

    bindCounter(fields.seoDescription, '[data-blog-seo-description-counter]');

    fields.title.addEventListener('input', () => {
      if (!slugWasEdited) {
        fields.slug.value = createBlogSlug(fields.title.value);
      }

      updateSeoPreview();
    });

    fields.slug.addEventListener('input', () => {
      slugWasEdited = true;

      fields.slug.value = normalizeBlogSlug(fields.slug.value);

      updateSeoPreview();
    });

    fields.excerpt.addEventListener('input', updateSeoPreview);

    fields.seoTitle?.addEventListener('input', updateSeoPreview);

    fields.seoDescription?.addEventListener('input', updateSeoPreview);

    fields.isPublished.addEventListener('change', () => {
      if (
        fields.isPublished.checked &&
        fields.publishedAt &&
        !fields.publishedAt.value
      ) {
        fields.publishedAt.value = getCurrentKrasnoyarskDateTime();
      }

      updatePublicationState();
    });

    fields.coverImage?.addEventListener('input', updateCoverPreview);

    coverClearButton?.addEventListener('click', async () => {
      if (isSaving || isDeleting || isUploadingCover) {
        return;
      }

      const currentPath = fields.coverImage?.value.trim() || '';

      fields.coverImage.value = '';

      updateCoverPreview();

      if (uploadedBlogPathsThisSession.has(currentPath)) {
        await deleteUnsavedBlogCover(currentPath).catch((error) => {
          console.error('Не удалось удалить несохранённую обложку:', error);
        });
      }

      setCoverUploadStatus('');
    });

    coverSelectButton?.addEventListener('click', () => {
      if (isSaving || isDeleting || isUploadingCover) {
        return;
      }

      coverFileInput?.click();
    });

    coverFileInput?.addEventListener('change', async () => {
      const file = coverFileInput.files?.[0];

      coverFileInput.value = '';

      if (!file) {
        return;
      }

      const validationError = validateBlogCoverFile(file);

      if (validationError) {
        setCoverUploadStatus(validationError, true);

        return;
      }

      await uploadBlogCover(file);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      await saveBlogPost();
    });

    deleteButton.addEventListener('click', async () => {
      await deleteBlogPost();
    });

    await initializeEditor();

    async function initializeEditor() {
      hideMessage();

      loading.hidden = false;
      form.hidden = true;

      try {
        if (postId) {
          await loadBlogPost();
        } else {
          prepareNewPost();
        }

        updatePublicationState();
        updateCoverPreview();
        updateSeoPreview();
        updateAllCounters();

        form.hidden = false;
      } catch (error) {
        console.error('Ошибка загрузки редактора статьи:', error);

        showEditorMessage(
          error.message || 'Не удалось загрузить редактор статьи.',
        );
      } finally {
        loading.hidden = true;
      }
    }

    function prepareNewPost() {
      modeText.textContent = 'Новая статья';

      editorTitle.textContent = 'Создание экспертного материала';

      metaId.textContent = 'Новая';

      savedIsPublished = false;
      savedSlug = '';

      fields.categorySlug.value = fields.categorySlug.value || 'hair-care';

      fields.readingTime.value = fields.readingTime.value || '3 мин';

      fields.coverImage.value = '';

      deleteButton.hidden = true;
      publicLink.hidden = true;
    }

    async function loadBlogPost() {
      const { response, data } = await requestJson(
        `/admin/api/blog-posts/${postId}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (response.status === 403) {
        window.location.replace('/admin/requests');

        return;
      }

      if (!response.ok || !data?.post) {
        throw new Error(data?.message || 'Не удалось загрузить статью');
      }

      fillBlogPostForm(data.post);

      modeText.textContent = 'Редактирование статьи';

      editorTitle.textContent = 'Редактирование экспертного материала';

      metaId.textContent = String(data.post.id);

      deleteButton.hidden = false;
    }

    function fillBlogPostForm(post) {
      fields.title.value = post.title || '';

      fields.slug.value = post.slug || '';

      fields.categorySlug.value = post.categorySlug || 'hair-care';

      fields.readingTime.value = post.readingTime || '3 мин';

      fields.excerpt.value = post.excerpt || '';

      fields.authorName.value = post.authorName || '';

      fields.authorRole.value = post.authorRole || '';

      fields.expertNote.value = post.expertNote || '';

      fields.coverImage.value =
        post.coverImage || '/site/img/blog/blog-hero.png';

      fields.coverAlt.value = post.coverAlt || '';

      fields.content.value = post.content || '';

      fields.focusKeyword.value = post.focusKeyword || '';

      fields.seoTitle.value = post.seoTitle || '';

      fields.seoDescription.value = post.seoDescription || '';

      savedIsPublished = post.isPublished === true;

      savedSlug = String(post.slug || '');

      fields.isPublished.checked = savedIsPublished;

      if (fields.publishedAt) {
        fields.publishedAt.value = formatKrasnoyarskDateTimeInput(
          post.publishedAt,
        );
      }

      slugWasEdited = true;
    }

    function validateBlogCoverFile(file) {
      const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/heif',
      ]);

      if (file.type && !allowedTypes.has(file.type.toLowerCase())) {
        return 'Поддерживаются JPG, PNG, WebP, AVIF и HEIC.';
      }

      const maxSize = 12 * 1024 * 1024;

      if (file.size > maxSize) {
        return 'Обложка должна весить не больше 12 МБ.';
      }

      return '';
    }

    async function uploadBlogCover(file) {
      const previousPath = fields.coverImage?.value.trim() || '';

      isUploadingCover = true;

      setEditorBusy(true);

      setCoverUploadStatus('Обрабатываем обложку…');

      const formData = new FormData();

      formData.append('image', file);

      try {
        const { response, data } = await requestJson(
          '/admin/api/uploads/blog-image',
          {
            method: 'POST',

            headers: {
              'X-CSRF-Token': csrfToken,
            },

            body: formData,
          },
        );

        if (response.status === 401) {
          redirectToLogin();

          return;
        }

        if (response.status === 403) {
          throw new Error('Загружать обложки может только OWNER');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить обложку');
        }

        const uploadedPath = String(data?.image?.path || '').trim();

        if (!uploadedPath) {
          throw new Error('Сервер не вернул путь обложки');
        }

        fields.coverImage.value = uploadedPath;

        uploadedBlogPathsThisSession.add(uploadedPath);

        updateCoverPreview();

        if (
          previousPath &&
          previousPath !== uploadedPath &&
          uploadedBlogPathsThisSession.has(previousPath)
        ) {
          await deleteUnsavedBlogCover(previousPath).catch((error) => {
            console.error('Не удалось удалить заменённую обложку:', error);
          });
        }

        setCoverUploadStatus('Обложка загружена');
      } catch (error) {
        console.error('Ошибка загрузки обложки:', error);

        setCoverUploadStatus(
          error.message || 'Не удалось загрузить обложку',
          true,
        );
      } finally {
        isUploadingCover = false;

        setEditorBusy(false);
      }
    }

    async function deleteUnsavedBlogCover(imagePath) {
      const { response, data } = await requestJson(
        '/admin/api/uploads/blog-image',
        {
          method: 'DELETE',

          headers: {
            'Content-Type': 'application/json',

            'X-CSRF-Token': csrfToken,
          },

          body: JSON.stringify({
            path: imagePath,
          }),
        },
      );

      if (response.status === 401) {
        redirectToLogin();

        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось удалить обложку');
      }

      uploadedBlogPathsThisSession.delete(imagePath);
    }

    function setCoverUploadStatus(text, isError = false) {
      if (!coverUploadStatus) {
        return;
      }

      coverUploadStatus.textContent = text;

      coverUploadStatus.classList.toggle('is-error', isError);
    }

    async function saveBlogPost() {
      if (isUploadingCover) {
        showEditorMessage('Дождитесь окончания загрузки обложки.');

        return;
      }

      if (isSaving || isDeleting) {
        return;
      }

      hideMessage();

      const payload = createBlogPostPayload();

      const validationMessage = validateBlogPostPayload(payload);

      if (validationMessage) {
        showEditorMessage(validationMessage);

        return;
      }

      isSaving = true;
      setEditorBusy(true);

      const isCreating = !postId;

      const url = isCreating
        ? '/admin/api/blog-posts'
        : `/admin/api/blog-posts/${postId}`;

      try {
        const { response, data } = await requestJson(url, {
          method: isCreating ? 'POST' : 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            'X-CSRF-Token': csrfToken,
          },

          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');

          return;
        }

        if (!response.ok || !data?.post) {
          throw new Error(data?.message || 'Не удалось сохранить статью');
        }

        const savedPost = data.post;

        uploadedBlogPathsThisSession.delete(
          String(savedPost.coverImage || '').trim(),
        );

        postId = Number(savedPost.id);

        window.history.replaceState(
          null,
          '',
          `/admin/blog/edit?id=${encodeURIComponent(postId)}`,
        );

        fillBlogPostForm(savedPost);

        modeText.textContent = 'Редактирование статьи';

        editorTitle.textContent = 'Редактирование экспертного материала';

        metaId.textContent = String(postId);

        deleteButton.hidden = false;

        updatePublicationState();
        updateCoverPreview();
        updateSeoPreview();
        updateAllCounters();

        showEditorMessage(
          isCreating
            ? 'Статья создана и сохранена.'
            : 'Изменения статьи сохранены.',
          true,
        );
      } catch (error) {
        console.error('Ошибка сохранения статьи:', error);

        showEditorMessage(error.message || 'Не удалось сохранить статью.');
      } finally {
        isSaving = false;
        setEditorBusy(false);
      }
    }

    function createBlogPostPayload() {
      return {
        title: fields.title.value.trim(),

        slug: normalizeBlogSlug(fields.slug.value),

        categorySlug: fields.categorySlug.value,

        readingTime: fields.readingTime?.value.trim() || '',

        excerpt: fields.excerpt.value.trim(),

        authorName: fields.authorName?.value.trim() || '',

        authorRole: fields.authorRole?.value.trim() || '',

        expertNote: fields.expertNote?.value.trim() || '',

        coverImage: fields.coverImage?.value.trim() || '',

        coverAlt: fields.coverAlt?.value.trim() || '',

        content: fields.content.value.trim(),

        focusKeyword: fields.focusKeyword?.value.trim() || '',

        seoTitle: fields.seoTitle?.value.trim() || '',

        seoDescription: fields.seoDescription?.value.trim() || '',

        isPublished: fields.isPublished.checked,

        publishedAt: fields.publishedAt?.value || '',
      };
    }

    function validateBlogPostPayload(payload) {
      if (payload.title.length < 2) {
        return 'Введите заголовок статьи.';
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
        return 'Проверьте адрес статьи: разрешены латинские буквы, цифры и дефисы.';
      }

      if (!payload.categorySlug) {
        return 'Выберите категорию статьи.';
      }

      if (payload.excerpt.length < 20) {
        return 'Краткое описание должно содержать не менее 20 символов.';
      }

      if (!payload.isPublished) {
        return '';
      }

      const plainContent = createPlainText(payload.content);

      if (plainContent.length < 300) {
        return 'Для публикации добавьте не менее 300 символов полезного текста.';
      }

      if (
        !payload.coverImage ||
        payload.coverImage === '/site/img/blog/blog-hero.png'
      ) {
        return 'Для публикации загрузите уникальную обложку.';
      }

      if (payload.coverAlt.length < 5) {
        return 'Добавьте описание обложки.';
      }

      if (payload.authorName.length < 2) {
        return 'Укажите автора статьи.';
      }

      if (payload.authorRole.length < 2) {
        return 'Укажите специализацию автора.';
      }

      if (payload.seoTitle.length < 20) {
        return 'Заполните SEO Title.';
      }

      if (payload.seoDescription.length < 80) {
        return 'Meta description должен содержать не менее 80 символов.';
      }

      return '';
    }

    async function deleteBlogPost() {
      if (!postId || isSaving || isDeleting || isUploadingCover) {
        return;
      }

      const title = fields.title.value.trim() || `Статья №${postId}`;

      const confirmed = window.confirm(
        `Удалить статью «${title}»?\n\nЭто действие нельзя отменить.`,
      );

      if (!confirmed) {
        return;
      }

      isDeleting = true;
      setEditorBusy(true);

      try {
        const { response, data } = await requestJson(
          `/admin/api/blog-posts/${postId}`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось удалить статью');
        }

        window.location.replace('/admin/blog');
      } catch (error) {
        console.error('Ошибка удаления статьи:', error);

        showEditorMessage(error.message || 'Не удалось удалить статью.');

        isDeleting = false;
        setEditorBusy(false);
      }
    }

    function setEditorBusy(isBusy) {
      saveButton.disabled = isBusy;

      deleteButton.disabled = isBusy;

      fields.isPublished.disabled = isBusy;

      if (fields.publishedAt) {
        fields.publishedAt.disabled = isBusy;
      }

      saveButton.textContent = isSaving ? 'Сохраняем…' : 'Сохранить статью';

      if (isDeleting) {
        deleteButton.textContent = 'Удаляем…';
      } else {
        deleteButton.textContent = 'Удалить статью';
      }
    }

    function updatePublicationState() {
      const selectedIsPublished = fields.isPublished.checked;

      const hasPendingChange = selectedIsPublished !== savedIsPublished;

      let statusText = savedIsPublished ? 'Опубликована' : 'Черновик';

      if (hasPendingChange) {
        statusText = selectedIsPublished
          ? 'Будет опубликована после сохранения'
          : 'Будет снята после сохранения';
      }

      editorState.textContent = statusText;

      metaStatus.textContent = statusText;

      editorState.classList.toggle(
        'is-published',
        savedIsPublished && !hasPendingChange,
      );

      editorState.classList.toggle('is-pending', hasPendingChange);

      if (publicLink && postId && savedIsPublished && savedSlug) {
        publicLink.href = `/public/blog/article.html?slug=${encodeURIComponent(
          savedSlug,
        )}`;

        publicLink.hidden = false;
      } else if (publicLink) {
        publicLink.hidden = true;

        publicLink.removeAttribute('href');
      }
    }

    function updateCoverPreview() {
      if (
        !coverPreview ||
        !coverEmpty ||
        !coverClearButton ||
        !fields.coverImage
      ) {
        return;
      }

      const imagePath = fields.coverImage.value.trim();

      if (!imagePath) {
        coverPreview.hidden = true;
        coverPreview.removeAttribute('src');

        coverEmpty.hidden = false;
        coverEmpty.textContent = 'Обложка не выбрана';

        coverClearButton.hidden = true;

        return;
      }

      coverPreview.onload = () => {
        coverPreview.hidden = false;
        coverEmpty.hidden = true;
      };

      coverPreview.onerror = () => {
        coverPreview.hidden = true;

        coverEmpty.hidden = false;
        coverEmpty.textContent = 'Изображение не найдено';
      };

      coverPreview.src = imagePath;

      coverClearButton.hidden = false;
    }

    function updateSeoPreview() {
      const title =
        fields.seoTitle?.value.trim() ||
        fields.title.value.trim() ||
        'Заголовок статьи';

      const slug = fields.slug.value.trim();

      const description =
        fields.seoDescription?.value.trim() ||
        fields.excerpt.value.trim() ||
        'Описание страницы появится здесь после заполнения SEO-настроек.';

      if (seoPreviewTitle) {
        seoPreviewTitle.textContent = title;
      }

      if (seoPreviewUrl) {
        seoPreviewUrl.textContent = slug
          ? `nadia-hair.ru/public/blog/article.html?slug=${slug}`
          : 'nadia-hair.ru/public/blog/article.html';
      }

      if (seoPreviewDescription) {
        seoPreviewDescription.textContent = description;
      }

      updatePublicationState();
    }

    function bindCounter(input, selector) {
      const counter = document.querySelector(selector);

      if (!input || !counter) {
        return;
      }

      const update = () => {
        counter.textContent = String(input.value.length);
      };

      input.addEventListener('input', update);

      update();
    }

    function updateAllCounters() {
      const bindings = [
        [fields.excerpt, '[data-blog-excerpt-counter]'],
        [fields.expertNote, '[data-blog-expert-note-counter]'],
        [fields.content, '[data-blog-content-counter]'],
        [fields.seoTitle, '[data-blog-seo-title-counter]'],
        [fields.seoDescription, '[data-blog-seo-description-counter]'],
      ];

      bindings.forEach(([input, selector]) => {
        const counter = document.querySelector(selector);

        if (input && counter) {
          counter.textContent = String(input.value.length);
        }
      });
    }

    function showEditorMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);

      message.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    function hideMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }

    function createPlainText(value) {
      const container = document.createElement('div');

      container.innerHTML = String(value || '');

      return String(container.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function formatKrasnoyarskDateTimeInput(value) {
      if (!value) {
        return '';
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return '';
      }

      const localDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);

      return localDate.toISOString().slice(0, 16);
    }

    function getCurrentKrasnoyarskDateTime() {
      const localDate = new Date(Date.now() + 7 * 60 * 60 * 1000);

      return localDate.toISOString().slice(0, 16);
    }

    function createBlogSlug(value) {
      const transliteration = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ё: 'e',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'c',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
      };

      const result = String(value || '')
        .trim()
        .toLowerCase()
        .split('')
        .map((character) => transliteration[character] ?? character)
        .join('');

      return normalizeBlogSlug(result);
    }

    function normalizeBlogSlug(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
  }

  // работы

  async function initAdminWorksPage(adminUser) {
    if (adminUser?.role !== 'OWNER') {
      window.location.replace('/admin/requests');
      return;
    }

    const refreshButton = document.querySelector('[data-admin-works-refresh]');

    const searchForm = document.querySelector('[data-admin-works-search-form]');

    const searchInput = document.querySelector('[data-admin-works-search]');

    const searchReset = document.querySelector(
      '[data-admin-works-search-reset]',
    );

    const statusButtons = document.querySelectorAll(
      '[data-admin-works-status]',
    );

    const categorySelect = document.querySelector(
      '[data-admin-works-category]',
    );

    const list = document.querySelector('[data-admin-works-list]');

    const loading = document.querySelector('[data-admin-works-loading]');

    const empty = document.querySelector('[data-admin-works-empty]');

    const message = document.querySelector('[data-admin-works-message]');

    const pagination = document.querySelector('[data-admin-works-pagination]');

    const paginationInfo = document.querySelector(
      '[data-admin-works-pagination-info]',
    );

    const prevButton = document.querySelector('[data-admin-works-prev]');

    const nextButton = document.querySelector('[data-admin-works-next]');

    if (
      !refreshButton ||
      !searchForm ||
      !searchInput ||
      !searchReset ||
      !categorySelect ||
      !list ||
      !loading ||
      !empty ||
      !message ||
      !pagination ||
      !paginationInfo ||
      !prevButton ||
      !nextButton
    ) {
      return;
    }

    const searchSubmitButton = searchForm.querySelector(
      'button[type="submit"]',
    );

    const state = {
      search: '',
      status: 'all',
      category: '',
      page: 1,
      limit: 20,
      pages: 1,
      total: 0,
      isLoading: false,
    };

    let requestNumber = 0;

    refreshButton.addEventListener('click', async () => {
      await loadAdminWorks();
    });

    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      state.search = searchInput.value.trim();

      state.page = 1;

      searchReset.hidden = !state.search;

      await loadAdminWorks();
    });

    searchReset.addEventListener('click', async () => {
      searchInput.value = '';

      state.search = '';
      state.page = 1;

      searchReset.hidden = true;

      await loadAdminWorks();
    });

    statusButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const status = String(button.dataset.adminWorksStatus || 'all');

        if (status === state.status || state.isLoading) {
          return;
        }

        state.status = status;
        state.page = 1;

        updateActiveStatus();

        await loadAdminWorks();
      });
    });

    categorySelect.addEventListener('change', async () => {
      state.category = categorySelect.value;

      state.page = 1;

      await loadAdminWorks();
    });

    prevButton.addEventListener('click', async () => {
      if (state.isLoading || state.page <= 1) {
        return;
      }

      state.page -= 1;

      await loadAdminWorks();
    });

    nextButton.addEventListener('click', async () => {
      if (state.isLoading || state.page >= state.pages) {
        return;
      }

      state.page += 1;

      await loadAdminWorks();
    });

    await loadAdminWorks();

    async function loadAdminWorks(options = {}) {
      const preserveMessage = options.preserveMessage === true;

      const currentRequest = ++requestNumber;

      if (!preserveMessage) {
        hideAdminWorksMessage();
      }

      setAdminWorksLoading(true);

      const params = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
        status: state.status,
      });

      if (state.search) {
        params.set('search', state.search);
      }

      if (state.category) {
        params.set('category', state.category);
      }

      try {
        const { response, data } = await requestJson(
          `/admin/api/works?${params.toString()}`,
        );

        if (currentRequest !== requestNumber) {
          return;
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');

          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить работы');
        }

        const works = Array.isArray(data?.works) ? data.works : [];

        state.page = Number(data?.pagination?.page) || 1;

        state.pages = Number(data?.pagination?.pages) || 1;

        state.total = Number(data?.pagination?.total) || 0;

        renderAdminWorkCounts(data?.counts || {});

        renderAdminWorks(works);

        updateAdminWorksPagination();
        updateActiveStatus();

        searchReset.hidden = !state.search;
      } catch (error) {
        console.error('Ошибка загрузки работ:', error);

        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;

        showAdminWorksMessage(error.message || 'Не удалось загрузить работы.');
      } finally {
        if (currentRequest === requestNumber) {
          setAdminWorksLoading(false);
        }
      }
    }

    function setAdminWorksLoading(isLoading) {
      state.isLoading = isLoading;

      loading.hidden = !isLoading;

      refreshButton.disabled = isLoading;

      categorySelect.disabled = isLoading;

      if (searchSubmitButton) {
        searchSubmitButton.disabled = isLoading;
      }

      statusButtons.forEach((button) => {
        button.disabled = isLoading;
      });

      if (isLoading) {
        list.hidden = true;
        empty.hidden = true;
        pagination.hidden = true;
      }
    }

    function renderAdminWorkCounts(counts) {
      const values = {
        all: Number(counts.all) || 0,

        published: Number(counts.published) || 0,

        drafts: Number(counts.drafts) || 0,

        onHome: Number(counts.onHome) || 0,
      };

      Object.entries(values).forEach(([name, value]) => {
        const element = document.querySelector(
          `[data-admin-works-count="${name}"]`,
        );

        if (element) {
          element.textContent = String(value);
        }
      });
    }

    function renderAdminWorks(works) {
      if (!works.length) {
        list.innerHTML = '';
        list.hidden = true;
        empty.hidden = false;

        return;
      }

      empty.hidden = true;

      list.innerHTML = works.map(renderAdminWorkCard).join('');

      list.hidden = false;

      bindAdminWorkCards();
      bindAdminWorkImages();
    }

    function renderAdminWorkCard(work) {
      const id = Number(work.id);

      const isPublished = work.isPublished === true;

      const showOnHome = work.showOnHome === true;

      const galleryCount = Number(work._count?.images) || 0;

      const slug = String(work.slug || '');

      const publicUrl = `/public/works/work-detail.html?slug=${encodeURIComponent(
        slug,
      )}`;

      const editUrl = `/admin/works/edit?id=${encodeURIComponent(id)}`;

      return `
      <article
        class="admin-work-card${isPublished ? '' : ' is-draft'}"
        data-admin-work-card="${id}"
        data-admin-work-published="${String(isPublished)}"
        data-admin-work-home="${String(showOnHome)}"
      >
        <div class="admin-work-card__preview">
          <div class="admin-work-card__image">
            <img
              src="${escapeHtml(work.afterImage || '')}"
              alt="После: ${escapeHtml(work.title || 'Работа')}"
              loading="lazy"
            />

            <span>После</span>
          </div>

          <div class="admin-work-card__image">
            <img
              src="${escapeHtml(work.beforeImage || '')}"
              alt="До: ${escapeHtml(work.title || 'Работа')}"
              loading="lazy"
            />

            <span>До</span>
          </div>
        </div>

        <div class="admin-work-card__content">
          <div class="admin-work-card__top">
            <div class="admin-work-card__identity">
              <span class="admin-work-card__category">
                ${escapeHtml(work.category || 'Без категории')}
              </span>

              <h3 class="admin-work-card__title">
                ${escapeHtml(work.title || 'Без названия')}
              </h3>
            </div>

            <div class="admin-work-card__badges">
              <span
                class="admin-work-card__badge ${
                  isPublished
                    ? 'admin-work-card__badge--published'
                    : 'admin-work-card__badge--draft'
                }"
              >
                ${isPublished ? 'Опубликована' : 'Черновик'}
              </span>

              ${
                showOnHome
                  ? `
                    <span
                      class="admin-work-card__badge admin-work-card__badge--home"
                    >
                      На главной
                    </span>
                  `
                  : ''
              }
            </div>
          </div>

          <p class="admin-work-card__excerpt">
            ${escapeHtml(work.excerpt || 'Описание работы не заполнено.')}
          </p>

          <div class="admin-work-card__meta">
            <span class="admin-work-card__meta-item">
              Техника:

              <strong>
                ${escapeHtml(work.technique || work.category || 'Не указана')}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Время:

              <strong>
                ${escapeHtml(work.duration || 'Не указано')}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Галерея:

              <strong>
                ${galleryCount}
              </strong>
            </span>

            <span class="admin-work-card__meta-item">
              Создана:

              <strong>
                ${escapeHtml(formatDate(work.createdAt))}
              </strong>
            </span>
          </div>

          <p class="admin-work-card__slug">
            /${escapeHtml(slug)}
          </p>

          <div class="admin-work-card__actions">
            <a
              class="admin-work-card__action admin-work-card__action--primary"
              href="${editUrl}"
            >
              Редактировать
            </a>

            ${
              isPublished
                ? `
                  <a
                    class="admin-work-card__action"
                    href="${publicUrl}"
                    target="_blank"
                    rel="noopener"
                  >
                    Открыть на сайте
                  </a>
                `
                : ''
            }

            <button
              class="admin-work-card__action ${
                isPublished ? 'admin-work-card__action--active' : ''
              }"
              type="button"
              data-admin-work-publish
            >
              ${isPublished ? 'Снять с публикации' : 'Опубликовать'}
            </button>

            <button
              class="admin-work-card__action ${
                showOnHome ? 'admin-work-card__action--active' : ''
              }"
              type="button"
              data-admin-work-home
              ${isPublished ? '' : 'disabled'}
              title="${isPublished ? '' : 'Сначала опубликуйте работу'}"
            >
              ${showOnHome ? 'Убрать с главной' : 'Добавить на главную'}
            </button>

            <button
              class="admin-work-card__action admin-work-card__action--danger"
              type="button"
              data-admin-work-delete
            >
              Удалить
            </button>
          </div>
        </div>
      </article>
    `;
    }

    function bindAdminWorkCards() {
      list.querySelectorAll('[data-admin-work-card]').forEach((card) => {
        const publishButton = card.querySelector('[data-admin-work-publish]');

        const homeButton = card.querySelector('[data-admin-work-home]');

        const deleteButton = card.querySelector('[data-admin-work-delete]');

        publishButton?.addEventListener('click', async () => {
          await toggleWorkPublication(card, publishButton);
        });

        homeButton?.addEventListener('click', async () => {
          await toggleWorkHome(card, homeButton);
        });

        deleteButton?.addEventListener('click', async () => {
          await deleteAdminWork(card, deleteButton);
        });
      });
    }

    function bindAdminWorkImages() {
      list.querySelectorAll('.admin-work-card__image img').forEach((image) => {
        image.addEventListener(
          'error',
          () => {
            const wrapper = image.closest('.admin-work-card__image');

            wrapper?.classList.add('is-empty');

            image.remove();
          },
          {
            once: true,
          },
        );
      });
    }

    async function toggleWorkPublication(card, button) {
      const workId = Number(card.dataset.adminWorkCard);

      const isPublished = card.dataset.adminWorkPublished === 'true';

      if (!Number.isInteger(workId) || workId <= 0) {
        return;
      }

      const nextIsPublished = !isPublished;

      const confirmed = window.confirm(
        nextIsPublished
          ? 'Опубликовать эту работу на сайте?'
          : 'Снять работу с публикации? Она также будет убрана с главной страницы.',
      );

      if (!confirmed) {
        return;
      }

      const originalText = button.textContent;

      button.disabled = true;

      button.textContent = nextIsPublished ? 'Публикуем…' : 'Снимаем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/works/${workId}/publish`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type': 'application/json',

              'X-CSRF-Token': csrfToken,
            },

            body: JSON.stringify({
              isPublished: nextIsPublished,
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось изменить публикацию');
        }

        showAdminWorksMessage(
          nextIsPublished
            ? 'Работа опубликована.'
            : 'Работа снята с публикации.',
          true,
        );

        await loadAdminWorks({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка публикации работы:', error);

        showAdminWorksMessage(
          error.message || 'Не удалось изменить публикацию.',
        );

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function toggleWorkHome(card, button) {
      const workId = Number(card.dataset.adminWorkCard);

      const showOnHome = card.dataset.adminWorkHome === 'true';

      const isPublished = card.dataset.adminWorkPublished === 'true';

      if (!Number.isInteger(workId) || workId <= 0 || !isPublished) {
        return;
      }

      const nextShowOnHome = !showOnHome;

      const originalText = button.textContent;

      button.disabled = true;

      button.textContent = nextShowOnHome ? 'Добавляем…' : 'Убираем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/works/${workId}/home`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type': 'application/json',

              'X-CSRF-Token': csrfToken,
            },

            body: JSON.stringify({
              showOnHome: nextShowOnHome,
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(
            data?.message || 'Не удалось изменить отображение на главной',
          );
        }

        showAdminWorksMessage(
          nextShowOnHome
            ? 'Работа добавлена на главную страницу.'
            : 'Работа убрана с главной страницы.',
          true,
        );

        await loadAdminWorks({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка главной страницы:', error);

        showAdminWorksMessage(
          error.message || 'Не удалось изменить отображение на главной.',
        );

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function deleteAdminWork(card, button) {
      const workId = Number(card.dataset.adminWorkCard);

      const title =
        card.querySelector('.admin-work-card__title')?.textContent.trim() ||
        'эту работу';

      if (!Number.isInteger(workId) || workId <= 0) {
        return;
      }

      const confirmed = window.confirm(
        `Удалить работу «${title}»?\n\n` +
          'Она исчезнет из портфолио и с главной страницы. ' +
          'Это действие нельзя отменить.',
      );

      if (!confirmed) {
        return;
      }

      const cardsOnPage = list.querySelectorAll(
        '[data-admin-work-card]',
      ).length;

      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = 'Удаляем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/works/${workId}`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось удалить работу');
        }

        if (cardsOnPage === 1 && state.page > 1) {
          state.page -= 1;
        }

        showAdminWorksMessage(`Работа «${title}» удалена.`, true);

        await loadAdminWorks({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка удаления работы:', error);

        showAdminWorksMessage(error.message || 'Не удалось удалить работу.');

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function updateActiveStatus() {
      statusButtons.forEach((button) => {
        const buttonStatus = String(button.dataset.adminWorksStatus || 'all');

        button.classList.toggle('is-active', buttonStatus === state.status);
      });
    }

    function updateAdminWorksPagination() {
      paginationInfo.textContent = `Страница ${state.page} из ${state.pages}`;

      prevButton.disabled = state.page <= 1;

      nextButton.disabled = state.page >= state.pages;

      pagination.hidden = state.pages <= 1;
    }

    function showAdminWorksMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);
    }

    function hideAdminWorksMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }
  }

  // редактор работы

  async function initAdminWorkEditorPage(adminUser) {
    if (adminUser?.role !== 'OWNER') {
      window.location.replace('/admin/requests');
      return;
    }

    const form = document.querySelector('[data-work-editor-form]');

    const loading = document.querySelector('[data-work-editor-loading]');

    const message = document.querySelector('[data-work-editor-message]');

    const modeText = document.querySelector('[data-work-editor-mode]');

    const editorTitle = document.querySelector('[data-work-editor-title]');

    const editorState = document.querySelector('[data-work-editor-state]');

    const titleInput = document.querySelector('[data-work-title]');

    const slugInput = document.querySelector('[data-work-slug]');

    const dateInput = document.querySelector('[data-work-date]');

    const categoryInput = document.querySelector('[data-work-category]');

    const techniqueInput = document.querySelector('[data-work-technique]');

    const durationInput = document.querySelector('[data-work-duration]');

    const excerptInput = document.querySelector('[data-work-excerpt]');

    const heroQuoteInput = document.querySelector('[data-work-hero-quote]');

    const storyInput = document.querySelector('[data-work-story]');

    const publishedInput = document.querySelector('[data-work-published]');

    const homeInput = document.querySelector('[data-work-home]');

    const saveButton = document.querySelector('[data-work-save]');

    const metaId = document.querySelector('[data-work-meta-id]');

    const metaStatus = document.querySelector('[data-work-meta-status]');

    const publicLink = document.querySelector('[data-work-public-link]');

    const gallery = document.querySelector('[data-work-gallery]');

    const galleryEmpty = document.querySelector('[data-work-gallery-empty]');

    const galleryFileInput = document.querySelector('[data-work-gallery-file]');

    const gallerySelectButton = document.querySelector(
      '[data-work-gallery-select]',
    );

    const galleryStatus = document.querySelector('[data-work-gallery-status]');

    const imageInputs = document.querySelectorAll('[data-work-image-input]');

    const imageFileInputs = document.querySelectorAll('[data-work-image-file]');

    const imageSelectButtons = document.querySelectorAll(
      '[data-work-image-select]',
    );

    if (
      !form ||
      !loading ||
      !message ||
      !modeText ||
      !editorTitle ||
      !editorState ||
      !titleInput ||
      !slugInput ||
      !dateInput ||
      !categoryInput ||
      !techniqueInput ||
      !durationInput ||
      !excerptInput ||
      !heroQuoteInput ||
      !storyInput ||
      !publishedInput ||
      !homeInput ||
      !saveButton ||
      !metaId ||
      !metaStatus ||
      !publicLink ||
      !gallery ||
      !galleryEmpty ||
      !galleryFileInput ||
      !gallerySelectButton ||
      !galleryStatus
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    const requestedId = Number(params.get('id'));

    let workId =
      Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null;

    let slugWasEdited = Boolean(workId);

    let isSaving = false;

    let isUploading = false;

    const uploadedPathsThisSession = new Set();

    bindCounters();

    bindImageInputs();

    bindImageClearButtons();

    bindImageUploads();

    bindGalleryUploads();

    bindPublicationControls();

    titleInput.addEventListener('input', () => {
      if (!slugWasEdited) {
        slugInput.value = createSlug(titleInput.value);
      }

      updatePublicLink();
    });

    slugInput.addEventListener('input', () => {
      slugWasEdited = true;

      slugInput.value = normalizeSlug(slugInput.value);

      updatePublicLink();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      await saveWork();
    });

    if (workId) {
      await loadWork();
    } else {
      initializeNewWork();
    }

    function initializeNewWork() {
      loading.hidden = true;
      form.hidden = false;

      dateInput.value = getKrasnoyarskDate();

      renderEditorMode(null);

      updatePublicationControls();

      updateAllCounters();

      imageInputs.forEach((input) => {
        updateImagePreview(input);
      });

      renderGallery([], []);

      updateGalleryControls();
    }

    async function loadWork() {
      setEditorLoading(true);

      hideEditorMessage();

      try {
        const { response, data } = await requestJson(
          `/admin/api/works/${workId}`,
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');
          return;
        }

        if (response.status === 404) {
          throw new Error('Работа не найдена.');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить работу');
        }

        fillWorkForm(data.work || {});

        renderEditorMode(data.work || {});

        renderGallery(data.work?.images, data.work?.gallery);

        updateGalleryControls();

        form.hidden = false;
      } catch (error) {
        console.error('Ошибка загрузки работы:', error);

        form.hidden = true;

        showEditorMessage(error.message || 'Не удалось загрузить работу.');
      } finally {
        setEditorLoading(false);
      }
    }

    function fillWorkForm(work) {
      titleInput.value = work.title || '';

      slugInput.value = work.slug || '';

      dateInput.value = work.workDate || getKrasnoyarskDate();

      categoryInput.value = work.categorySlug || '';

      techniqueInput.value = work.technique || '';

      durationInput.value = work.duration || '';

      excerptInput.value = work.excerpt || '';

      heroQuoteInput.value = work.heroQuote || '';

      storyInput.value = work.story || '';

      publishedInput.checked = work.isPublished === true;

      homeInput.checked = work.showOnHome === true;

      imageInputs.forEach((input) => {
        const fieldName = String(input.dataset.workImageInput || '');

        input.value = work[fieldName] || '';

        updateImagePreview(input);
      });

      slugWasEdited = true;

      updatePublicationControls();

      updateAllCounters();

      updatePublicLink();
    }

    async function saveWork() {
      if (isSaving) {
        return;
      }

      if (isUploading) {
        showEditorMessage('Дождитесь окончания загрузки фотографии.');

        return;
      }

      hideEditorMessage();

      const payload = createWorkPayload();

      const validationError = validateWorkPayload(payload);

      if (validationError) {
        showEditorMessage(validationError.message);

        validationError.input?.focus();

        return;
      }

      setSaving(true);

      try {
        const url = workId ? `/admin/api/works/${workId}` : '/admin/api/works';

        const method = workId ? 'PATCH' : 'POST';

        const { response, data } = await requestJson(url, {
          method,

          headers: {
            'Content-Type': 'application/json',

            'X-CSRF-Token': csrfToken,
          },

          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          throw new Error('Сохранять работы может только OWNER');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось сохранить работу');
        }

        const savedWork = data?.work || {};

        const wasNew = !workId;

        workId = Number(savedWork.id) || workId;

        if (workId) {
          const nextUrl = `/admin/works/edit?id=${encodeURIComponent(workId)}`;

          window.history.replaceState({}, '', nextUrl);
        }

        fillWorkForm(savedWork);

        uploadedPathsThisSession.clear();

        renderEditorMode(savedWork);

        renderGallery(savedWork.images, savedWork.gallery);

        updateGalleryControls();

        showEditorMessage(
          wasNew
            ? 'Работа создана и сохранена.'
            : 'Изменения успешно сохранены.',
          true,
        );
      } catch (error) {
        console.error('Ошибка сохранения работы:', error);

        showEditorMessage(error.message || 'Не удалось сохранить работу.');
      } finally {
        setSaving(false);
      }
    }

    function createWorkPayload() {
      return {
        title: titleInput.value.trim(),

        slug: normalizeSlug(slugInput.value),

        workDate: dateInput.value,

        categorySlug: categoryInput.value,

        technique: techniqueInput.value.trim(),

        duration: durationInput.value.trim(),

        excerpt: excerptInput.value.trim(),

        beforeImage: getImageValue('beforeImage'),

        afterImage: getImageValue('afterImage'),

        heroImage: getImageValue('heroImage'),

        experienceImage: getImageValue('experienceImage'),

        heroQuote: heroQuoteInput.value.trim(),

        story: storyInput.value.trim(),

        isPublished: publishedInput.checked,

        showOnHome: publishedInput.checked && homeInput.checked,
      };
    }

    function validateWorkPayload(payload) {
      if (payload.title.length < 2) {
        return {
          message: 'Введите название работы.',
          input: titleInput,
        };
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
        return {
          message:
            'Адрес страницы должен содержать только латинские буквы, цифры и дефисы.',
          input: slugInput,
        };
      }

      if (!payload.workDate) {
        return {
          message: 'Укажите дату работы.',
          input: dateInput,
        };
      }

      if (!payload.categorySlug) {
        return {
          message: 'Выберите категорию работы.',
          input: categoryInput,
        };
      }

      if (payload.isPublished && !payload.afterImage) {
        return {
          message: 'Для публикации укажите фотографию после.',
          input: findImageInput('afterImage'),
        };
      }

      if (payload.isPublished && !payload.beforeImage) {
        return {
          message: 'Для публикации укажите фотографию до.',
          input: findImageInput('beforeImage'),
        };
      }

      return null;
    }

    function renderEditorMode(work) {
      const isExisting = Boolean(workId);

      const isPublished = work?.isPublished === true;

      modeText.textContent = isExisting
        ? 'Редактирование работы'
        : 'Новая работа';

      editorTitle.textContent = isExisting
        ? work?.title || 'Редактирование beauty story'
        : 'Создание beauty story';

      metaId.textContent = isExisting ? String(workId) : 'Новая';

      updateEditorStatus(isPublished);

      updatePublicLink();
    }

    function bindPublicationControls() {
      publishedInput.addEventListener('change', () => {
        if (!publishedInput.checked) {
          homeInput.checked = false;
        }

        updatePublicationControls();

        updateEditorStatus(publishedInput.checked);

        updatePublicLink();
      });

      homeInput.addEventListener('change', () => {
        if (homeInput.checked && !publishedInput.checked) {
          homeInput.checked = false;
        }
      });
    }

    function updatePublicationControls() {
      homeInput.disabled = !publishedInput.checked;
    }

    function updateEditorStatus(isPublished) {
      editorState.textContent = isPublished ? 'Опубликована' : 'Черновик';

      metaStatus.textContent = isPublished ? 'Опубликована' : 'Черновик';

      editorState.classList.toggle('is-published', isPublished);
    }

    function updatePublicLink() {
      const slug = normalizeSlug(slugInput.value);

      const canOpen = publishedInput.checked && Boolean(slug);

      publicLink.hidden = !canOpen;

      if (canOpen) {
        publicLink.href = `/public/works/work-detail.html?slug=${encodeURIComponent(
          slug,
        )}`;
      } else {
        publicLink.removeAttribute('href');
      }
    }

    function bindImageInputs() {
      imageInputs.forEach((input) => {
        input.addEventListener('input', () => {
          updateImagePreview(input);
        });

        input.addEventListener('change', () => {
          updateImagePreview(input);
        });
      });
    }

    function bindImageClearButtons() {
      document.querySelectorAll('[data-work-image-clear]').forEach((button) => {
        button.addEventListener('click', async () => {
          const fieldName = String(button.dataset.workImageClear || '');

          const input = findImageInput(fieldName);

          const status = findImageUploadStatus(fieldName);

          if (!input) {
            return;
          }

          const imagePath = input.value.trim();

          button.disabled = true;

          if (status) {
            status.textContent = 'Удаляем…';

            status.classList.remove('is-error');
          }

          try {
            if (imagePath && uploadedPathsThisSession.has(imagePath)) {
              await deleteUnsavedWorkImage(imagePath);
            }

            input.value = '';

            updateImagePreview(input);

            input.dispatchEvent(
              new Event('input', {
                bubbles: true,
              }),
            );

            if (status) {
              status.textContent = 'Фото удалено';
            }
          } catch (error) {
            console.error('Ошибка удаления фотографии:', error);

            if (status) {
              status.textContent = error.message || 'Не удалось удалить фото';

              status.classList.add('is-error');
            }
          } finally {
            button.disabled = false;
          }
        });
      });
    }

    function bindImageUploads() {
      imageSelectButtons.forEach((button) => {
        button.addEventListener('click', () => {
          if (isUploading || isSaving) {
            return;
          }

          const fieldName = String(button.dataset.workImageSelect || '');

          const fileInput = findImageFileInput(fieldName);

          fileInput?.click();
        });
      });

      imageFileInputs.forEach((fileInput) => {
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0];

          if (!file) {
            return;
          }

          await uploadWorkImage(fileInput, file);

          fileInput.value = '';
        });
      });
    }

    function bindGalleryUploads() {
      gallerySelectButton.addEventListener('click', () => {
        if (!workId) {
          galleryStatus.textContent = 'Сначала сохраните работу';

          galleryStatus.classList.add('is-error');

          return;
        }

        if (isUploading || isSaving) {
          return;
        }

        galleryFileInput.click();
      });

      galleryFileInput.addEventListener('change', async () => {
        const files = Array.from(galleryFileInput.files || []);

        galleryFileInput.value = '';

        if (!files.length) {
          return;
        }

        await uploadGalleryFiles(files);
      });
    }

    async function uploadGalleryFiles(files) {
      if (!workId || isUploading || isSaving) {
        return;
      }

      const selectedFiles = files.slice(0, 10);

      let addedCount = 0;

      setGalleryUploading(true);

      try {
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];

          galleryStatus.textContent = `Загружаем ${index + 1} из ${selectedFiles.length}…`;

          galleryStatus.classList.remove('is-error');

          const validationError = validateGalleryFile(file);

          if (validationError) {
            throw new Error(validationError);
          }

          const uploadedPath = await uploadGallerySourceFile(file);

          try {
            const { response, data } = await requestJson(
              `/admin/api/works/${workId}/images`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',

                  'X-CSRF-Token': csrfToken,
                },

                body: JSON.stringify({
                  imagePath: uploadedPath,
                  alt: '',
                }),
              },
            );

            if (response.status === 401) {
              redirectToLogin();
              return;
            }

            if (response.status === 403) {
              throw new Error('Добавлять фотографии может только OWNER');
            }

            if (!response.ok) {
              throw new Error(
                data?.message || 'Не удалось добавить фото в галерею',
              );
            }

            addedCount += 1;
          } catch (error) {
            await deleteUnsavedWorkImage(uploadedPath).catch((deleteError) => {
              console.error(
                'Не удалось удалить незаписанный файл:',
                deleteError,
              );
            });

            throw error;
          }
        }

        await reloadGallery();

        galleryStatus.textContent = `Добавлено фотографий: ${addedCount}`;

        galleryStatus.classList.remove('is-error');
      } catch (error) {
        console.error('Ошибка загрузки галереи:', error);

        if (addedCount > 0) {
          await reloadGallery().catch(() => undefined);
        }

        galleryStatus.textContent =
          error.message || 'Не удалось загрузить фотографии';

        galleryStatus.classList.add('is-error');
      } finally {
        setGalleryUploading(false);
      }
    }

    function validateGalleryFile(file) {
      const allowedMimeTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/heif',
      ]);

      if (file.type && !allowedMimeTypes.has(file.type.toLowerCase())) {
        return 'Поддерживаются JPG, PNG, WebP, AVIF и HEIC';
      }

      const maxSize = 12 * 1024 * 1024;

      if (file.size > maxSize) {
        return 'Каждая фотография должна весить не больше 12 МБ';
      }

      return '';
    }

    async function uploadGallerySourceFile(file) {
      const formData = new FormData();

      formData.append('image', file);

      const { response, data } = await requestJson(
        '/admin/api/uploads/work-image',
        {
          method: 'POST',

          headers: {
            'X-CSRF-Token': csrfToken,
          },

          body: formData,
        },
      );

      if (response.status === 401) {
        redirectToLogin();

        throw new Error('Требуется повторный вход');
      }

      if (response.status === 403) {
        throw new Error('Загружать фотографии может только OWNER');
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось загрузить фотографию');
      }

      const uploadedPath = String(data?.image?.path || '').trim();

      if (!uploadedPath) {
        throw new Error('Сервер не вернул путь фотографии');
      }

      return uploadedPath;
    }

    async function reloadGallery() {
      if (!workId) {
        return;
      }

      const { response, data } = await requestJson(
        `/admin/api/works/${workId}`,
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось обновить галерею');
      }

      renderGallery(data?.work?.images, data?.work?.gallery);
    }

    function setGalleryUploading(uploading) {
      isUploading = uploading;

      saveButton.disabled = uploading || isSaving;

      gallerySelectButton.disabled = uploading || isSaving || !workId;

      gallerySelectButton.textContent = uploading
        ? 'Загружаем…'
        : 'Добавить фотографии';

      imageSelectButtons.forEach((button) => {
        button.disabled = uploading || isSaving;
      });

      document.querySelectorAll('[data-work-image-clear]').forEach((button) => {
        button.disabled = uploading || isSaving;
      });

      document
        .querySelectorAll('[data-work-gallery-delete]')
        .forEach((button) => {
          button.disabled = uploading || isSaving;
        });
    }

    function updateGalleryControls() {
      gallerySelectButton.disabled = !workId || isUploading || isSaving;

      if (!workId) {
        galleryStatus.textContent = 'Сначала сохраните работу';

        galleryStatus.classList.remove('is-error');

        return;
      }

      if (galleryStatus.textContent.trim() === 'Сначала сохраните работу') {
        galleryStatus.textContent = '';
      }
    }

    async function uploadWorkImage(fileInput, file) {
      if (isUploading) {
        return;
      }

      const fieldName = String(fileInput.dataset.workImageFile || '');

      const pathInput = findImageInput(fieldName);

      const selectButton = findImageSelectButton(fieldName);

      const status = findImageUploadStatus(fieldName);

      if (!fieldName || !pathInput || !selectButton) {
        return;
      }

      const allowedMimeTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/heif',
      ]);

      if (file.type && !allowedMimeTypes.has(file.type.toLowerCase())) {
        if (status) {
          status.textContent = 'Выберите JPG, PNG, WebP, AVIF или HEIC';

          status.classList.add('is-error');
        }

        return;
      }

      const maxSize = 12 * 1024 * 1024;

      if (file.size > maxSize) {
        if (status) {
          status.textContent = 'Файл должен весить не больше 12 МБ';

          status.classList.add('is-error');
        }

        return;
      }

      const previousPath = pathInput.value.trim();

      const formData = new FormData();

      formData.append('image', file);

      setImageUploading(true, selectButton, status);

      try {
        const { response, data } = await requestJson(
          '/admin/api/uploads/work-image',
          {
            method: 'POST',

            headers: {
              'X-CSRF-Token': csrfToken,
            },

            body: formData,
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          throw new Error('Загружать фотографии может только OWNER');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить фотографию');
        }

        const uploadedPath = String(data?.image?.path || '').trim();

        if (!uploadedPath) {
          throw new Error('Сервер не вернул путь фотографии');
        }

        pathInput.value = uploadedPath;

        uploadedPathsThisSession.add(uploadedPath);

        updateImagePreview(pathInput);

        pathInput.dispatchEvent(
          new Event('input', {
            bubbles: true,
          }),
        );

        if (
          previousPath &&
          previousPath !== uploadedPath &&
          uploadedPathsThisSession.has(previousPath)
        ) {
          await deleteUnsavedWorkImage(previousPath).catch((error) => {
            console.error('Не удалось удалить заменённую фотографию:', error);
          });
        }

        if (status) {
          status.textContent = 'Фото загружено';

          status.classList.remove('is-error');
        }
      } catch (error) {
        console.error('Ошибка загрузки фотографии:', error);

        if (status) {
          status.textContent = error.message || 'Не удалось загрузить фото';

          status.classList.add('is-error');
        }
      } finally {
        setImageUploading(false, selectButton, status);
      }
    }

    async function deleteUnsavedWorkImage(imagePath) {
      const { response, data } = await requestJson(
        '/admin/api/uploads/work-image',
        {
          method: 'DELETE',

          headers: {
            'Content-Type': 'application/json',

            'X-CSRF-Token': csrfToken,
          },

          body: JSON.stringify({
            path: imagePath,
          }),
        },
      );

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось удалить фотографию');
      }

      uploadedPathsThisSession.delete(imagePath);
    }

    function setImageUploading(uploading, currentButton, status) {
      isUploading = uploading;

      saveButton.disabled = uploading || isSaving;

      imageSelectButtons.forEach((button) => {
        button.disabled = uploading || isSaving;
      });

      document.querySelectorAll('[data-work-image-clear]').forEach((button) => {
        button.disabled = uploading || isSaving;
      });

      gallerySelectButton.disabled = uploading || isSaving || !workId;

      document
        .querySelectorAll('[data-work-gallery-delete]')
        .forEach((button) => {
          button.disabled = uploading || isSaving;
        });

      if (currentButton) {
        currentButton.textContent = uploading ? 'Загружаем…' : 'Выбрать фото';
      }

      if (uploading && status) {
        status.textContent = 'Обрабатываем изображение…';

        status.classList.remove('is-error');
      }
    }

    function findImageFileInput(fieldName) {
      return document.querySelector(`[data-work-image-file="${fieldName}"]`);
    }

    function findImageSelectButton(fieldName) {
      return document.querySelector(`[data-work-image-select="${fieldName}"]`);
    }

    function findImageUploadStatus(fieldName) {
      return document.querySelector(
        `[data-work-image-upload-status="${fieldName}"]`,
      );
    }

    function updateImagePreview(input) {
      const card = input.closest('[data-work-image-card]');

      const image = card?.querySelector('[data-work-image-preview-img]');

      const empty = card?.querySelector('[data-work-image-empty]');

      const clearButton = card?.querySelector('[data-work-image-clear]');

      if (!card || !image || !empty || !clearButton) {
        return;
      }

      const fieldName = String(input.dataset.workImageInput || '');

      const imagePath = input.value.trim();

      const emptyTexts = {
        afterImage: 'Изображение не выбрано',

        beforeImage: 'Изображение не выбрано',

        heroImage: 'Используется фото после',

        experienceImage: 'Используется hero-фото',
      };

      if (!imagePath) {
        image.hidden = true;

        image.removeAttribute('src');

        clearButton.hidden = true;

        empty.textContent = emptyTexts[fieldName] || 'Изображение не выбрано';

        empty.hidden = false;

        return;
      }

      clearButton.hidden = false;

      image.onload = () => {
        image.hidden = false;
        empty.hidden = true;
      };

      image.onerror = () => {
        image.hidden = true;

        empty.textContent = 'Изображение не найдено';

        empty.hidden = false;
      };

      image.src = imagePath;
    }

    function renderGallery(images, legacyItems = []) {
      const relationItems = Array.isArray(images)
        ? images
            .map((item) => ({
              id: Number(item?.id) || null,

              imagePath: String(item?.imagePath || '').trim(),

              alt: String(item?.alt || '').trim(),
            }))
            .filter((item) => item.imagePath)
        : [];

      const fallbackItems = Array.isArray(legacyItems)
        ? legacyItems
            .map((imagePath) => ({
              id: null,

              imagePath: String(imagePath || '').trim(),

              alt: '',
            }))
            .filter((item) => item.imagePath)
        : [];

      const items = relationItems.length ? relationItems : fallbackItems;

      if (!items.length) {
        gallery.innerHTML = '';
        gallery.hidden = true;
        galleryEmpty.hidden = false;

        return;
      }

      gallery.innerHTML = items
        .map(
          (item, index) => `
        <article
          class="admin-editor-gallery__item"
          ${item.id ? `data-work-gallery-image="${item.id}"` : ''}
        >
          <img
            src="${escapeHtml(item.imagePath)}"
            alt="${escapeHtml(item.alt || `Фотография галереи ${index + 1}`)}"
            loading="lazy"
          />

          ${
            item.id
              ? `
                <button
                  class="admin-editor-gallery__remove"
                  type="button"
                  aria-label="Удалить фотографию ${index + 1}"
                  title="Удалить фотографию"
                  data-work-gallery-delete="${item.id}"
                >
                  ×
                </button>
              `
              : ''
          }
        </article>
      `,
        )
        .join('');

      gallery.hidden = false;
      galleryEmpty.hidden = true;

      bindGalleryDeleteButtons();

      gallery.querySelectorAll('img').forEach((image) => {
        image.addEventListener(
          'error',
          () => {
            image
              .closest('.admin-editor-gallery__item')
              ?.classList.add('is-error');
          },
          {
            once: true,
          },
        );
      });
    }

    function bindGalleryDeleteButtons() {
      gallery
        .querySelectorAll('[data-work-gallery-delete]')
        .forEach((button) => {
          button.addEventListener('click', async () => {
            await deleteGalleryImage(button);
          });
        });
    }

    async function deleteGalleryImage(button) {
      const imageId = Number(button.dataset.workGalleryDelete);

      if (
        !workId ||
        !Number.isInteger(imageId) ||
        imageId <= 0 ||
        isUploading ||
        isSaving
      ) {
        return;
      }

      const confirmed = window.confirm('Удалить эту фотографию из галереи?');

      if (!confirmed) {
        return;
      }

      const card = button.closest('[data-work-gallery-image]');

      button.disabled = true;
      button.textContent = '…';

      galleryStatus.textContent = 'Удаляем фотографию…';
      galleryStatus.classList.remove('is-error');

      try {
        const { response, data } = await requestJson(
          `/admin/api/works/${workId}/images/${imageId}`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось удалить фотографию');
        }

        card?.remove();

        const hasImages = Boolean(
          gallery.querySelector('.admin-editor-gallery__item'),
        );

        gallery.hidden = !hasImages;
        galleryEmpty.hidden = hasImages;

        galleryStatus.textContent = 'Фотография удалена';
        galleryStatus.classList.remove('is-error');
      } catch (error) {
        console.error('Ошибка удаления фотографии галереи:', error);

        button.disabled = false;
        button.textContent = '×';

        galleryStatus.textContent =
          error.message || 'Не удалось удалить фотографию';

        galleryStatus.classList.add('is-error');
      }
    }

    function bindCounters() {
      bindCounter(excerptInput, '[data-work-excerpt-counter]');

      bindCounter(heroQuoteInput, '[data-work-hero-quote-counter]');

      bindCounter(storyInput, '[data-work-story-counter]');
    }

    function bindCounter(input, selector) {
      const counter = document.querySelector(selector);

      if (!counter) {
        return;
      }

      const update = () => {
        counter.textContent = String(input.value.length);
      };

      input.addEventListener('input', update);

      update();
    }

    function updateAllCounters() {
      setText('[data-work-excerpt-counter]', String(excerptInput.value.length));

      setText(
        '[data-work-hero-quote-counter]',
        String(heroQuoteInput.value.length),
      );

      setText('[data-work-story-counter]', String(storyInput.value.length));
    }

    function setEditorLoading(isLoading) {
      loading.hidden = !isLoading;

      if (isLoading) {
        form.hidden = true;
      }
    }

    function setSaving(isLoading) {
      isSaving = isLoading;

      saveButton.disabled = isLoading || isUploading;

      saveButton.textContent = isLoading ? 'Сохраняем…' : 'Сохранить работу';

      form.querySelectorAll('input, textarea, select').forEach((field) => {
        field.disabled = isLoading;

        if (!isLoading && field === homeInput) {
          field.disabled = !publishedInput.checked;
        }
      });

      imageSelectButtons.forEach((button) => {
        button.disabled = isLoading || isUploading;
      });

      document.querySelectorAll('[data-work-image-clear]').forEach((button) => {
        button.disabled = isLoading || isUploading;
      });

      gallerySelectButton.disabled = isLoading || isUploading || !workId;

      document
        .querySelectorAll('[data-work-gallery-delete]')
        .forEach((button) => {
          button.disabled = isLoading || isUploading;
        });
    }

    function showEditorMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);

      message.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }

    function hideEditorMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }

    function getImageValue(fieldName) {
      return findImageInput(fieldName)?.value.trim() || '';
    }

    function findImageInput(fieldName) {
      return document.querySelector(`[data-work-image-input="${fieldName}"]`);
    }

    function createSlug(value) {
      const transliteration = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ё: 'e',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'ts',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
      };

      const transliterated = String(value || '')
        .trim()
        .toLowerCase()
        .split('')
        .map((symbol) => transliteration[symbol] ?? symbol)
        .join('');

      return normalizeSlug(transliterated);
    }

    function normalizeSlug(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 160);
    }

    function getKrasnoyarskDate() {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Krasnoyarsk',

        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());

      const values = {};

      parts.forEach((part) => {
        values[part.type] = part.value;
      });

      return `${values.year}-` + `${values.month}-` + `${values.day}`;
    }
  }

  // сотрудники

  async function initStaffPage(adminUser) {
    if (adminUser?.role !== 'OWNER') {
      window.location.replace('/admin/requests');

      return;
    }

    const form = document.querySelector('[data-staff-create-form]');

    const nameInput = document.querySelector('[data-staff-name]');

    const emailInput = document.querySelector('[data-staff-email]');

    const passwordInput = document.querySelector('[data-staff-password]');

    const submitButton = document.querySelector('[data-staff-create-submit]');

    const refreshButton = document.querySelector('[data-staff-refresh]');

    const list = document.querySelector('[data-staff-list]');

    const loading = document.querySelector('[data-staff-loading]');

    const empty = document.querySelector('[data-staff-empty]');

    const message = document.querySelector('[data-staff-message]');

    if (
      !form ||
      !nameInput ||
      !emailInput ||
      !passwordInput ||
      !submitButton ||
      !refreshButton ||
      !list ||
      !loading ||
      !empty ||
      !message
    ) {
      return;
    }

    const state = {
      isLoading: false,
    };

    let requestNumber = 0;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      await createStaff();
    });

    refreshButton.addEventListener('click', async () => {
      await loadStaff();
    });

    await loadStaff();

    async function loadStaff(options = {}) {
      const preserveMessage = options.preserveMessage === true;

      const currentRequest = ++requestNumber;

      if (!preserveMessage) {
        hideStaffMessage();
      }

      setStaffLoading(true);

      try {
        const { response, data } = await requestJson('/admin/api/staff');

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          window.location.replace('/admin/requests');

          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось загрузить сотрудников');
        }

        if (currentRequest !== requestNumber) {
          return;
        }

        const staff = Array.isArray(data?.staff) ? data.staff : [];

        renderStaffCounts(data?.counts || {});

        renderStaff(staff);
      } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);

        list.hidden = true;
        empty.hidden = true;

        showStaffMessage(error.message || 'Не удалось загрузить сотрудников.');
      } finally {
        if (currentRequest === requestNumber) {
          setStaffLoading(false);
        }
      }
    }

    async function createStaff() {
      const name = nameInput.value.trim();

      const email = emailInput.value.trim().toLowerCase();

      const password = passwordInput.value;

      hideStaffMessage();

      if (name.length < 2) {
        showStaffMessage('Введите имя сотрудника.');

        nameInput.focus();
        return;
      }

      if (!email) {
        showStaffMessage('Введите электронную почту сотрудника.');

        emailInput.focus();
        return;
      }

      if (password.trim().length < 10) {
        showStaffMessage('Пароль должен содержать не менее 10 символов.');

        passwordInput.focus();
        return;
      }

      setCreateLoading(true);

      try {
        const { response, data } = await requestJson('/admin/api/staff', {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            'X-CSRF-Token': csrfToken,
          },

          body: JSON.stringify({
            name,
            email,
            password,
          }),
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          throw new Error('Создавать сотрудников может только OWNER');
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось создать сотрудника');
        }

        form.reset();

        showStaffMessage(`Сотрудник ${name} создан.`, true);

        await loadStaff({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка создания сотрудника:', error);

        showStaffMessage(error.message || 'Не удалось создать сотрудника.');
      } finally {
        setCreateLoading(false);
      }
    }

    function setStaffLoading(isLoading) {
      state.isLoading = isLoading;

      loading.hidden = !isLoading;
      refreshButton.disabled = isLoading;

      if (isLoading) {
        list.hidden = true;
        empty.hidden = true;
      }
    }

    function setCreateLoading(isLoading) {
      submitButton.disabled = isLoading;
      nameInput.disabled = isLoading;
      emailInput.disabled = isLoading;
      passwordInput.disabled = isLoading;

      submitButton.textContent = isLoading ? 'Создаём…' : 'Создать сотрудника';
    }

    function renderStaffCounts(counts) {
      const values = {
        all: counts.all || 0,
        active: counts.active || 0,
        blocked: counts.blocked || 0,
        online: counts.online || 0,
      };

      Object.entries(values).forEach(([name, value]) => {
        const element = document.querySelector(`[data-staff-count="${name}"]`);

        if (element) {
          element.textContent = String(value);
        }
      });
    }

    function renderStaff(staff) {
      if (!staff.length) {
        list.innerHTML = '';
        list.hidden = true;
        empty.hidden = false;

        return;
      }

      empty.hidden = true;

      list.innerHTML = staff.map(renderStaffCard).join('');

      list.hidden = false;

      bindStaffCards();
    }

    function renderStaffCard(staff) {
      const id = Number(staff.id);

      const isActive = staff.isActive === true;

      const activeSessions = Number(staff.activeSessions) || 0;

      const lastLoginAt = staff.lastLoginAt
        ? formatDate(staff.lastLoginAt)
        : 'Входов ещё не было';

      const lastActivityAt = staff.lastActivityAt
        ? formatDate(staff.lastActivityAt)
        : 'Активности ещё не было';

      const createdAt = staff.createdAt
        ? formatDate(staff.createdAt)
        : 'Дата не указана';

      const activityText = staff.isOnline ? 'Сейчас в системе' : 'Не в системе';

      return `
      <article
        class="admin-staff-card${isActive ? '' : ' is-blocked'}"
        data-staff-card="${id}"
        data-staff-active="${String(isActive)}"
      >
        <div class="admin-staff-card__head">
          <div class="admin-staff-card__identity">
            <h4 class="admin-staff-card__name">
              ${escapeHtml(staff.name || 'Без имени')}
            </h4>

            <span class="admin-staff-card__email">
              ${escapeHtml(staff.email || 'Email не указан')}
            </span>
          </div>

          <span
            class="admin-staff-card__status${isActive ? '' : ' is-blocked'}"
          >
            ${isActive ? 'Активен' : 'Заблокирован'}
          </span>
        </div>

        <div class="admin-staff-card__meta-grid">
          <div class="admin-staff-card__meta">
            <span class="admin-staff-card__meta-label">
              Активность
            </span>

            <strong class="admin-staff-card__meta-value">
              ${activityText}
            </strong>
          </div>

          <div class="admin-staff-card__meta">
            <span class="admin-staff-card__meta-label">
              Активные сессии
            </span>

            <strong class="admin-staff-card__meta-value">
              ${activeSessions}
            </strong>
          </div>

          <div class="admin-staff-card__meta">
            <span class="admin-staff-card__meta-label">
              Последний вход
            </span>

            <strong class="admin-staff-card__meta-value">
              ${escapeHtml(lastLoginAt)}
            </strong>
          </div>

          <div class="admin-staff-card__meta">
            <span class="admin-staff-card__meta-label">
              Последняя активность
            </span>

            <strong class="admin-staff-card__meta-value">
              ${escapeHtml(lastActivityAt)}
            </strong>
          </div>
        </div>

        <div class="admin-staff-card__meta">
          <span class="admin-staff-card__meta-label">
            Учётная запись создана
          </span>

          <strong class="admin-staff-card__meta-value">
            ${escapeHtml(createdAt)}
          </strong>
        </div>

        <div class="admin-staff-card__actions">
          <button
            class="admin-staff-card__action ${
              isActive
                ? 'admin-staff-card__action--danger'
                : 'admin-staff-card__action--success'
            }"
            type="button"
            data-staff-status
          >
            ${isActive ? 'Заблокировать' : 'Разблокировать'}
          </button>

          <button
            class="admin-staff-card__action"
            type="button"
            data-staff-password-open
          >
            Сбросить пароль
          </button>

          <button
            class="admin-staff-card__action"
            type="button"
            data-staff-sessions
            ${activeSessions > 0 ? '' : 'disabled'}
          >
            Завершить сессии
          </button>

          <button
           class="admin-staff-card__action admin-staff-card__action--danger"
           type="button"
           data-staff-delete
          >
           Удалить сотрудника
          </button>
        </div>

        <form
          class="admin-staff-card__password-form"
          data-staff-password-form
          hidden
        >
          <input
            class="admin-staff-card__password-input"
            type="password"
            minlength="10"
            maxlength="128"
            autocomplete="new-password"
            placeholder="Новый пароль, минимум 10 символов"
            required
            data-staff-new-password
          />

          <button
            class="admin-staff-card__password-submit"
            type="submit"
          >
            Сохранить пароль
          </button>

          <button
            class="admin-staff-card__password-cancel"
            type="button"
            data-staff-password-cancel
          >
            Отмена
          </button>
        </form>
      </article>
    `;
    }

    function bindStaffCards() {
      list.querySelectorAll('[data-staff-card]').forEach((card) => {
        const statusButton = card.querySelector('[data-staff-status]');

        const sessionsButton = card.querySelector('[data-staff-sessions]');

        const deleteButton = card.querySelector('[data-staff-delete]');

        const passwordOpen = card.querySelector('[data-staff-password-open]');

        const passwordForm = card.querySelector('[data-staff-password-form]');

        const passwordCancel = card.querySelector(
          '[data-staff-password-cancel]',
        );

        const passwordInput = card.querySelector('[data-staff-new-password]');

        statusButton?.addEventListener('click', async () => {
          await changeStaffStatus(card, statusButton);
        });

        sessionsButton?.addEventListener('click', async () => {
          await revokeStaffSessions(card, sessionsButton);
        });

        deleteButton?.addEventListener('click', async () => {
          await deleteStaff(card, deleteButton);
        });

        passwordOpen?.addEventListener('click', () => {
          if (!passwordForm) {
            return;
          }

          passwordForm.hidden = false;
          passwordOpen.hidden = true;

          passwordInput?.focus();
        });

        passwordCancel?.addEventListener('click', () => {
          if (!passwordForm || !passwordOpen) {
            return;
          }

          passwordForm.reset();
          passwordForm.hidden = true;
          passwordOpen.hidden = false;
        });

        passwordForm?.addEventListener('submit', async (event) => {
          event.preventDefault();

          await resetStaffPassword(card, passwordForm);
        });
      });
    }

    async function changeStaffStatus(card, button) {
      const staffId = Number(card.dataset.staffCard);

      const currentlyActive = card.dataset.staffActive === 'true';

      if (!Number.isInteger(staffId) || staffId <= 0) {
        return;
      }

      const actionText = currentlyActive ? 'заблокировать' : 'разблокировать';

      const confirmed = window.confirm(
        currentlyActive
          ? 'Заблокировать сотрудника? Все его активные сессии будут завершены.'
          : 'Разблокировать сотрудника и снова разрешить ему вход?',
      );

      if (!confirmed) {
        return;
      }

      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = currentlyActive ? 'Блокируем…' : 'Разблокируем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/staff/${staffId}/status`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type': 'application/json',

              'X-CSRF-Token': csrfToken,
            },

            body: JSON.stringify({
              isActive: !currentlyActive,
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(
            data?.message || `Не удалось ${actionText} сотрудника`,
          );
        }

        showStaffMessage(data?.message || 'Статус сотрудника обновлён.', true);

        await loadStaff({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка изменения сотрудника:', error);

        showStaffMessage(
          error.message || 'Не удалось изменить статус сотрудника.',
        );

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function revokeStaffSessions(card, button) {
      const staffId = Number(card.dataset.staffCard);

      if (!Number.isInteger(staffId) || staffId <= 0) {
        return;
      }

      const confirmed = window.confirm(
        'Завершить все активные сессии сотрудника? Ему потребуется войти заново.',
      );

      if (!confirmed) {
        return;
      }

      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = 'Завершаем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/staff/${staffId}/sessions`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось завершить сессии');
        }

        showStaffMessage(
          `Сессии завершены: ${Number(data?.revokedSessions) || 0}.`,
          true,
        );

        await loadStaff({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка завершения сессий:', error);

        showStaffMessage(
          error.message || 'Не удалось завершить сессии сотрудника.',
        );

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function deleteStaff(card, button) {
      const staffId = Number(card.dataset.staffCard);

      const name =
        card.querySelector('.admin-staff-card__name')?.textContent.trim() ||
        'сотрудника';

      const email =
        card.querySelector('.admin-staff-card__email')?.textContent.trim() ||
        '';

      if (!Number.isInteger(staffId) || staffId <= 0) {
        return;
      }

      const confirmed = window.confirm(
        `Удалить сотрудника «${name}»${email ? ` (${email})` : ''}?\n\n` +
          'Учётная запись и все активные сессии будут удалены. ' +
          'Назначенные заявки останутся в базе, но станут неназначенными.\n\n' +
          'Это действие нельзя отменить.',
      );

      if (!confirmed) {
        return;
      }

      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = 'Удаляем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/staff/${staffId}`,
          {
            method: 'DELETE',

            headers: {
              'X-CSRF-Token': csrfToken,
            },
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (response.status === 403) {
          throw new Error(
            data?.message || 'Удалять сотрудников может только OWNER',
          );
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось удалить сотрудника');
        }

        showStaffMessage(
          `Сотрудник ${name} удалён. Освобождено заявок: ${
            Number(data?.releasedLeads) || 0
          }.`,
          true,
        );

        await loadStaff({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка удаления сотрудника:', error);

        showStaffMessage(error.message || 'Не удалось удалить сотрудника.');

        button.disabled = false;
        button.textContent = originalText;
      }
    }

    async function resetStaffPassword(card, passwordForm) {
      const staffId = Number(card.dataset.staffCard);

      const input = passwordForm.querySelector('[data-staff-new-password]');

      const submit = passwordForm.querySelector('button[type="submit"]');

      const cancel = passwordForm.querySelector('[data-staff-password-cancel]');

      if (!Number.isInteger(staffId) || staffId <= 0 || !input || !submit) {
        return;
      }

      const password = input.value;

      if (password.trim().length < 10) {
        showStaffMessage('Новый пароль должен содержать не менее 10 символов.');

        input.focus();
        return;
      }

      const confirmed = window.confirm(
        'Сбросить пароль сотрудника? Все его активные сессии будут завершены.',
      );

      if (!confirmed) {
        return;
      }

      submit.disabled = true;
      input.disabled = true;

      if (cancel) {
        cancel.disabled = true;
      }

      submit.textContent = 'Сохраняем…';

      try {
        const { response, data } = await requestJson(
          `/admin/api/staff/${staffId}/password`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type': 'application/json',

              'X-CSRF-Token': csrfToken,
            },

            body: JSON.stringify({
              password,
            }),
          },
        );

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || 'Не удалось изменить пароль');
        }

        showStaffMessage(
          'Пароль сотрудника изменён. Все его сессии завершены.',
          true,
        );

        await loadStaff({
          preserveMessage: true,
        });
      } catch (error) {
        console.error('Ошибка сброса пароля:', error);

        showStaffMessage(
          error.message || 'Не удалось изменить пароль сотрудника.',
        );

        submit.disabled = false;
        input.disabled = false;

        if (cancel) {
          cancel.disabled = false;
        }

        submit.textContent = 'Сохранить пароль';
      }
    }

    function showStaffMessage(text, success = false) {
      message.textContent = text;
      message.hidden = false;

      message.classList.toggle('is-success', success);
    }

    function hideStaffMessage() {
      message.textContent = '';
      message.hidden = true;

      message.classList.remove('is-success');
    }
  }

  // общие функции

  function setLoginLoading({ isLoading, submitButton, submitText, loader }) {
    submitButton.disabled = isLoading;

    submitButton.setAttribute('aria-busy', String(isLoading));

    if (submitText) {
      submitText.textContent = isLoading ? 'Проверяем…' : 'Войти в панель';
    }

    if (loader) {
      loader.hidden = !isLoading;
    }
  }

  function showMessage(element, text, success = false) {
    element.textContent = text;
    element.hidden = false;

    element.classList.toggle('admin-login__message--success', success);
  }

  function hideMessage(element) {
    element.textContent = '';
    element.hidden = true;

    element.classList.remove('admin-login__message--success');
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  }

  function formatRole(role) {
    if (role === 'OWNER') {
      return 'OWNER';
    }

    if (role === 'STAFF') {
      return 'STAFF';
    }

    return '—';
  }

  function getValidLeadStatus(status) {
    const statuses = new Set(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

    return statuses.has(status) ? status : 'NEW';
  }

  function formatLeadStatus(status) {
    const statuses = {
      NEW: 'Новая',
      IN_PROGRESS: 'В работе',
      COMPLETED: 'Завершена',
      CANCELLED: 'Отменена',
    };

    return statuses[status] || 'Новая';
  }

  function formatLeadSource(source) {
    const sources = {
      'contacts-page': 'Страница контактов',
      website: 'Сайт',
    };

    return sources[source] || source || 'Сайт';
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('7')) {
      return (
        `+7 (${digits.slice(1, 4)}) ` +
        `${digits.slice(4, 7)}-` +
        `${digits.slice(7, 9)}-` +
        `${digits.slice(9, 11)}`
      );
    }

    return value || 'Не указан';
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Дата не указана';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Krasnoyarsk',
    }).format(date);
  }

  function escapeHtml(value) {
    const symbols = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return String(value ?? '').replace(/[&<>"']/g, (symbol) => symbols[symbol]);
  }

  function redirectToLogin() {
    window.location.replace('/admin/login');
  }
})();
