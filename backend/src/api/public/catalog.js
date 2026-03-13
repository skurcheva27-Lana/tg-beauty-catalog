const { supabase } = require('../../db')

async function catalogRoutes(fastify) {

  // GET /api/v1/m/:slug
  // Профиль мастера + тема + статус подписки
  // Mini App вызывает это первым при открытии
  fastify.get('/api/v1/m/:slug', async (request, reply) => {
    const { slug } = request.params

    // Загружаем мастера
    const { data: master, error } = await supabase
      .from('masters')
      .select('id, name, master_name, bio, avatar_url, rating, reviews_count, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !master) {
      return reply.status(404).send({ error: 'Мастер не найден' })
    }

    // Загружаем подписку
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('master_id', master.id)
      .single()

    // Загружаем тему (только для PRO)
    const { data: theme } = await supabase
      .from('themes')
      .select('*')
      .eq('master_id', master.id)
      .single()

    const isDisabled = sub?.status === 'EXPIRED'

    return {
      id: master.id,
      name: master.name,
      masterName: master.master_name,
      bio: master.bio,
      avatarUrl: master.avatar_url,
      rating: master.rating,
      reviewsCount: master.reviews_count,
      slug: master.slug,
      isDisabled,
      plan: sub?.plan || 'FREE',
      theme: theme || null
    }
  })

  // GET /api/v1/m/:slug/services
  // Список активных услуг мастера
  fastify.get('/api/v1/m/:slug/services', async (request, reply) => {
    const { slug } = request.params

    const { data: master } = await supabase
      .from('masters')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!master) {
      return reply.status(404).send({ error: 'Мастер не найден' })
    }

    const { data: services, error } = await supabase
      .from('services')
      .select('id, category, name, short_desc, duration_min, price, emoji, gradient, photos')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return reply.status(500).send({ error: 'Ошибка загрузки услуг' })
    }

    return { services: services || [] }
  })

  // GET /api/v1/m/:slug/services/:id
  // Детали одной услуги с отзывами
  fastify.get('/api/v1/m/:slug/services/:id', async (request, reply) => {
    const { slug, id } = request.params

    const { data: master } = await supabase
      .from('masters')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!master) {
      return reply.status(404).send({ error: 'Мастер не найден' })
    }

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('master_id', master.id)
      .eq('is_active', true)
      .single()

    if (error || !service) {
      return reply.status(404).send({ error: 'Услуга не найдена' })
    }

    // Отзывы для этой услуги
    const { data: reviews } = await supabase
      .from('reviews')
      .select('client_name, text, rating, created_at')
      .eq('service_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(10)

    return { ...service, reviews: reviews || [] }
  })
}

module.exports = catalogRoutes
