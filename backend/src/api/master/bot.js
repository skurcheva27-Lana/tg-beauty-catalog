const { supabase } = require('../../db')
const { getMasterFromSecret } = require('./auth')
const { registerBot, setWebhook, removeWebhook } = require('../../bot/manager')
const log = require('../../logger')

async function masterBotRoutes(fastify) {

  // POST /api/v1/master/bot/connect
  // Мастер подключает своего Telegram-бота
  // Заголовок: X-Master-Secret: <секрет>
  // Тело: { bot_token: "1234567890:AAF..." }
  fastify.post('/api/v1/master/bot/connect', async (request, reply) => {
    const master = await getMasterFromSecret(request, reply)
    if (!master) return

    const { bot_token } = request.body

    if (!bot_token) {
      return reply.status(400).send({ error: 'Нужен bot_token' })
    }

    // Шаг 1: Проверяем токен у Telegram
    let botInfo
    try {
      const { Telegraf } = require('telegraf')
      const testBot = new Telegraf(bot_token)
      botInfo = await testBot.telegram.getMe()
    } catch (err) {
      return reply.status(400).send({
        error: 'Неверный токен бота. Получи его у @BotFather командой /newbot'
      })
    }

    // Шаг 2: Проверяем что этот бот не занят другим мастером
    const { data: existing } = await supabase
      .from('masters')
      .select('id')
      .eq('bot_username', botInfo.username)
      .neq('id', master.id)
      .single()

    if (existing) {
      return reply.status(409).send({
        error: `Бот @${botInfo.username} уже подключён к другому аккаунту`
      })
    }

    // Шаг 3: Регистрируем webhook у Telegram
    try {
      await setWebhook(master.id, bot_token)
    } catch (err) {
      return reply.status(500).send({
        error: 'Не удалось установить webhook. Проверь что BASE_URL в .env настроен правильно.',
        detail: err.message
      })
    }

    // Шаг 4: Регистрируем бота в памяти сервера
    registerBot(master.id, bot_token)

    // Шаг 5: Сохраняем в БД
    const { error } = await supabase
      .from('masters')
      .update({
        bot_token: bot_token,
        bot_username: botInfo.username,
        bot_webhook_active: true
      })
      .eq('id', master.id)

    if (error) {
      return reply.status(500).send({ error: 'Ошибка сохранения в базе данных' })
    }

    // Шаг 6: Отправляем приветственное сообщение мастеру через бота
    try {
      const { Telegraf } = require('telegraf')
      const bot = new Telegraf(bot_token)
      await bot.telegram.sendMessage(
        master.telegram_id.toString(),
        `✅ Бот @${botInfo.username} успешно подключён!\n\n` +
        `Теперь твои клиенты могут открыть каталог через бота.\n` +
        `Ссылка на каталог: ${process.env.BASE_URL}/${master.slug}\n\n` +
        `Попроси клиентов написать /start в боте — они увидят кнопку открытия приложения.`
      )
    } catch (err) {
      // Не критично — бот подключён, просто уведомление не отправилось
      log.warn('bot/connect', 'Не удалось отправить приветствие мастеру', { error: err.message, masterId: master.id })
    }

    return {
      message: 'Бот успешно подключён!',
      bot_username: botInfo.username,
      bot_name: botInfo.first_name,
      webhook_url: `${process.env.BASE_URL}/webhooks/telegram/${master.id}`,
      app_url: `${process.env.BASE_URL}/${master.slug}`
    }
  })

  // DELETE /api/v1/master/bot
  // Отключить бота
  fastify.delete('/api/v1/master/bot', async (request, reply) => {
    const master = await getMasterFromSecret(request, reply)
    if (!master) return

    if (!master.bot_token) {
      return reply.status(400).send({ error: 'Бот не подключён' })
    }

    try {
      await removeWebhook(master.bot_token)
    } catch (err) {
      log.warn('bot/disconnect', 'Ошибка удаления webhook', { error: err.message, masterId: master.id })
    }

    await supabase
      .from('masters')
      .update({
        bot_token: null,
        bot_username: null,
        bot_webhook_active: false
      })
      .eq('id', master.id)

    return { message: 'Бот отключён' }
  })

  // GET /api/v1/master/bot/status
  // Статус подключения бота
  fastify.get('/api/v1/master/bot/status', async (request, reply) => {
    const master = await getMasterFromSecret(request, reply)
    if (!master) return

    if (!master.bot_token) {
      return {
        connected: false,
        message: 'Бот не подключён'
      }
    }

    // Проверяем что webhook живой
    let webhookInfo = null
    try {
      const { Telegraf } = require('telegraf')
      const bot = new Telegraf(master.bot_token)
      webhookInfo = await bot.telegram.getWebhookInfo()
    } catch (err) {
      // Токен мог протухнуть
    }

    return {
      connected: master.bot_webhook_active,
      bot_username: master.bot_username,
      webhook_url: webhookInfo?.url || null,
      pending_updates: webhookInfo?.pending_update_count || 0
    }
  })
}

module.exports = masterBotRoutes
