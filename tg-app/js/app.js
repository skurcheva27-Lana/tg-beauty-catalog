/**
 * app.js — логика Telegram Mini App
 *
 * Архитектура:
 *   tg      — объект Telegram Web App SDK (или мок для браузера)
 *   state   — единое состояние приложения
 *   Router  — управление переходами между экранами
 *   Screens — рендеринг и логика каждого экрана
 *
 * Порядок экранов:
 *   catalog → service → datetime → confirm → success
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────
     1. Telegram SDK — реальный или браузерный мок
  ──────────────────────────────────────────────────────── */

  /** Определяем, запущены ли внутри Telegram */
  const inTelegram = Boolean(window.Telegram?.WebApp?.initData);
  const tg         = inTelegram ? window.Telegram.WebApp : createTgMock();

  /** Браузерная заглушка Telegram SDK для отладки */
  function createTgMock() {
    const mainWrap = document.getElementById('browser-main-btn-wrap');
    const mainBtn  = document.getElementById('browser-main-btn');
    const backWrap = document.getElementById('browser-back-btn-wrap');
    const backBtn  = document.getElementById('browser-back-btn');

    mainWrap.style.display = 'block';

    let mainClickFn = null;
    let backClickFn = null;

    const MainButton = {
      isActive:  true,
      isVisible: false,
      setText(t)   { mainBtn.textContent = t; },
      show()       { this.isVisible = true;  mainWrap.style.display = 'block'; },
      hide()       { this.isVisible = false; mainWrap.style.display = 'none'; },
      enable()     { this.isActive = true;  mainBtn.disabled = false; mainBtn.style.opacity = '1'; },
      disable()    { this.isActive = false; mainBtn.disabled = true;  mainBtn.style.opacity = '0.45'; },
      showProgress() { mainBtn.textContent = '⏳ Отправляю…'; mainBtn.disabled = true; },
      hideProgress() { mainBtn.textContent = mainBtn.dataset.text || ''; mainBtn.disabled = !this.isActive; },
      onClick(fn)  { mainClickFn = fn; mainBtn.onclick = fn; },
      offClick(fn) { if (mainClickFn === fn) { mainClickFn = null; mainBtn.onclick = null; } },
    };

    const BackButton = {
      isVisible: false,
      show()       { this.isVisible = true;  backWrap.style.display = 'block'; document.body.classList.add('has-back-btn'); },
      hide()       { this.isVisible = false; backWrap.style.display = 'none';  document.body.classList.remove('has-back-btn'); },
      onClick(fn)  { backClickFn = fn; backBtn.onclick = fn; },
      offClick(fn) { if (backClickFn === fn) { backClickFn = null; backBtn.onclick = null; } },
    };

    const HapticFeedback = {
      impactOccurred()      {},
      notificationOccurred() {},
      selectionChanged()     {},
    };

    const CloudStorage = {
      getItem(key, cb) { try { cb(null, localStorage.getItem('tg_' + key) || ''); } catch(e) { cb(e); } },
      setItem(key, val, cb) { try { localStorage.setItem('tg_' + key, val); cb?.(null); } catch(e) { cb?.(e); } },
    };

    return {
      expand()                    {},
      ready()                     {},
      setHeaderColor()            {},
      enableClosingConfirmation() {},
      disableClosingConfirmation(){},
      showAlert(msg, cb)          { alert(msg); cb?.(); },
      showConfirm(msg, cb)        { const r = confirm(msg); cb?.(r); },
      openLink(url)               { window.open(url, '_blank'); },
      initData:       '',
      initDataUnsafe: { user: { first_name: 'Тест', last_name: '' } },
      themeParams:    {},
      MainButton,
      BackButton,
      HapticFeedback,
      CloudStorage,
      onEvent() {},
    };
  }

  /* ────────────────────────────────────────────────────────
     2. Состояние приложения
  ──────────────────────────────────────────────────────── */
  const state = {
    screen:          'catalog',   // текущий экран
    service:         null,        // выбранная услуга (объект из SERVICES)
    date:            null,        // Date — выбранная дата
    time:            null,        // '14:00' — выбранное время
    slotsCache:      {},          // кеш слотов { 'YYYY-MM-DD': { morning, afternoon, evening } }
    userName:        '',          // имя пользователя
    userPhone:       '',          // телефон
    comment:         '',          // комментарий
    galleryIndex:    0,           // текущий слайд галереи
    selectedDayIdx:  0,           // индекс выбранного дня в стрипе
    days:            [],          // массив дней для стрипа
  };

  /* ────────────────────────────────────────────────────────
     3. Вспомогательные функции MainButton / BackButton
  ──────────────────────────────────────────────────────── */
  let _mainClickFn = null;
  let _backClickFn = null;

  function setMainBtn(text, fn, enabled = true) {
    if (_mainClickFn) tg.MainButton.offClick(_mainClickFn);
    _mainClickFn = fn;
    tg.MainButton.setText(text);
    document.getElementById('browser-main-btn').dataset.text = text;
    enabled ? tg.MainButton.enable() : tg.MainButton.disable();
    tg.MainButton.onClick(fn);
    tg.MainButton.show();
  }

  function hideMainBtn() {
    if (_mainClickFn) tg.MainButton.offClick(_mainClickFn);
    _mainClickFn = null;
    tg.MainButton.hide();
  }

  function setBackBtn(fn) {
    if (_backClickFn) tg.BackButton.offClick(_backClickFn);
    _backClickFn = fn;
    tg.BackButton.onClick(fn);
    tg.BackButton.show();
  }

  function hideBackBtn() {
    if (_backClickFn) tg.BackButton.offClick(_backClickFn);
    _backClickFn = null;
    tg.BackButton.hide();
  }

  /* ────────────────────────────────────────────────────────
     4. Роутер — переходы между экранами
  ──────────────────────────────────────────────────────── */
  const SCREENS_ORDER = ['catalog', 'service', 'datetime', 'confirm', 'success'];

  const Router = {
    /** Перейти на экран вперёд */
    go(name, animClass = 'slide-in-right') {
      const prev = document.getElementById('screen-' + state.screen);
      const next = document.getElementById('screen-' + name);
      if (!next) return;

      // Убираем активный экран
      if (prev && prev !== next) prev.classList.remove('active');

      // Запускаем анимацию входа
      next.classList.remove('active', 'slide-in-right', 'slide-in-left', 'fade-in');
      next.classList.add(animClass);

      // После завершения анимации — ставим active
      setTimeout(() => {
        next.classList.remove('slide-in-right', 'slide-in-left', 'fade-in');
        next.classList.add('active');
      }, 270);

      state.screen = name;

      // Монтируем экран (рендер + кнопки)
      const mountFn = Screens[name]?.mount;
      if (mountFn) mountFn();
    },

    /** Перейти назад */
    back() {
      const idx  = SCREENS_ORDER.indexOf(state.screen);
      const prev = SCREENS_ORDER[idx - 1];
      if (prev) this.go(prev, 'slide-in-left');
    },

    /** Вернуться на каталог (сбросить стек) */
    reset() {
      this.go('catalog', 'fade-in');
    },
  };

  /* ────────────────────────────────────────────────────────
     5. Экраны
  ──────────────────────────────────────────────────────── */
  const Screens = {

    /* ── Экран 1: Каталог ─────────────────────────────── */
    catalog: {
      _category: 'all',

      mount() {
        // Кнопки Telegram
        hideMainBtn();
        hideBackBtn();
        tg.disableClosingConfirmation?.();

        // Шапка: приветствие
        const user = tg.initDataUnsafe?.user;
        const greeting = document.getElementById('greeting');
        if (user?.first_name && greeting) {
          greeting.textContent = 'Привет, ' + user.first_name + '!';
        }

        // Рендер фильтров
        this._renderFilters();

        // Показываем скелетон, затем загружаем услуги
        this._showSkeleton();
        setTimeout(() => this._renderServices(), 350);
      },

      _renderFilters() {
        const wrap = document.getElementById('filter-chips');
        if (!wrap) return;

        wrap.innerHTML = '';
        CATEGORIES.forEach(cat => {
          const chip = document.createElement('button');
          chip.className = 'chip' + (cat.id === this._category ? ' active' : '');
          chip.setAttribute('role', 'tab');
          chip.setAttribute('aria-selected', cat.id === this._category ? 'true' : 'false');
          chip.textContent = cat.emoji + ' ' + cat.label;
          chip.addEventListener('click', () => {
            this._category = cat.id;
            // Обновляем чипы
            wrap.querySelectorAll('.chip').forEach((c, i) => {
              c.classList.toggle('active', CATEGORIES[i].id === cat.id);
            });
            this._renderServices();
            tg.HapticFeedback.selectionChanged();
          });
          wrap.appendChild(chip);
        });
      },

      _showSkeleton() {
        const list = document.getElementById('services-list');
        if (!list) return;
        list.innerHTML = [0, 1, 2].map(() => `
          <div class="skeleton-card">
            <div class="skeleton-thumb"></div>
            <div class="skeleton-body">
              <div class="skeleton-line w70"></div>
              <div class="skeleton-line w50"></div>
            </div>
          </div>
        `).join('');
      },

      _renderServices() {
        const list  = document.getElementById('services-list');
        const empty = document.getElementById('empty-state');
        if (!list) return;

        const filtered = SERVICES.filter(s => this._category === 'all' || s.category === this._category);

        if (filtered.length === 0) {
          list.innerHTML = '';
          if (empty) empty.style.display = 'block';
          return;
        }
        if (empty) empty.style.display = 'none';

        list.innerHTML = '';
        filtered.forEach((service, i) => {
          const card = document.createElement('div');
          card.className = 'service-card card-appear';
          card.style.animationDelay = (i * 50) + 'ms';
          card.setAttribute('role', 'listitem');
          card.innerHTML = `
            <div class="service-thumb" style="background: ${service.gradient}">
              <span class="service-thumb-emoji">${service.emoji}</span>
            </div>
            <div class="service-body">
              <div class="service-card-name">${service.name}</div>
              <div class="service-card-meta">
                <span>${formatDuration(service.duration)}</span>
                <span class="meta-separator">·</span>
                <span class="service-card-price">${formatPrice(service.price)}</span>
              </div>
            </div>
          `;
          card.addEventListener('click', () => {
            state.service = service;
            tg.HapticFeedback.impactOccurred('light');
            Router.go('service');
          });
          list.appendChild(card);
        });
      },
    },

    /* ── Экран 2: Карточка услуги ─────────────────────── */
    service: {
      _touchStartX: 0,
      _touchStartY: 0,

      mount() {
        const s = state.service;
        if (!s) { Router.back(); return; }

        state.galleryIndex = 0;

        // Кнопки
        setBackBtn(() => { tg.HapticFeedback.impactOccurred('light'); Router.back(); });
        setMainBtn('Записаться', () => {
          tg.HapticFeedback.impactOccurred('medium');
          Router.go('datetime');
        });

        // Галерея
        this._renderGallery(s);

        // Детали услуги
        this._renderDetails(s);

        // Скролл наверх
        const scroll = document.querySelector('#screen-service .screen-scroll');
        if (scroll) scroll.scrollTop = 0;
      },

      _renderGallery(s) {
        const track = document.getElementById('gallery-track');
        const dots  = document.getElementById('gallery-dots');
        if (!track || !dots) return;

        track.innerHTML = '';
        dots.innerHTML  = '';

        s.photos.forEach((photo, i) => {
          // Слайд
          const slide = document.createElement('div');
          slide.className = 'gallery-slide';
          slide.style.background = s.gradient;
          slide.textContent = photo;
          track.appendChild(slide);

          // Точка
          const dot = document.createElement('div');
          dot.className = 'gallery-dot' + (i === 0 ? ' active' : '');
          dots.appendChild(dot);
        });

        // Touch-свайп по галерее
        const gallery = document.getElementById('service-gallery');
        if (gallery) {
          gallery.ontouchstart = (e) => {
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
          };
          gallery.ontouchend = (e) => {
            const dx = e.changedTouches[0].clientX - this._touchStartX;
            const dy = Math.abs(e.changedTouches[0].clientY - this._touchStartY);
            if (Math.abs(dx) > 40 && dy < 60) {
              this._slideGallery(dx < 0 ? 1 : -1);
            }
          };
        }
      },

      _slideGallery(delta) {
        const s       = state.service;
        const total   = s.photos.length;
        state.galleryIndex = Math.max(0, Math.min(total - 1, state.galleryIndex + delta));
        const track   = document.getElementById('gallery-track');
        const dots    = document.querySelectorAll('.gallery-dot');
        if (track) track.style.transform = `translateX(-${state.galleryIndex * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === state.galleryIndex));
        tg.HapticFeedback.selectionChanged();
      },

      _renderDetails(s) {
        // Категория
        const catEl = document.getElementById('service-category');
        if (catEl) {
          const cat = CATEGORIES.find(c => c.id === s.category);
          catEl.textContent = cat ? cat.emoji + ' ' + cat.label : '';
        }

        // Название
        const nameEl = document.getElementById('service-name');
        if (nameEl) nameEl.textContent = s.name;

        // Мета
        const durEl = document.getElementById('service-duration');
        const priceEl = document.getElementById('service-price');
        if (durEl)   durEl.textContent   = formatDuration(s.duration);
        if (priceEl) priceEl.textContent = formatPrice(s.price);

        // Описание с кнопкой «Подробнее»
        const descEl   = document.getElementById('service-desc');
        const expandEl = document.getElementById('btn-expand');
        if (descEl) {
          descEl.textContent = s.description;
          // Проверяем, нужна ли кнопка «Подробнее»
          setTimeout(() => {
            const lineH    = parseFloat(getComputedStyle(descEl).lineHeight) || 22;
            const maxLines = 3;
            if (descEl.scrollHeight > lineH * maxLines + 4) {
              descEl.classList.add('collapsed');
              if (expandEl) {
                expandEl.style.display = 'block';
                expandEl.onclick = () => {
                  descEl.classList.remove('collapsed');
                  expandEl.style.display = 'none';
                };
              }
            } else {
              descEl.classList.remove('collapsed');
              if (expandEl) expandEl.style.display = 'none';
            }
          }, 50);
        }

        // Рейтинг-бейдж
        const ratingEl = document.getElementById('service-rating-badge');
        if (ratingEl) {
          ratingEl.textContent = `⭐ ${MASTER.rating} (${MASTER.reviewsCount})`;
        }

        // Отзывы
        const reviewsEl = document.getElementById('reviews-list');
        if (reviewsEl) {
          reviewsEl.innerHTML = '';
          (s.reviews || []).forEach(r => {
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
            const card  = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
              <div class="review-header">
                <span class="review-author">${r.author}</span>
                <span class="review-date">${r.date}</span>
              </div>
              <div class="review-stars">${stars}</div>
              <div class="review-text">${r.text}</div>
            `;
            reviewsEl.appendChild(card);
          });
        }
      },
    },

    /* ── Экран 3: Дата и время ────────────────────────── */
    datetime: {
      mount() {
        const s = state.service;
        if (!s) { Router.reset(); return; }

        // Кнопки Telegram
        setBackBtn(() => { tg.HapticFeedback.impactOccurred('light'); Router.back(); });
        setMainBtn('Продолжить →', () => {
          tg.HapticFeedback.impactOccurred('medium');
          Router.go('confirm');
        }, false); // сначала заблокирована

        // Генерируем список дней
        state.days = getUpcomingDays(14);

        // Выбираем первый рабочий день по умолчанию
        state.selectedDayIdx = state.days.findIndex(d => !d.isWeekend);
        if (state.selectedDayIdx < 0) state.selectedDayIdx = 0;
        state.date = state.days[state.selectedDayIdx].date;
        state.time = null;

        // Рендер стрипа
        this._renderDayStrip();

        // Рендер слотов для выбранного дня
        this._renderSlots();

        // Скролл наверх
        const scroll = document.querySelector('#screen-datetime .screen-scroll');
        if (scroll) scroll.scrollTop = 0;
      },

      _renderDayStrip() {
        const strip = document.getElementById('day-strip');
        if (!strip) return;

        strip.innerHTML = '';
        state.days.forEach((day, i) => {
          const cell = document.createElement('div');
          cell.className = 'day-cell' +
            (day.isWeekend ? ' weekend' : '') +
            (i === state.selectedDayIdx ? ' active' : '');
          cell.innerHTML = `
            <span class="day-name">${day.dayName}</span>
            <span class="day-num">${day.dayNum}</span>
          `;
          if (!day.isWeekend) {
            cell.addEventListener('click', () => {
              state.selectedDayIdx = i;
              state.date = day.date;
              state.time = null;
              // Обновляем активный день
              strip.querySelectorAll('.day-cell').forEach((c, ci) => {
                c.classList.toggle('active', ci === i);
              });
              tg.HapticFeedback.selectionChanged();
              this._renderSlots();
              // Сбрасываем MainButton
              setMainBtn('Продолжить →', () => {
                tg.HapticFeedback.impactOccurred('medium');
                Router.go('confirm');
              }, false);
            });
          }
          strip.appendChild(cell);
        });
      },

      _renderSlots() {
        const day = state.days[state.selectedDayIdx];
        if (!day) return;

        // Обновляем подпись даты
        const dateLabel = document.getElementById('selected-date-label');
        const durationHint = document.getElementById('duration-hint');
        if (dateLabel)    dateLabel.textContent   = formatDateRu(day.date);
        if (durationHint) durationHint.textContent = `Услуга займёт ${formatDuration(state.service.duration)}`;

        // Получаем слоты (из кеша или генерируем)
        const key = day.date.toDateString();
        if (!state.slotsCache[key]) {
          state.slotsCache[key] = getSlotsForDate(day.date);
        }
        const slots = state.slotsCache[key];

        const noMsg  = document.getElementById('no-slots-msg');
        const wrap   = document.getElementById('slots-container');

        if (!slots) {
          // Выходной день
          if (wrap)  wrap.style.display  = 'none';
          if (noMsg) noMsg.style.display = 'block';
          return;
        }

        if (wrap)  wrap.style.display  = 'block';
        if (noMsg) noMsg.style.display = 'none';

        this._fillSlotGroup('slots-morning',   slots.morning);
        this._fillSlotGroup('slots-afternoon', slots.afternoon);
        this._fillSlotGroup('slots-evening',   slots.evening);
      },

      _fillSlotGroup(elId, slotArr) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = '';
        slotArr.forEach(slot => {
          const btn = document.createElement('button');
          btn.className = 'slot-btn' + (slot.busy ? ' busy' : '');
          btn.textContent = slot.time;
          if (!slot.busy) {
            btn.addEventListener('click', () => {
              // Убираем выделение у всех слотов
              document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              state.time = slot.time;
              // Активируем MainButton
              setMainBtn('Продолжить →', () => {
                tg.HapticFeedback.impactOccurred('medium');
                Router.go('confirm');
              }, true);
              tg.HapticFeedback.impactOccurred('light');
            });
          }
          el.appendChild(btn);
        });
      },
    },

    /* ── Экран 4: Подтверждение ───────────────────────── */
    confirm: {
      mount() {
        const s = state.service;
        if (!s || !state.date || !state.time) { Router.reset(); return; }

        // Защита от случайного закрытия
        tg.enableClosingConfirmation?.();

        // Кнопки
        setBackBtn(() => { tg.HapticFeedback.impactOccurred('light'); Router.back(); });
        setMainBtn('Подтвердить запись', () => this._submit(), this._isPhoneValid());

        // Предзаполнение имени из Telegram
        const user   = tg.initDataUnsafe?.user;
        const nameEl = document.getElementById('input-name');
        if (nameEl) {
          nameEl.value = state.userName ||
            [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
            '';
          nameEl.oninput = () => { state.userName = nameEl.value.trim(); };
        }

        // Предзаполнение телефона из CloudStorage
        const phoneEl = document.getElementById('input-phone');
        if (phoneEl) {
          phoneEl.value = state.userPhone;
          phoneEl.oninput = () => {
            state.userPhone = phoneEl.value;
            const valid = this._isPhoneValid();
            setMainBtn('Подтвердить запись', () => this._submit(), valid);
            const field = phoneEl.closest('.form-field');
            if (field) field.classList.toggle('error', !valid && phoneEl.value.length > 5);
          };
        }

        // Комментарий
        const commentEl = document.getElementById('input-comment');
        if (commentEl) {
          commentEl.value = state.comment;
          commentEl.oninput = () => { state.comment = commentEl.value; };
        }

        // Сводка записи
        this._renderSummary();

        // Скролл наверх
        const scroll = document.querySelector('#screen-confirm .screen-scroll');
        if (scroll) scroll.scrollTop = 0;
      },

      _isPhoneValid() {
        const digits = state.userPhone.replace(/\D/g, '');
        return digits.length >= 11;
      },

      _renderSummary() {
        const s       = state.service;
        const endTime = calcEndTime(state.time, s.duration);

        const setText = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
        };

        setText('sum-service',  s.name);
        setText('sum-date',     formatDateRu(state.date));
        setText('sum-time',     `${state.time} — ${endTime}`);
        setText('sum-duration', formatDuration(s.duration));
        setText('sum-price',    formatPrice(s.price));
      },

      _submit() {
        if (!this._isPhoneValid()) {
          // Подсвечиваем поле и вибрируем ошибкой
          const phoneEl = document.getElementById('input-phone');
          const field   = phoneEl?.closest('.form-field');
          if (field) field.classList.add('error');
          tg.HapticFeedback.notificationOccurred('error');

          // Сохраняем телефон в CloudStorage для следующих записей
          return;
        }

        // Имитируем отправку (в реальном проекте — fetch на бэкенд)
        tg.MainButton.showProgress(true);
        tg.MainButton.disable?.();

        // Сохраняем телефон в CloudStorage
        tg.CloudStorage.setItem('phone', state.userPhone);

        setTimeout(() => {
          tg.MainButton.hideProgress(false);
          tg.disableClosingConfirmation?.();
          tg.HapticFeedback.notificationOccurred('success');
          Router.go('success', 'fade-in');
        }, 1200);
      },
    },

    /* ── Экран 5: Успех ───────────────────────────────── */
    success: {
      mount() {
        const s = state.service;

        // BackButton скрыт — нельзя вернуться к форме
        hideBackBtn();

        // MainButton — на главную
        setMainBtn('Вернуться в каталог', () => {
          // Сбрасываем стейт записи
          state.service = null;
          state.date    = null;
          state.time    = null;
          state.comment = '';
          Router.reset();
        });

        // Заполняем сводку
        if (s) this._renderSummary(s);
      },

      _renderSummary(s) {
        const summaryEl = document.getElementById('success-summary');
        if (!summaryEl) return;

        const endTime = calcEndTime(state.time, s.duration);
        const rows = [
          { icon: '💅', text: s.name },
          { icon: '📅', text: formatDateRu(state.date) },
          { icon: '🕐', text: `${state.time} — ${endTime}` },
          { icon: '💰', text: formatPrice(s.price) },
        ];

        summaryEl.innerHTML = rows.map(r => `
          <div class="success-row">
            <span class="success-row-icon">${r.icon}</span>
            <span>${r.text}</span>
          </div>
        `).join('');

        // Кнопка «+ В календарь»
        const calBtn = document.getElementById('btn-calendar');
        if (calBtn) {
          calBtn.onclick = () => {
            const url = this._buildCalendarUrl(s);
            tg.openLink(url);
          };
        }
      },

      /** Генерирует ссылку на Google Calendar */
      _buildCalendarUrl(s) {
        const d        = state.date;
        const [h, m]   = state.time.split(':').map(Number);
        const startDt  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        const endDt    = new Date(startDt.getTime() + s.duration * 60000);

        const fmt = (dt) => dt.toISOString().replace(/[-:]/g, '').replace('.000', '');

        return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
          '&text=' + encodeURIComponent(s.name + ' — ' + MASTER.masterName) +
          '&dates=' + fmt(startDt) + '/' + fmt(endDt) +
          '&details=' + encodeURIComponent('Запись в ' + MASTER.name);
      },
    },

  }; // end Screens

  /* ────────────────────────────────────────────────────────
     6. Онбординг: показывается один раз при первом открытии
  ──────────────────────────────────────────────────────── */
  function showOnboardingOnce() {
    const ONB_KEY = 'onboarding_shown_v1';
    if (localStorage.getItem(ONB_KEY)) return;

    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) {
      const nameEl = document.getElementById('onboarding-name');
      if (nameEl) nameEl.textContent = user.first_name + '!';
    }

    overlay.classList.add('onb-in');

    document.getElementById('onboarding-btn').addEventListener('click', () => {
      localStorage.setItem(ONB_KEY, '1');
      overlay.classList.remove('onb-in');
      overlay.classList.add('onb-out');
      setTimeout(() => overlay.remove(), 300);
    });
  }

  /* ────────────────────────────────────────────────────────
     7. Оффер-модалка: показывается один раз при первом открытии
  ──────────────────────────────────────────────────────── */
  function showOfferOnce() {
    const OFFER_KEY = 'offer_shown_v1';
    if (localStorage.getItem(OFFER_KEY)) return;

    const overlay = document.getElementById('offer-overlay');
    if (!overlay) return;

    overlay.classList.add('offer-in');

    function closeOffer() {
      localStorage.setItem(OFFER_KEY, '1');
      overlay.classList.remove('offer-in');
      overlay.classList.add('offer-out');
      setTimeout(() => overlay.remove(), 300);
    }

    document.getElementById('offer-btn').addEventListener('click', () => {
      tg.openLink('https://t.me/anuyta_beauty_bot?start=from_app');
      closeOffer();
    });

    document.getElementById('offer-skip').addEventListener('click', closeOffer);
  }

  /* ────────────────────────────────────────────────────────
     7. Инициализация приложения
  ──────────────────────────────────────────────────────── */
  function init() {
    // Разворачиваем на весь экран
    tg.expand();

    // Устанавливаем цвет шапки под тему Telegram
    tg.setHeaderColor?.('bg_color');

    // Сигнализируем Telegram что приложение готово
    tg.ready();

    // Подписка на смену темы (тёмная/светлая)
    tg.onEvent?.('themeChanged', () => {
      // CSS-переменные --tg-theme-* обновятся автоматически
    });

    // Подписка на изменение viewport (при появлении клавиатуры на iOS)
    tg.onEvent?.('viewportChanged', ({ isStateStable }) => {
      if (isStateStable) {
        document.documentElement.style.setProperty(
          '--viewport-height',
          (tg.viewportStableHeight || window.innerHeight) + 'px'
        );
      }
    });

    // Предзаполнение данных пользователя
    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) {
      state.userName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    }

    // Загрузка телефона из CloudStorage (если был сохранён)
    tg.CloudStorage.getItem('phone', (err, val) => {
      if (!err && val) state.userPhone = val;
    });

    // Заполняем статичные данные шапки каталога
    const masterNameEl    = document.getElementById('master-name');
    const masterRatingEl  = document.getElementById('master-rating');
    const masterReviewsEl = document.getElementById('master-reviews');
    if (masterNameEl)    masterNameEl.textContent    = MASTER.name;
    if (masterRatingEl)  masterRatingEl.textContent  = MASTER.rating;
    if (masterReviewsEl) masterReviewsEl.textContent = `· ${MASTER.reviewsCount} отзывов`;

    // Запускаем с экрана каталога
    Screens.catalog.mount();

    // Онбординг — один раз при первом открытии
    showOnboardingOnce();

    // Оффер — один раз при первом открытии (со второго визита)
    showOfferOnce();

    // Кнопка «Поделиться с другом»
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        tg.HapticFeedback.impactOccurred('light');
        const url = 'https://t.me/anuyta_beauty_bot';
        const text = 'Записываюсь к мастеру маникюра через бота — быстро и удобно 💅';
        tg.openTelegramLink?.('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text))
          || tg.openLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text));
      });
    }
  }

  // Запускаем после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
