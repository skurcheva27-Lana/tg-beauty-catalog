const { supabase } = require('../../db')
const crypto = require('crypto')
const log = require('../../logger')

// Генерация случайного секретного токена для мастера
function generateSecret() {
  return crypto.randomBytes(32).toString('hex')
}

async function masterAuthRoutes(fastify) {

  // POST /api/v1/master/register
  // Регистрация нового мастера
  // Тело: { telegram_id, name, master_name, slug }
  // Возвращает: { master_id, master_secret } — secret показывается ОДИН раз, сохрани его!
  fastify.post('/api/v1/master/register', async (request, reply) => {
    const { telegram_id, name, master_name, slug } = request.body

    if (!telegram_id || !name || !master_name || !slug) {
      return reply.status(400).send({
        error: 'Обязательные поля: telegram_id, name, master_name, slug'
      })
    }

    // Проверяем что slug свободен (только буквы, цифры, дефис)
    const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    const { data: existing } = await supabase
      .from('masters')
      .select('id')
      .eq('slug', slugClean)
      .single()

    if (existing) {
      return reply.status(409).send({ error: `Адрес "${slugClean}" уже занят` })
    }

    // Проверяем что telegram_id не занят
    const { data: existingTg } = await supabase
      .from('masters')
      .select('id')
      .eq('telegram_id', telegram_id)
      .single()

    if (existingTg) {
      return reply.status(409).send({ error: 'Этот Telegram аккаунт уже зарегистрирован' })
    }

    const masterSecret = generateSecret()

    // Создаём мастера
    const { data: master, error } = await supabase
      .from('masters')
      .insert({
        telegram_id: String(telegram_id),
        name,
        master_name,
        slug: slugClean,
        master_secret: masterSecret
      })
      .select('id, slug')
      .single()

    if (error) {
      log.error('auth/register', 'Ошибка создания аккаунта', { error: error.message, telegram_id, slug: slugClean })
      return reply.status(500).send({ error: 'Ошибка создания аккаунта' })
    }

    // Создаём подписку (TRIAL на 14 дней)
    await supabase.from('subscriptions').insert({
      master_id: master.id,
      plan: 'FREE',
      status: 'TRIAL'
    })

    // Создаём расписание по умолчанию
    await supabase.from('schedule').insert({
      master_id: master.id,
      work_days: [1, 2, 3, 4, 5, 6],
      work_start: '09:00',
      work_end: '20:00'
    })

    // Создаём тему по умолчанию
    await supabase.from('themes').insert({
      master_id: master.id
    })

    return reply.status(201).send({
      message: 'Аккаунт создан!',
      master_id: master.id,
      slug: master.slug,
      app_url: `${process.env.BASE_URL}/${master.slug}`,
      master_secret: masterSecret,
      warning: 'Сохрани master_secret — он больше не будет показан!'
    })
  })

  // GET /api/v1/master/profile
  // Получить данные своего профиля
  // Заголовок: X-Master-Secret: <твой секрет>
  fastify.get('/api/v1/master/profile', async (request, reply) => {
    const master = await getMasterFromSecret(request, reply)
    if (!master) return

    return {
      id: master.id,
      name: master.name,
      masterName: master.master_name,
      bio: master.bio,
      avatarUrl: master.avatar_url,
      slug: master.slug,
      botUsername: master.bot_username,
      botConnected: master.bot_webhook_active,
      rating: master.rating,
      reviewsCount: master.reviews_count
    }
  })
}

// Вспомогательная функция: найти мастера по секрету из заголовка
async function getMasterFromSecret(request, reply) {
  const secret = request.headers['x-master-secret']

  if (!secret) {
    reply.status(401).send({ error: 'Требуется X-Master-Secret заголовок' })
    return null
  }

  const { data: master, error } = await supabase
    .from('masters')
    .select('*')
    .eq('master_secret', secret)
    .eq('is_active', true)
    .single()

  if (error || !master) {
    reply.status(401).send({ error: 'Неверный токен' })
    return null
  }

  return master
}

module.exports = masterAuthRoutes
module.exports.getMasterFromSecret = getMasterFromSecret
