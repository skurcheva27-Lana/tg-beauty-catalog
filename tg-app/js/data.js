/**
 * data.js — данные приложения
 * Здесь хранятся: мастер, категории, услуги, генератор слотов
 * Чтобы изменить данные — редактируй только этот файл
 */

'use strict';

/* ── Мастер ──────────────────────────────────────────────── */
const MASTER = {
  name:          'Студия Ани',
  masterName:    'Анна Смирнова',
  emoji:         '💅',
  rating:        4.9,
  reviewsCount:  127,
  description:   'Мастер маникюра и педикюра. Работаю с 2018 года.',
  workDays:      [1, 2, 3, 4, 5, 6], // 0=вс, 1=пн … 6=сб (воскресенье — выходной)
  workHours:     { start: 9, end: 20 },
};

/* ── Категории ──────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',    emoji: '✨', label: 'Все' },
  { id: 'nails',  emoji: '💅', label: 'Ногти' },
  { id: 'brows',  emoji: '👁', label: 'Брови/Ресницы' },
  { id: 'care',   emoji: '🧴', label: 'Уход' },
];

/* ── Услуги ─────────────────────────────────────────────── */
const SERVICES = [
  {
    id: 1,
    category:    'nails',
    name:        'Маникюр + гель-лак',
    short:       'Покрытие гелем на 3–4 недели',
    description: 'Классический маникюр с покрытием гель-лаком. Включает обработку кутикулы, придание формы, базовое покрытие, цвет и топ. Палитра — более 200 оттенков. Держится 3–4 недели без сколов.',
    duration:    75,
    price:       2500,
    emoji:       '💅',
    gradient:    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    photos:      ['💅', '✨', '🌸'],
    reviews: [
      { author: 'Ксения', text: 'Аня — волшебница, держится уже 3 недели!',                     date: 'вчера',          rating: 5 },
      { author: 'Марина', text: 'Очень аккуратная работа, форма идеальная. Теперь хожу только сюда!', date: '3 дня назад',  rating: 5 },
    ],
  },
  {
    id: 2,
    category:    'nails',
    name:        'Маникюр классический',
    short:       'Ухоженные ногти без покрытия',
    description: 'Маникюр без покрытия — для тех, кто любит натуральный вид. Обработка кутикулы, придание формы, шлифовка и покрытие укрепляющей базой.',
    duration:    45,
    price:       1500,
    emoji:       '✨',
    gradient:    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    photos:      ['✨', '🌸', '💎'],
    reviews: [
      { author: 'Оля', text: 'Очень нежно и аккуратно, ногти выглядят ухоженно!', date: '2 дня назад', rating: 5 },
    ],
  },
  {
    id: 3,
    category:    'nails',
    name:        'Педикюр + гель-лак',
    short:       'Идеальные ножки с покрытием',
    description: 'Полный педикюр с гель-лаком. Расслабляющая ванночка, обработка огрубевшей кожи, уход за кутикулой, покрытие. Результат держится 3–5 недель.',
    duration:    90,
    price:       2800,
    emoji:       '🦶',
    gradient:    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    photos:      ['🦶', '✨', '🌺'],
    reviews: [
      { author: 'Таня', text: 'Делала педикюр первый раз — совсем не больно, всё супер аккуратно.', date: '5 дней назад', rating: 5 },
    ],
  },
  {
    id: 4,
    category:    'nails',
    name:        'Педикюр классический',
    short:       'Уход за стопами без покрытия',
    description: 'Классический педикюр без покрытия. Ванночка с морской солью, обработка стоп и кутикулы, шлифовка. Идеально для поддержания здоровья кожи стоп.',
    duration:    60,
    price:       2000,
    emoji:       '🌸',
    gradient:    'linear-gradient(135deg, #fda085 0%, #f6d365 100%)',
    photos:      ['🌸', '🦶', '✨'],
    reviews: [
      { author: 'Света', text: 'Быстро, качественно и недорого! Записалась снова.', date: '1 неделю назад', rating: 5 },
    ],
  },
  {
    id: 5,
    category:    'brows',
    name:        'Коррекция + окрашивание бровей',
    short:       'Форма + насыщенный цвет хной',
    description: 'Коррекция формы бровей (воск + пинцет) и стойкое окрашивание хной. Подбираем форму и оттенок под тип лица. Результат держится 2–3 недели.',
    duration:    45,
    price:       1200,
    emoji:       '👁',
    gradient:    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    photos:      ['👁', '✨', '🌿'],
    reviews: [
      { author: 'Лена', text: 'Брови получились идеальные! Давно искала мастера с таким чувством формы.', date: '2 дня назад',   rating: 5 },
      { author: 'Юля', text: 'Держатся уже 2,5 недели, очень довольна результатом.',                       date: '4 дня назад',   rating: 5 },
    ],
  },
  {
    id: 6,
    category:    'brows',
    name:        'Коррекция бровей',
    short:       'Чёткая форма за 20 минут',
    description: 'Коррекция формы бровей воском и пинцетом без окрашивания. Подходит для поддержания уже готовой формы.',
    duration:    20,
    price:       600,
    emoji:       '✏️',
    gradient:    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    photos:      ['✏️', '👁', '✨'],
    reviews: [
      { author: 'Настя', text: 'Хожу раз в 3 недели на поддержание — быстро и ровно!', date: '3 дня назад', rating: 5 },
    ],
  },
  {
    id: 7,
    category:    'brows',
    name:        'Наращивание ресниц (классика)',
    short:       '1 к 1, натуральный эффект',
    description: 'Классическое наращивание: 1 натуральная ресница — 1 искусственная. Материалы премиум-класса (Корея). Натуральное удлинение. Держатся 3–4 недели при правильном уходе.',
    duration:    120,
    price:       3000,
    emoji:       '👀',
    gradient:    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    photos:      ['👀', '✨', '🌟'],
    reviews: [
      { author: 'Даша', text: 'Ресницы держатся уже месяц! Очень красиво и не чувствуются совсем.',          date: '3 дня назад',    rating: 5 },
      { author: 'Вика', text: 'Наконец нашла мастера, с которым не страшно закрывать глаза 😄',             date: '1 неделю назад', rating: 5 },
    ],
  },
  {
    id: 8,
    category:    'brows',
    name:        'Коррекция ресниц',
    short:       'Поддержание через 2–3 недели',
    description: 'Коррекция после наращивания: снятие отросших и поправка выпавших ресниц. Рекомендуется делать раз в 2–3 недели для поддержания эффекта.',
    duration:    60,
    price:       1500,
    emoji:       '⭐',
    gradient:    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    photos:      ['⭐', '👀', '✨'],
    reviews: [
      { author: 'Ира', text: 'Коррекция быстрая, после выгляжу как новенькая!', date: '5 дней назад', rating: 5 },
    ],
  },
  {
    id: 9,
    category:    'care',
    name:        'Уход за лицом (базовый)',
    short:       'Очищение, маска, увлажнение',
    description: 'Базовый комплекс: мягкое очищение, тонизирование, питательная маска, финальное увлажнение. Подходит для всех типов кожи. Кожа становится мягкой и сияющей.',
    duration:    60,
    price:       2200,
    emoji:       '🧴',
    gradient:    'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    photos:      ['🧴', '✨', '🌿'],
    reviews: [
      { author: 'Женя', text: 'После процедуры кожа просто светится! Записалась на курс.', date: '1 неделю назад', rating: 5 },
    ],
  },
  {
    id: 10,
    category:    'care',
    name:        'Чистка лица ультразвуком',
    short:       'Поры, сияние, без боли',
    description: 'Ультразвуковая чистка мягко очищает поры, удаляет загрязнения и комедоны без боли. Выравнивает тон и текстуру кожи. Нет реабилитационного периода.',
    duration:    45,
    price:       1800,
    emoji:       '💎',
    gradient:    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    photos:      ['💎', '✨', '🧴'],
    reviews: [
      { author: 'Даша', text: 'Поры стали значительно меньше, кожа ровная. Очень довольна!', date: '4 дня назад', rating: 5 },
    ],
  },
];

/* ── Слоты времени ──────────────────────────────────────── */

/** Базовые временны́е слоты для каждой части дня */
const BASE_SLOTS = {
  morning:   ['09:00', '10:00', '11:00'],
  afternoon: ['13:00', '14:00', '15:00', '16:00'],
  evening:   ['18:00', '19:00', '20:00'],
};

/**
 * Генерирует слоты для конкретной даты.
 * Использует хеш даты — результат одинаков при повторных вызовах.
 * @param {Date} date
 * @returns {{ morning, afternoon, evening } | null} null если выходной
 */
function getSlotsForDate(date) {
  // Проверяем рабочий день
  if (!MASTER.workDays.includes(date.getDay())) return null;

  // Простой детерминированный хеш по дате
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  function makeBusy(times, offset) {
    return times.map((time, i) => ({
      time,
      busy: ((seed + i * 7 + offset) % 5) === 0, // ~20% занято
    }));
  }

  return {
    morning:   makeBusy(BASE_SLOTS.morning,   0),
    afternoon: makeBusy(BASE_SLOTS.afternoon, 3),
    evening:   makeBusy(BASE_SLOTS.evening,   6),
  };
}

/**
 * Возвращает массив следующих N рабочих дней начиная с сегодня.
 * @param {number} count — сколько дней показывать
 * @returns {Array<{date, dayName, dayNum, isToday, isWeekend}>}
 */
function getUpcomingDays(count = 14) {
  const RU_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const today   = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  let cursor = new Date(today);

  while (days.length < count) {
    const isToday    = cursor.getTime() === today.getTime();
    const isWeekend  = cursor.getDay() === 0; // воскресенье
    days.push({
      date:    new Date(cursor),
      dayName: isToday ? 'Сег' : RU_DAYS[cursor.getDay()],
      dayNum:  cursor.getDate(),
      isToday,
      isWeekend,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/**
 * Форматирует дату на русском языке.
 * Пример: «среда, 3 марта»
 */
function formatDateRu(date) {
  const RU_WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const RU_MONTHS   = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${RU_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
}

/**
 * Вычисляет время окончания услуги.
 * Пример: '14:00' + 75 мин → '15:15'
 */
function calcEndTime(startTime, durationMin) {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMin;
  const eh = Math.floor(totalMin / 60);
  const em = totalMin % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

/**
 * Форматирует цену: 2500 → «2 500 ₽»
 */
function formatPrice(price) {
  return price.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Форматирует длительность: 75 → «1 ч 15 мин», 45 → «45 мин»
 */
function formatDuration(min) {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}
