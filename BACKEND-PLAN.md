# BACKEND-PLAN.md
## SaaS-платформа для мастеров бьюти-ниши на базе Telegram Mini App

> Версия: 1.1 | Март 2026
> Этот документ — полный план бэкенда под ключ. Следуй ему сверху вниз.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ РЕАЛИЗАЦИИ (март 2026)

> Этот раздел отражает реально написанный код. Остальные разделы — план.

### Что реализовано

| Компонент | Статус | Примечания |
|-----------|--------|------------|
| Fastify сервер | ✅ | Fastify **5.8.2** (в плане было 4) |
| База данных | ✅ | **Supabase** (не Prisma + PostgreSQL) |
| Логирование | ✅ | `src/logger.js` → `logs/app.log`, `logs/errors.log` |
| Мульти-бот менеджер | ✅ | `src/bot/manager.js`, webhook на каждого мастера |
| Публичное API | ✅ | GET `/api/v1/m/:slug`, `/services`, `/services/:id` |
| Регистрация мастера | ✅ | POST `/api/v1/master/register` |
| Профиль мастера | ✅ | GET `/api/v1/master/profile` (auth: X-Master-Secret) |
| Подключение бота | ✅ | POST/DELETE/GET `/api/v1/master/bot/*` |
| Telegram webhook | ✅ | POST `/webhooks/telegram/:masterId` |
| Деплой (локально + ngrok) | ✅ | см. DEPLOYMENT.md |

### Что ещё не реализовано (из плана)

| Компонент | Приоритет |
|-----------|-----------|
| Client API (`/api/v1/client/*`) — создание записи | 🔴 Высокий |
| Верификация Telegram initData | 🔴 Высокий |
| JWT авторизация (кабинет мастера) | 🟡 Средний |
| CRUD услуг через API | 🟡 Средний |
| Управление расписанием | 🟡 Средний |
| Управление записями | 🟡 Средний |
| BullMQ + Redis (напоминания) | 🟡 Средний |
| Подписки и платежи (YooKassa) | 🟠 Следующий этап |
| Аналитика (PRO) | 🟠 Следующий этап |
| Docker + VPS деплой | 🟠 Следующий этап |

### Отличия реализации от плана

1. **Supabase вместо Prisma + PostgreSQL** — облачная БД, нет миграций Prisma, нет Redis на текущем этапе.
2. **X-Master-Secret вместо JWT** — упрощённая авторизация мастера (в плане V2 заменить на JWT).
3. **Fastify 5** вместо Fastify 4 — API совместимо, незначительные отличия.
4. **Логирование в файлы** — добавлено `src/logger.js`, запись в `logs/app.log` и `logs/errors.log`.
5. **Структура папок** — реализованные файлы: `src/server.js`, `src/db.js`, `src/logger.js`, `src/bot/manager.js`, `src/api/public/catalog.js`, `src/api/master/auth.js`, `src/api/master/bot.js`, `src/api/webhooks/telegram.js`.

---

---

## 1. СТЕК ТЕХНОЛОГИЙ

| Слой | Технология | Причина выбора |
|---|---|---|
| **Runtime** | Node.js 20 LTS | Стабильный, огромная экосистема, легко деплоить |
| **Framework** | Fastify 4 | Быстрее Express в 2x, схемы валидации встроены, плагины |
| **БД** | PostgreSQL 16 | Надёжность, JSON-поля, транзакции, живёт на Beget VPS |
| **ORM** | Prisma | Миграции, типобезопасность, читаемые схемы |
| **Очередь задач** | BullMQ + Redis | Отложенные напоминания, retry при сбое сети |
| **Бот** | Telegraf 4 | Лучший фреймворк для Node.js Telegram-ботов |
| **Аутентификация** | JWT (web) + initData Telegram (Mini App) | Два разных контекста — два метода |
| **Платежи** | YooKassa SDK + Telegram Payments | Как требуется |
| **Деплой** | Docker Compose на Beget VPS | Полный контроль, изоляция, легкий перезапуск |
| **Прокси** | Nginx + Let's Encrypt | HTTPS обязателен для Telegram |
| **Планировщик** | Node-cron | Ежедневная проверка истёкших подписок |

---

## 2. АРХИТЕКТУРА СИСТЕМЫ

```
┌─────────────────────────────────────────────────────┐
│                   КЛИЕНТЫ МАСТЕРА                    │
│         (открывают Mini App через бот мастера)       │
└────────────────────┬────────────────────────────────┘
                     │ Telegram WebApp
                     ▼
┌─────────────────────────────────────────────────────┐
│              MINI APP (Frontend)                     │
│    tg-app/  — существующий HTML/CSS/JS              │
│    URL: platform.ru/{master_slug}                   │
└────────────────────┬────────────────────────────────┘
                     │ REST API (JSON)
                     ▼
┌─────────────────────────────────────────────────────┐
│              FASTIFY API SERVER                      │
│  /api/v1/public/*   — открытые эндпоинты Mini App  │
│  /api/v1/client/*   — клиент (initData auth)        │
│  /api/v1/master/*   — мастер-кабинет (JWT auth)     │
│  /webhooks/*        — Telegram + YooKassa           │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
       ▼                      ▼
┌─────────────┐    ┌──────────────────────┐
│ PostgreSQL  │    │   Redis + BullMQ     │
│ (основная   │    │  (очередь: напомин., │
│   база)     │    │   уведомления)       │
└─────────────┘    └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   BOT MANAGER        │
                   │  Telegraf multi-bot  │
                   │  Каждый мастер =     │
                   │  отдельный webhook   │
                   └──────────────────────┘

┌─────────────────────────────────────────────────────┐
│              WEB-КАБИНЕТ МАСТЕРА                     │
│    platform.ru/admin  (отдельный SPA, V2)           │
│    На старте: управление через бота + API            │
└─────────────────────────────────────────────────────┘
```

---

## 3. СТРУКТУРА ПАПОК ПРОЕКТА

```
backend/
├── src/
│   ├── api/
│   │   ├── public/          # Публичное API для Mini App
│   │   │   ├── master.js    # GET /m/:slug — профиль + тема
│   │   │   ├── services.js  # GET /m/:slug/services
│   │   │   └── slots.js     # GET /m/:slug/slots
│   │   ├── client/          # API для клиентов (initData)
│   │   │   └── bookings.js  # POST/GET/DELETE bookings
│   │   ├── master/          # API для кабинета мастера (JWT)
│   │   │   ├── auth.js
│   │   │   ├── profile.js
│   │   │   ├── bot.js
│   │   │   ├── services.js
│   │   │   ├── schedule.js
│   │   │   ├── bookings.js
│   │   │   ├── clients.js
│   │   │   ├── analytics.js
│   │   │   ├── theme.js
│   │   │   └── subscription.js
│   │   └── webhooks/
│   │       ├── telegram.js  # POST /webhooks/tg/:master_id
│   │       └── yookassa.js  # POST /webhooks/yookassa
│   ├── bot/
│   │   ├── manager.js       # Регистрирует/удаляет ботов
│   │   ├── handlers/
│   │   │   ├── start.js     # /start для клиента
│   │   │   ├── master.js    # /bookings, /cancel для мастера
│   │   │   └── onboard.js   # Онбординг нового мастера
│   │   └── notifications/
│   │       ├── booking.js   # Подтверждение записи
│   │       ├── reminders.js # Напоминания за 24h и 2h
│   │       └── review.js    # Запрос отзыва после визита
│   ├── db/
│   │   └── schema.prisma    # Схема БД
│   ├── services/            # Бизнес-логика
│   │   ├── slots.js         # Расчёт свободных слотов
│   │   ├── bookings.js      # Создание/отмена записи
│   │   ├── subscription.js  # Проверка подписки, блокировка
│   │   └── payments.js      # Создание платежей YooKassa
│   ├── jobs/
│   │   ├── reminders.js     # BullMQ: постановка напоминаний
│   │   └── subscriptions.js # Cron: проверка истёкших подписок
│   ├── middleware/
│   │   ├── initData.js      # Верификация Telegram initData
│   │   └── jwt.js           # JWT для кабинета мастера
│   └── server.js            # Точка входа
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .env.example
```

---

## 4. СХЕМА БАЗЫ ДАННЫХ (Prisma)

### 4.1 Таблица: masters (мастера)

```prisma
model Master {
  id              String    @id @default(cuid())
  telegramId      BigInt    @unique           // ID из Telegram
  username        String?                     // @username в Telegram
  name            String                      // Имя студии / мастера
  masterName      String                      // Имя конкретного человека
  bio             String?                     // Описание
  avatarUrl       String?                     // Ссылка на фото (соцсети)
  phone           String?                     // Телефон мастера
  slug            String    @unique           // URL: platform.ru/ani-beauty

  // Бот
  botToken        String?   @unique           // Токен от @BotFather (хранится AES-256 зашифрованным, расшифровка в bot.manager.js)
  botUsername     String?                     // @username бота
  botWebhookActive Boolean  @default(false)   // Webhook зарегистрирован?
  botWebhookSecret String?                    // secret_token для верификации входящих Telegram-апдейтов

  // Рейтинг (обновляется при добавлении отзывов)
  rating          Float     @default(0)
  reviewsCount    Int       @default(0)

  // Статус аккаунта
  isActive        Boolean   @default(true)    // false = заблокирован платформой

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Связи
  services        Service[]
  schedule        Schedule?
  scheduleExceptions ScheduleException[]
  bookings        Booking[]
  clients         Client[]
  theme           Theme?
  subscription    Subscription?
  notifications   NotificationQueue[]
  reviews         Review[]
  payments        Payment[]
}
```

### 4.2 Таблица: services (услуги мастера)

```prisma
model Service {
  id          String    @id @default(cuid())
  masterId    String
  master      Master    @relation(fields: [masterId], references: [id])

  category    String                      // "nails" | "brows" | "skincare" | ...
  name        String                      // "Маникюр + гель-лак"
  shortDesc   String                      // Краткое описание (карточка)
  description String?                     // Полное описание
  durationMin Int                         // Длительность в минутах
  price       Int                         // Цена в рублях (целое число)
  emoji       String?                     // Эмодзи-иконка
  gradient    String?                     // CSS-градиент фона карточки
  photos      String[]                    // Массив URL фотографий
  isActive    Boolean   @default(true)    // Скрыть без удаления
  sortOrder   Int       @default(0)       // Порядок в каталоге

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  bookings    Booking[]
  reviews     Review[]
}
// ОГРАНИЧЕНИЕ: при isActive=true услуг не более 5 у free-плана
// Проверяется в сервисном слое, не в БД
```

### 4.3 Таблица: schedule (расписание мастера)

```prisma
model Schedule {
  id              String    @id @default(cuid())
  masterId        String    @unique
  master          Master    @relation(fields: [masterId], references: [id])

  workDays        Int[]                   // [1,2,3,4,5,6] — пн-сб (0=вс)
  workStart       String                  // "09:00"
  workEnd         String                  // "20:00"
  slotDurationMin Int       @default(60)  // Шаг слота (60 мин)
  breakBetweenMin Int       @default(0)   // Перерыв между записями

  updatedAt       DateTime  @updatedAt
}
```

### 4.4 Таблица: schedule_exceptions (исключения в расписании)

```prisma
model ScheduleException {
  id          String    @id @default(cuid())
  masterId    String
  master      Master    @relation(fields: [masterId], references: [id])

  date        DateTime  @db.Date            // Конкретная дата
  type        String                        // "day_off" | "modified" | "extra"
  customStart String?                       // Изменённое начало (если modified)
  customEnd   String?                       // Изменённый конец (если modified)
  note        String?                       // Заметка для мастера

  createdAt   DateTime  @default(now())

  @@unique([masterId, date])
}
```

### 4.5 Таблица: clients (клиенты мастера)

```prisma
model Client {
  id            String    @id @default(cuid())
  masterId      String
  master        Master    @relation(fields: [masterId], references: [id])

  telegramId    BigInt                      // ID клиента в Telegram
  firstName     String?
  lastName      String?
  username      String?
  phone         String?                     // Сохраняется из формы записи

  bookingsCount Int       @default(0)       // Денормализовано для скорости.
                                            // ПРАВИЛО: +1 при создании booking (CONFIRMED),
                                            //          -1 при отмене (CANCELLED_CLIENT / CANCELLED_MASTER).
                                            //          NO_SHOW и COMPLETED не меняют счётчик.
  totalSpent    Int       @default(0)       // Сумма потраченного (в рублях).
                                            // ПРАВИЛО: +priceSnapshot ТОЛЬКО при переводе в COMPLETED.
                                            //          При отмене не трогается.
  lastBookingAt DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  bookings      Booking[]

  @@unique([masterId, telegramId])          // Один клиент у одного мастера
}
```

### 4.6 Таблица: bookings (записи)

```prisma
model Booking {
  id              String    @id @default(cuid())
  masterId        String
  master          Master    @relation(fields: [masterId], references: [id])
  serviceId       String
  service         Service   @relation(fields: [serviceId], references: [id])
  clientId        String?
  client          Client?   @relation(fields: [clientId], references: [id])

  // Время записи
  date            DateTime  @db.Date        // Дата
  timeStart       String                    // "14:00"
  timeEnd         String                    // "15:15"
  durationMin     Int                       // Копируем из услуги на момент записи

  // Данные клиента (на момент записи, не из таблицы client)
  clientTelegramId BigInt?
  clientName      String                    // Из формы
  clientPhone     String                    // Из формы
  comment         String?

  // Статус
  status          BookingStatus @default(CONFIRMED)
  cancelledAt     DateTime?
  cancelledBy     String?                   // "client" | "master"
  cancellationReason String?
  completedAt     DateTime?

  // Цена на момент записи
  priceSnapshot   Int                       // Цена услуги на дату записи

  // Напоминания
  reminder24Sent  Boolean   @default(false)
  reminder2Sent   Boolean   @default(false)
  reviewRequested Boolean   @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  notifications   NotificationQueue[]
  review          Review?
}

enum BookingStatus {
  CONFIRMED           // Создана мгновенно
  CANCELLED_CLIENT    // Отменена клиентом
  CANCELLED_MASTER    // Отменена мастером
  COMPLETED           // Завершена (мастер отметил вручную)
  NO_SHOW             // Клиент не пришёл
}
```

### 4.7 Таблица: subscriptions (подписки)

```prisma
model Subscription {
  id                String    @id @default(cuid())
  masterId          String    @unique
  master            Master    @relation(fields: [masterId], references: [id])

  plan              Plan      @default(FREE)
  status            SubStatus @default(ACTIVE)

  // Даты
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  trialEndsAt        DateTime?               // 14 дней пробного периода
  cancelledAt        DateTime?

  // Рекарринг (автосписание)
  // FLOW: первый платёж → YooKassa возвращает payment.payment_method.id → сохраняем здесь
  //       каждый следующий месяц → создаём платёж с payment_method_id (без редиректа пользователя)
  //       при отмене подписки → yookassaPaymentMethodId обнуляется
  yookassaPaymentMethodId String?              // Сохранённый метод оплаты для авторекарринга

  // Grace period: 3 дня после истечения перед блокировкой
  gracePeriodEndsAt DateTime?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Связи
  payments          Payment[]
}

enum Plan {
  FREE    // До 5 услуг
  PRO     // Безлимитные услуги + темы + аналитика
}

enum SubStatus {
  TRIAL       // Пробный период
  ACTIVE      // Оплачена
  GRACE       // Истекла, grace period (3 дня)
  EXPIRED     // Полностью отключена
  CANCELLED   // Отменена мастером
}
```

### 4.8 Таблица: themes (тема приложения)

```prisma
model Theme {
  id              String    @id @default(cuid())
  masterId        String    @unique
  master          Master    @relation(fields: [masterId], references: [id])

  // Цвета (только для PRO)
  primaryColor    String    @default("#007AFF")   // Основной цвет кнопок
  secondaryColor  String    @default("#F2F2F7")   // Фон карточек
  accentColor     String    @default("#FF375F")   // Акцент, ценники
  bgColor         String    @default("#FFFFFF")   // Фон приложения

  // Брендинг (только для PRO)
  logoUrl         String?                          // URL логотипа
  appName         String?                          // Название в шапке

  // Тексты (только для PRO)
  welcomeTitle    String?   // Текст приветствия на главной
  welcomeSubtitle String?   // Подзаголовок
  mainButtonText  String?   // Текст на кнопке записи (по умолч.: "Записаться")

  // Системное
  showPoweredBy   Boolean   @default(true)   // false для PRO

  updatedAt       DateTime  @updatedAt
}
```

### 4.9 Таблица: notification_queue (очередь уведомлений)

```prisma
model NotificationQueue {
  id              String    @id @default(cuid())
  masterId        String
  master          Master    @relation(fields: [masterId], references: [id])
  bookingId       String?
  booking         Booking?  @relation(fields: [bookingId], references: [id])

  recipientId     BigInt                    // telegram_id получателя
  type            NotifType
  scheduledAt     DateTime                  // Когда отправить
  sentAt          DateTime?                 // Когда отправлено
  status          String    @default("pending") // pending|sent|failed
  payload         Json                      // Данные для шаблона сообщения
  attempts        Int       @default(0)

  createdAt       DateTime  @default(now())
}

enum NotifType {
  BOOKING_CONFIRMED      // Сразу при записи (клиенту + мастеру)
  REMINDER_24H           // За 24 часа до записи
  REMINDER_2H            // За 2 часа до записи
  BOOKING_CANCELLED      // При отмене
  REVIEW_REQUEST         // Через 2 часа после окончания
  SUBSCRIPTION_EXPIRING  // За 3 дня до конца подписки
  SUBSCRIPTION_EXPIRED   // При истечении
}
```

### 4.10 Таблица: reviews (отзывы)

```prisma
model Review {
  id          String    @id @default(cuid())
  masterId    String
  master      Master    @relation(fields: [masterId], references: [id])
  serviceId   String?
  service     Service?  @relation(fields: [serviceId], references: [id])
  bookingId   String?   @unique
  booking     Booking?  @relation(fields: [bookingId], references: [id])

  clientName  String
  text        String
  rating      Int                           // 1-5
  date        DateTime  @default(now())
  isVisible   Boolean   @default(true)

  createdAt   DateTime  @default(now())
}
```

### 4.11 Таблица: payments (история платежей)

```prisma
// Каждая попытка списания — отдельная запись.
// При авторекарринге каждый месяц создаётся новый Payment.
// Subscription.yookassaPaymentMethodId используется для повторных списаний.
model Payment {
  id              String    @id @default(cuid())
  masterId        String
  master          Master    @relation(fields: [masterId], references: [id])
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])

  provider        String                    // "yookassa" | "telegram"
  externalId      String    @unique         // ID платежа в системе провайдера
  amount          Int                       // Сумма в рублях
  currency        String    @default("RUB")
  status          PaymentStatus @default(PENDING)

  // Для первого платежа YooKassa возвращает payment.payment_method.id
  // Он сохраняется в Subscription.yookassaPaymentMethodId
  // Здесь фиксируем был ли это первый (инициирующий) платёж
  isInitialPayment Boolean  @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum PaymentStatus {
  PENDING     // Ожидает подтверждения от провайдера
  SUCCEEDED   // Успешно списано
  CANCELLED   // Отменён / возврат
  FAILED      // Ошибка списания (недостаточно средств и т.д.)
}
```

**Жизненный цикл авторекарринга:**
```
1. Первый платёж:
   POST /master/subscription/pay → создаём Payment(isInitialPayment=true, status=PENDING)
   → редиректим мастера на страницу YooKassa
   → YooKassa webhook: payment.succeeded + payment.payment_method.id
   → обновить Payment.status = SUCCEEDED
   → сохранить Subscription.yookassaPaymentMethodId = payment.payment_method.id
   → Subscription.status = ACTIVE, currentPeriodEnd = now() + 30 days

2. Автосписание (каждый месяц, при наличии yookassaPaymentMethodId):
   Cron 00:01: найти ACTIVE подписки, у которых currentPeriodEnd - 3 дня = сегодня
   → вызвать YooKassa API: создать платёж с payment_method_id (без редиректа)
   → создать Payment(status=PENDING)
   → YooKassa webhook: succeeded → Payment.status=SUCCEEDED, продлить period
   → YooKassa webhook: failed → Payment.status=FAILED, уведомить мастера

3. Отмена подписки:
   POST /master/subscription/cancel
   → Subscription.yookassaPaymentMethodId = null (больше нет авторекарринга)
   → Subscription.cancelledAt = now()
   → Подписка активна до currentPeriodEnd, потом уходит в GRACE → EXPIRED
```

---

## 5. API — ПОЛНАЯ КАРТА ЭНДПОИНТОВ

### 5.1 Публичное API (Mini App, без авторизации)

```
GET  /api/v1/m/:slug                    → Профиль мастера + тема + статус подписки
GET  /api/v1/m/:slug/services           → Список активных услуг
GET  /api/v1/m/:slug/services/:id       → Детали услуги с отзывами
GET  /api/v1/m/:slug/slots              → Доступные слоты (?date=YYYY-MM-DD&service_id=X)
```

**Важно:** Если `subscription.status = EXPIRED`, GET /m/:slug возвращает флаг `isDisabled: true`. Mini App показывает экран "Запись временно недоступна".

### 5.2 API для клиентов (initData Telegram)

```
POST   /api/v1/client/:masterSlug/bookings     → Создать запись
GET    /api/v1/client/:masterSlug/bookings     → Мои записи у данного мастера
DELETE /api/v1/client/:masterSlug/bookings/:id → Отменить запись (клиент)
```

**Аутентификация:** Заголовок `X-Telegram-Init-Data: <raw initData string>`.
Сервер находит мастера по `:masterSlug` → загружает его `botToken` → верифицирует HMAC-подпись initData с этим токеном.

**Почему `:masterSlug` в URL (не в теле):**
- GET-запросы не имеют тела по стандарту — без slug сервер не знает, чьи записи вернуть
- DELETE без контекста мастера позволял бы отменять чужие записи через перебор ID
- `:masterSlug` делает роутинг явным и позволяет правильно найти botToken для верификации initData

### 5.3 API кабинета мастера (JWT)

```
// Авторизация
POST  /api/v1/master/auth/telegram      → Telegram Login Widget → JWT
POST  /api/v1/master/auth/refresh       → Обновить JWT

// Профиль
GET   /api/v1/master/profile            → Данные профиля
PUT   /api/v1/master/profile            → Обновить профиль

// Бот
POST  /api/v1/master/bot/connect        → Подключить токен бота
DELETE /api/v1/master/bot               → Отключить бота
GET   /api/v1/master/bot/status         → Статус webhook

// Услуги
GET   /api/v1/master/services           → Все услуги (включая неактивные)
POST  /api/v1/master/services           → Добавить услугу (проверка лимита 5)
PUT   /api/v1/master/services/:id       → Редактировать
PATCH /api/v1/master/services/:id/toggle → Скрыть/показать
DELETE /api/v1/master/services/:id      → Удалить
PATCH /api/v1/master/services/reorder  → Изменить порядок

// Расписание
GET   /api/v1/master/schedule           → Базовое расписание
PUT   /api/v1/master/schedule           → Обновить расписание
GET   /api/v1/master/schedule/exceptions → Исключения
POST  /api/v1/master/schedule/exceptions → Добавить исключение (выходной / изм. часы)
DELETE /api/v1/master/schedule/exceptions/:id → Удалить исключение

// Записи
GET   /api/v1/master/bookings           → Все записи (?status=confirmed&from=&to=)
GET   /api/v1/master/bookings/today     → Записи на сегодня
PATCH /api/v1/master/bookings/:id/cancel → Отменить (мастер)
PATCH /api/v1/master/bookings/:id/complete → Отметить выполненной
PATCH /api/v1/master/bookings/:id/noshow → Отметить no-show

// Клиенты
GET   /api/v1/master/clients            → База клиентов
GET   /api/v1/master/clients/:id        → Карточка клиента + история записей

// Аналитика (только PRO)
GET   /api/v1/master/analytics/summary  → Записи, выручка, клиенты за период
GET   /api/v1/master/analytics/services → ТОП услуг по записям/выручке
GET   /api/v1/master/analytics/clients  → Новые vs повторные клиенты

// Тема (только PRO)
GET   /api/v1/master/theme              → Текущая тема
PUT   /api/v1/master/theme              → Обновить тему

// Подписка
GET   /api/v1/master/subscription       → Статус подписки
POST  /api/v1/master/subscription/pay   → Создать платёж YooKassa → redirect URL
POST  /api/v1/master/subscription/cancel → Отменить автопродление
```

### 5.4 Webhooks

```
POST /webhooks/telegram/:masterId       → Входящие сообщения от бота мастера
POST /webhooks/yookassa                 → Уведомления об оплате от YooKassa
```

---

## 6. БИЗНЕС-ЛОГИКА

### 6.1 Расчёт свободных слотов

```
Функция getAvailableSlots(masterId, date, serviceId):

1. Загрузить schedule мастера
2. Проверить: date входит в workDays? → если нет → вернуть []
3. Проверить schedule_exceptions для этой даты:
   - type=day_off → вернуть []
   - type=modified → использовать customStart/customEnd
4. Сгенерировать все слоты от workStart до (workEnd - durationMin услуги)
   с шагом slotDurationMin, добавить breakBetweenMin
5. Загрузить все CONFIRMED записи мастера на эту дату
6. Для каждого слота: проверить пересечение с существующими записями
7. Вернуть только свободные слоты, сгруппированные по утро/день/вечер
```

### 6.2 Создание записи (транзакция + защита от race condition)

```
Функция createBooking(masterSlug, data, initData):

1. Загрузить мастера по masterSlug → получить masterId и botToken
2. Верифицировать initData с botToken мастера → получить telegramId клиента
   └─ Если верификация провалилась → 401
3. Проверить subscription мастера → если status=EXPIRED → 403
4. Загрузить услугу (serviceId из data) → проверить isActive и masterId совпадает
   └─ Если услуга не найдена или не принадлежит мастеру → 404
5. Первичная проверка слота (быстрая, без lock):
   └─ Вызвать getAvailableSlots() → если запрошенный слот отсутствует → 409

6. ЗАЩИТА ОТ RACE CONDITION — PostgreSQL Advisory Lock:
   └─ Получить числовой lock-ключ: hashids(masterId + date + timeStart)
   └─ Выполнить: SELECT pg_advisory_xact_lock($lockKey)
      → Запрос БЛОКИРУЕТСЯ, пока другой поток держит lock на тот же слот
      → Lock автоматически снимается при конце транзакции

7. Начать транзакцию (внутри advisory lock):
   a. ПОВТОРНАЯ проверка слота с SELECT FOR UPDATE на bookings:
      SELECT * FROM bookings
      WHERE masterId = ? AND date = ? AND status = 'CONFIRMED'
      FOR UPDATE
      → Если слот уже занят (параллельный запрос успел) → ROLLBACK → 409
   b. Создать/обновить запись в таблице clients (upsert по masterId+telegramId)
   c. Создать booking со статусом CONFIRMED
   d. client.bookingsCount += 1
   e. client.lastBookingAt = now()
   └─ COMMIT

8. Поставить в очередь уведомления (после успешного коммита):
   - BOOKING_CONFIRMED → клиенту и мастеру (delay: 0, немедленно)
   - REMINDER_24H  → scheduledAt = date + timeStart - 24h
     (если date + timeStart - 24h < now() → пропустить, слишком поздно)
   - REMINDER_2H   → scheduledAt = date + timeStart - 2h
     (если date + timeStart - 2h < now() → пропустить)
   - REVIEW_REQUEST → scheduledAt = date + timeEnd + 2h

9. Вернуть booking с деталями (201 Created)
```

**Примечание по totalSpent:**
`client.totalSpent` НЕ обновляется при создании записи.
Обновляется только при `PATCH /bookings/:id/complete` → `totalSpent += booking.priceSnapshot`.

### 6.3 Лимит услуг (Free план)

```
Функция checkServiceLimit(masterId):

1. Получить subscription.plan
2. Если plan=FREE:
   a. Подсчитать активные услуги мастера (isActive=true)
   b. Если count >= 5 → вернуть ошибку 403 с кодом LIMIT_REACHED
      и сообщением "Бесплатный план позволяет до 5 услуг"
3. Если plan=PRO → разрешить
```

### 6.4 Жизненный цикл подписки

```
Состояния:
TRIAL (14 дней) → платит → ACTIVE → не платит → GRACE (3 дня) → EXPIRED

При EXPIRED:
- Флаг isDisabled=true возвращается в /m/:slug
- Mini App блокирует новые записи (экран "Недоступно")
- Существующие данные сохранены (ничего не удаляем)
- Бот мастера всё ещё работает для уже созданных записей

Ежедневный cron (00:01) — ПОРЯДОК ШАГОВ ВАЖЕН:

Шаг A. Авторекарринг (инициировать списание заблаговременно):
  → Найти подписки: status=ACTIVE И yookassaPaymentMethodId IS NOT NULL
    И currentPeriodEnd BETWEEN now() AND now() + 3 days
  → Для каждой: создать YooKassa-платёж через API (payment_method_id, без редиректа)
  → Создать Payment(status=PENDING, isInitialPayment=false)
  → (Результат придёт через webhook /webhooks/yookassa)

Шаг B. Предупреждение об истечении (за 3 дня, если нет авторекарринга):
  → Найти подписки: status=ACTIVE И yookassaPaymentMethodId IS NULL
    И currentPeriodEnd BETWEEN now() AND now() + 3 days
  → Отправить мастеру уведомление SUBSCRIPTION_EXPIRING
    (тип "За 3 дня до конца — пора продлить вручную")

Шаг C. Перевод истёкших в GRACE:
  → Найти подписки: currentPeriodEnd < now() И status=ACTIVE
  → Перевести в GRACE, установить gracePeriodEndsAt = now() + 3 days
  → Отправить мастеру уведомление SUBSCRIPTION_EXPIRED

Шаг D. Перевод GRACE в EXPIRED:
  → Найти подписки: gracePeriodEndsAt < now() И status=GRACE
  → Перевести в EXPIRED

// ВАЖНО: шаг C не затронет подписки из шага A, где платёж уже инициирован,
// т.к. при успешном webhook от YooKassa currentPeriodEnd уже продлится до webhook-а.
// Но если webhook не пришёл до 00:01 следующего дня после истечения — подписка уйдёт в GRACE.
// Это нормальное поведение: мастер получит уведомление, YooKassa retry придёт позже.
```

### 6.5 Подключение бота мастера (Multi-bot manager)

```
Функция connectBot(masterId, token):

1. Запросить getMe от Telegram API с этим токеном
   → Если ошибка → 400 "Неверный токен"
2. Если botUsername уже занят другим мастером → 409
3. Сгенерировать webhookSecret = crypto.randomBytes(32).toString('hex')
4. Зарегистрировать webhook:
   POST https://api.telegram.org/bot{token}/setWebhook
   {
     url: "https://platform.ru/webhooks/telegram/{masterId}",
     secret_token: webhookSecret   // ← Telegram будет добавлять этот заголовок к каждому апдейту
   }
5. Зашифровать botToken перед сохранением:
   encryptedToken = AES256.encrypt(token, process.env.BOT_TOKEN_ENCRYPTION_KEY)
6. Сохранить в БД: botToken=encryptedToken, botUsername, botWebhookActive=true,
   botWebhookSecret=webhookSecret
7. Отправить мастеру приветственное сообщение через бота

Функция handleIncomingUpdate(masterId, update, req):
1. Загрузить мастера из БД → получить botWebhookSecret и зашифрованный botToken
2. Верифицировать заголовок запроса:
   req.headers['x-telegram-bot-api-secret-token'] === botWebhookSecret
   → Если не совпадает → 403 (отбросить, это не Telegram)
3. Расшифровать botToken: AES256.decrypt(encryptedToken, BOT_TOKEN_ENCRYPTION_KEY)
4. Передать update в Telegraf с расшифрованным токеном
5. Обработать команды: /start, /bookings, /cancel

// БЕЗОПАСНОСТЬ:
// - BOT_TOKEN_ENCRYPTION_KEY хранится только в .env (никогда в БД или логах)
// - Если ключ скомпрометирован — меняем ключ и переподключаем ботов (re-encrypt)
// - webhookSecret защищает от фейковых POST-запросов на /webhooks/telegram/:masterId
```

---

## 7. TELEGRAM BOT — СЦЕНАРИИ

### 7.1 /start для клиента (бот мастера)

```
Клиент пишет /start → бот отвечает:

Сообщение:
  "Привет! 👋 Я бот студии [name].
   Здесь вы можете записаться на процедуры и узнать о нашем меню."

Кнопки (InlineKeyboard):
  [📅 Записаться] → открывает Mini App (WebApp button)
  [📞 Написать мастеру] → ссылка t.me/{masterUsername}
```

### 7.2 Подтверждение записи (клиенту)

```
"✅ Запись подтверждена!

📋 [Название услуги]
📅 [День недели], [дата]
🕐 [время_начала] — [время_конца]
💰 [цена] ₽

Если нужно отменить — напишите за 2 часа.
До встречи! 💅"
```

### 7.3 Уведомление мастеру о новой записи

```
"🔔 Новая запись!

👤 [Имя клиента] ([телефон])
📋 [Услуга]
📅 [Дата], [время]
💬 Комментарий: [или "нет"]"

Кнопки:
  [❌ Отменить запись]  ← inline button с callback
```

### 7.4 Команда /bookings для мастера

```
Показывает записи на сегодня и завтра:
"📅 Записи на сегодня:

1. 10:00 — Маша К. | Маникюр + гель-лак
2. 13:00 — Ира Смирнова | Педикюр

📅 Завтра:
1. 11:00 — Катя Л. | Брови"
```

---

## 8. ДЕПЛОЙ НА BEGET VPS

### 8.1 docker-compose.yml

```yaml
version: '3.9'

services:
  api:
    build: .
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: beauty_platform
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 8.2 Переменные окружения (.env)

```bash
# Сервер
NODE_ENV=production
PORT=3000
BASE_URL=https://platform.ru

# База данных
DATABASE_URL=postgresql://user:pass@postgres:5432/beauty_platform

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=<длинная_случайная_строка>
JWT_EXPIRES_IN=7d

# YooKassa
YOOKASSA_SHOP_ID=<ваш_shop_id>
YOOKASSA_SECRET_KEY=<ваш_ключ>

# Telegram (платформенный бот для онбординга мастеров)
PLATFORM_BOT_TOKEN=<токен_бота_платформы>

# Шифрование токенов ботов мастеров (AES-256)
# Генерировать: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BOT_TOKEN_ENCRYPTION_KEY=<64-символьная_hex-строка>

# Подписка
SUBSCRIPTION_PRICE_RUB=500
TRIAL_DAYS=14
GRACE_PERIOD_DAYS=3
FREE_SERVICES_LIMIT=5
```

### 8.3 Nginx (nginx.conf)

```nginx
server {
    listen 443 ssl;
    server_name platform.ru;

    ssl_certificate /etc/letsencrypt/live/platform.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/platform.ru/privkey.pem;

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Telegram webhooks
    location /webhooks/ {
        proxy_pass http://localhost:3000;
    }

    # Mini App (статика)
    location / {
        root /var/www/platform;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 9. КТО ЧТО ВИДИТ И РЕДАКТИРУЕТ

| Действие | Клиент | Мастер | Платформа (admin) |
|---|---|---|---|
| Просмотр каталога услуг | ✅ | ✅ | — |
| Создание записи | ✅ | — | — |
| Отмена своей записи | ✅ | — | — |
| Просмотр своих записей | ✅ (через бота/Mini App) | — | — |
| Управление услугами | — | ✅ | ✅ |
| Просмотр всех записей | — | ✅ | ✅ |
| Отмена любой записи | — | ✅ | ✅ |
| Настройка расписания | — | ✅ | — |
| Подключение бота | — | ✅ | — |
| Управление темой | — | ✅ (PRO) | — |
| Просмотр аналитики | — | ✅ (PRO) | — |
| Просмотр базы клиентов | — | ✅ | ✅ |
| Управление подпиской | — | ✅ | ✅ |
| Блокировка мастера | — | — | ✅ |

**Данные, которые клиент никогда не видит:**
- Данные других клиентов
- Финансовую аналитику мастера
- Токен бота мастера
- Данные других мастеров

---

## 10. ФАЗЫ РАЗРАБОТКИ

### Фаза 1 — Ядро (запускаем первого мастера)
- [ ] Инфраструктура: VPS, Docker, Nginx, SSL (локально через ngrok ✅)
- [x] Supabase как БД (вместо Prisma + PostgreSQL)
- [x] Регистрация мастера (POST /api/v1/master/register)
- [x] Подключение бота мастера (токен → webhook)
- [x] Публичное API: /m/:slug, /services, /services/:id
- [ ] Клиентское API: создание записи с верификацией initData
- [ ] Уведомления: подтверждение записи клиенту и мастеру
- [ ] Лимит 5 услуг для free плана

### Фаза 2 — Кабинет мастера
- [ ] JWT аутентификация через Telegram Login Widget (сейчас: X-Master-Secret)
- [ ] CRUD услуг через API
- [ ] Управление расписанием + исключения
- [ ] Просмотр записей и управление ими
- [ ] Напоминания: BullMQ jobs (24h, 2h, запрос отзыва)

### Фаза 3 — Монетизация
- [ ] Создание платежа в YooKassa
- [ ] Webhook YooKassa → активация подписки
- [ ] Cron: проверка истёкших подписок
- [ ] Блокировка mini app при EXPIRED
- [ ] Уведомления мастеру об истечении

### Фаза 4 — PRO функции
- [ ] Управление темой (цвета, логотип, тексты)
- [ ] API аналитики (записи, выручка, клиенты)
- [ ] Telegram Payments как альтернатива YooKassa
- [ ] Веб-кабинет (SPA на отдельном поддомене)

---

## 11. КРИТИЧЕСКИЕ РЕШЕНИЯ (НЕ МЕНЯТЬ БЕЗ АНАЛИЗА)

1. **Каждый бот мастера = отдельный webhook** на URL `/webhooks/telegram/:masterId`. Не используем polling — только webhooks. Это позволяет обрабатывать N ботов в одном процессе.

2. **initData верифицируется с токеном конкретного мастера**, не платформенным токеном. Клиентский API включает `:masterSlug` в URL → сервер находит мастера → расшифровывает botToken → верифицирует подпись.

3. **Слоты пересчитываются на сервере при создании записи** — никогда не доверяем тому, что пришло с фронтенда.
   **Race condition защита — два уровня:**
   - PostgreSQL Advisory Lock на (masterId + date + timeStart) → сериализует параллельные запросы на один слот
   - SELECT FOR UPDATE внутри транзакции → повторная проверка после получения lock

4. **Цена и длительность копируются в booking в момент записи** (`priceSnapshot`). Если мастер изменит цену — старые записи не ломаются.

5. **Данные мастера не удаляются при EXPIRED** — только блокируется создание новых записей. Реактивация подписки = немедленное восстановление.

6. **URL структура Mini App**: `https://platform.ru/{master_slug}` — фронтенд читает slug из URL и делает запрос к `/api/v1/m/{slug}`. Один deploy фронтенда — много мастеров.

7. **Токены ботов мастеров хранятся зашифрованными** (AES-256) в БД. Расшифровка только в памяти процесса при обработке запроса. Ключ шифрования — только в `.env`.

8. **Telegram webhook защищён `secret_token`** — при регистрации setWebhook передаётся случайный токен, который Telegram добавляет заголовком `X-Telegram-Bot-Api-Secret-Token`. Любой запрос без правильного заголовка отклоняется с 403 до обработки.

9. **История платежей** хранится в отдельной таблице `Payment`. `Subscription` содержит только текущее состояние + `yookassaPaymentMethodId` для авторекарринга. Никогда не перезаписываем платёжную историю.

10. **Денормализованные счётчики клиента** обновляются по строгим правилам:
    - `bookingsCount`: +1 при CONFIRMED, -1 при CANCELLED (любом)
    - `totalSpent`: +priceSnapshot ТОЛЬКО при переводе в COMPLETED
    - Все обновления счётчиков — в той же транзакции, что и изменение статуса записи

---

*BACKEND-PLAN.md составлен на основе research.md, ответов на вопросы и анализа MVP.*
*Обновлено март 2026: добавлен раздел текущего состояния реализации.*
*Следующий шаг: завершить Фазу 1 — Client API с созданием записи и верификацией initData.*
