require('dotenv').config()
const fastify = require('fastify')({ logger: true })
const log = require('./logger')
const cors = require('@fastify/cors')
const path = require('path')

const { supabase } = require('./db')
const { loadAllBots } = require('./bot/manager')

// Роуты
const catalogRoutes = require('./api/public/catalog')
const masterAuthRoutes = require('./api/master/auth')
const masterBotRoutes = require('./api/master/bot')
const telegramWebhookRoutes = require('./api/webhooks/telegram')

// CORS — разрешаем запросы с любого источника (Mini App в Telegram)
fastify.register(cors, { origin: '*' })

// Статические файлы фронтенда (css, js, index.html)
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../../tg-app'),
  prefix: '/',
  decorateReply: true
})

// Регистрируем все роуты
fastify.register(catalogRoutes)       // Публичный каталог
fastify.register(masterAuthRoutes)    // Регистрация мастера
fastify.register(masterBotRoutes)     // Подключение бота
fastify.register(telegramWebhookRoutes) // Telegram webhooks

// Проверка работоспособности сервера
fastify.get('/health', async () => {
  return { status: 'ok', message: 'Сервер работает!', time: new Date().toISOString() }
})

// Тест подключения к базе данных
fastify.get('/db-test', async (request, reply) => {
  const { data, error } = await supabase.from('masters').select('count')
  if (error) return reply.status(500).send({ error: error.message })
  return { status: 'ok', message: 'База данных подключена!', data }
})

// Mini App по slug мастера — отдаём index.html
fastify.get('/:slug', async (request, reply) => {
  return reply.sendFile('index.html')
})

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })
    log.info('server', `Сервер запущен: http://localhost:${process.env.PORT || 3000}`)
    log.info('server', `Проверка: http://localhost:${process.env.PORT || 3000}/health`)

    // Загружаем всех активных ботов из БД
    await loadAllBots()
  } catch (err) {
    log.error('server', 'Ошибка запуска сервера', { message: err.message })
    process.exit(1)
  }
}

start()
