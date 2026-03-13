# DEPLOYMENT.md — Как задеплоить проект

> Проект состоит из двух частей:
> - **Frontend** (`tg-app/`) — статический сайт, деплоится на **Vercel**
> - **Backend** (`backend/`) — Node.js сервер, запускается локально и пробрасывается через **ngrok**
>
> База данных живёт в **Supabase** (облако, настройка уже сделана).

---

## Что понадобится (один раз)

Установить на компьютер:

1. **Node.js 20** — https://nodejs.org (скачать LTS-версию)
2. **Vercel CLI** — для деплоя фронтенда:
   ```bash
   npm install -g vercel
   ```
3. **ngrok** — для проброса бэкенда в интернет:
   - Зарегистрироваться на https://ngrok.com (бесплатно)
   - Скачать и установить ngrok: https://ngrok.com/download
   - Авторизоваться (команду скопировать из личного кабинета ngrok):
     ```bash
     ngrok config add-authtoken <твой_токен>
     ```

---

## Часть 1. Деплой фронтенда (Vercel)

Фронтенд деплоится один раз, после этого живёт сам по себе 24/7.

```bash
# 1. Перейти в папку фронтенда
cd /Users/svetlanakurcheva/Documents/Projecs/tg-beauty-catalog/tg-app

# 2. Задеплоить в production
vercel --prod
```

При первом запуске Vercel спросит:
- **Log in** → войти через GitHub
- **Set up project** → Yes
- **Project name** → оставить как есть или ввести своё
- **Root directory** → оставить `.`

После деплоя Vercel выдаст URL вида `https://tg-beauty-xxx.vercel.app` — это и есть публичный адрес Mini App.

### Обновить фронтенд после изменений

```bash
cd tg-app
# Если менял app.css или app.js — увеличить версию в index.html:
# <link rel="stylesheet" href="css/app.css?v=5">  →  v=6
# <script src="js/app.js?v=5"></script>  →  v=6

vercel --prod
```

---

## Часть 2. Запуск бэкенда (локально + ngrok)

### Шаг 1. Установить зависимости

```bash
cd /Users/svetlanakurcheva/Documents/Projecs/tg-beauty-catalog/backend
npm install
```

### Шаг 2. Проверить файл `.env`

Файл `.env` уже есть в папке `backend/`. Убедиться, что там правильные значения:

```bash
# Содержимое backend/.env:

SUPABASE_URL=https://<твой-проект>.supabase.co
SUPABASE_SECRET_KEY=<service_role_key из Supabase Dashboard → Settings → API>
DATABASE_URL=postgresql://...
PORT=3000
BASE_URL=https://leopoldo-beautiful-nonfestively.ngrok-free.app
```

> **BASE_URL** — это адрес твоего ngrok-домена. Именно на него Telegram будет слать webhook'и от ботов.
> Статический ngrok-домен не меняется при перезапуске — его нужно настроить один раз (см. ниже).

### Шаг 3. Получить статический ngrok-домен (один раз)

1. Войти в личный кабинет ngrok: https://dashboard.ngrok.com
2. Перейти в раздел **Cloud Edge → Domains**
3. Нажать **+ New Domain** — ngrok выдаст бесплатный статический домен вида `leopoldo-beautiful-nonfestively.ngrok-free.app`
4. Скопировать этот домен в `BASE_URL` в файле `.env` (с `https://` в начале)

### Шаг 4. Запустить сервер и ngrok

Открыть **два терминала**:

**Терминал 1 — запустить бэкенд:**
```bash
cd /Users/svetlanakurcheva/Documents/Projecs/tg-beauty-catalog/backend
node src/server.js
```

Успешный запуск выглядит так:
```
[2026-03-13 12:00:01] [INFO ] [server] Сервер запущен: http://localhost:3000
[2026-03-13 12:00:01] [INFO ] [server] Проверка: http://localhost:3000/health
[2026-03-13 12:00:01] [INFO ] [BotManager] Загружено ботов: 1
```

**Терминал 2 — запустить ngrok (подставить свой домен):**
```bash
ngrok http --domain=leopoldo-beautiful-nonfestively.ngrok-free.app 3000
```

Теперь запросы на `https://leopoldo-beautiful-nonfestively.ngrok-free.app` будут приходить на локальный сервер на порту 3000.

### Шаг 5. Проверить, что всё работает

Открыть в браузере:
```
https://leopoldo-beautiful-nonfestively.ngrok-free.app/health
```

Должен вернуться ответ:
```json
{ "status": "ok", "message": "Сервер работает!", "time": "..." }
```

---

## Часть 3. Подключить бота мастера

Бот подключается через API один раз. После этого сервер сам загрузит его при следующем запуске.

### Шаг 1. Зарегистрировать мастера

```bash
curl -X POST https://leopoldo-beautiful-nonfestively.ngrok-free.app/api/v1/master/register \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": "123456789",
    "name": "Студия Ани",
    "master_name": "Анна Смирнова",
    "slug": "ani-beauty"
  }'
```

Ответ содержит `master_secret` — сохрани его, он показывается только один раз!

```json
{
  "master_id": "...",
  "master_secret": "abc123...",
  "app_url": "https://.../ani-beauty",
  "warning": "Сохрани master_secret — он больше не будет показан!"
}
```

### Шаг 2. Создать бота в Telegram

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Придумать имя и username бота
4. BotFather выдаст токен вида `1234567890:AAF...` — сохранить его

### Шаг 3. Подключить бота к аккаунту мастера

```bash
curl -X POST https://leopoldo-beautiful-nonfestively.ngrok-free.app/api/v1/master/bot/connect \
  -H "Content-Type: application/json" \
  -H "X-Master-Secret: <master_secret из шага 1>" \
  -d '{"bot_token": "<токен от BotFather>"}'
```

Успешный ответ:
```json
{
  "message": "Бот успешно подключён!",
  "bot_username": "anuyta_beauty_bot",
  "webhook_url": "https://.../webhooks/telegram/...",
  "app_url": "https://.../ani-beauty"
}
```

После этого в Telegram придёт сообщение от бота с подтверждением.

---

## Как перезапустить бэкенд

При перезапуске компьютера или после остановки сервера нужно заново запустить два терминала:

```bash
# Терминал 1
cd backend && node src/server.js

# Терминал 2
ngrok http --domain=leopoldo-beautiful-nonfestively.ngrok-free.app 3000
```

Боты загрузятся автоматически из базы данных (строчка `[BotManager] Загружено ботов: N`).

> **Важно:** пока сервер не запущен — боты не отвечают. Это текущее ограничение локального деплоя.
> Для настоящего 24/7 без присмотра — следующий шаг это деплой на VPS (см. BACKEND-PLAN.md, раздел 8).

---

## Логи (для диагностики ошибок)

Все события и ошибки бэкенда пишутся в папку `logs/` (создаётся автоматически):

| Файл | Содержимое |
|------|------------|
| `logs/app.log` | Все события: INFO, WARN, ERROR |
| `logs/errors.log` | Только ошибки (ERROR) — для быстрого поиска |

Формат строки:
```
[2026-03-13 12:00:00] [ERROR] [auth/register] Ошибка создания аккаунта | {"telegram_id":"123","slug":"anna"}
```

Читать последние ошибки:
```bash
tail -n 50 /Users/svetlanakurcheva/Documents/Projecs/tg-beauty-catalog/logs/errors.log
```

Смотреть лог в реальном времени:
```bash
tail -f /Users/svetlanakurcheva/Documents/Projecs/tg-beauty-catalog/logs/app.log
```

> Лог-файлы не коммитятся в git (добавлены в `.gitignore`), папка `logs/` сохраняется через `.gitkeep`.

---

## Быстрая проверка после запуска

| Что проверить | Как |
|---|---|
| Сервер живой | `curl https://<ngrok-домен>/health` |
| База данных работает | `curl https://<ngrok-домен>/db-test` |
| Бот подключён | `curl -H "X-Master-Secret: <секрет>" https://<ngrok-домен>/api/v1/master/bot/status` |
| Mini App открывается | Открыть бота в Telegram → нажать /start |

---

## Структура проекта

```
tg-beauty-catalog/
├── tg-app/          ← фронтенд (деплой: Vercel)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── vercel.json
├── backend/         ← бэкенд (запуск: node src/server.js)
│   ├── src/
│   │   ├── server.js           ← точка входа
│   │   ├── db.js               ← подключение к Supabase
│   │   ├── logger.js           ← логирование (пишет в logs/)
│   │   ├── bot/manager.js      ← менеджер ботов мастеров
│   │   └── api/
│   │       ├── public/         ← публичное API для Mini App
│   │       ├── master/         ← API мастера (auth, bot)
│   │       └── webhooks/       ← Telegram webhooks
│   ├── .env                    ← переменные окружения (не коммитить в git!)
│   └── package.json
├── logs/            ← логи сервера (не коммитятся в git)
│   ├── app.log      ← все события
│   └── errors.log   ← только ошибки
└── DEPLOYMENT.md    ← этот файл
```
