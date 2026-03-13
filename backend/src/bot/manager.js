const { Telegraf } = require('telegraf')
const { supabase } = require('../db')
const log = require('../logger')

// Хранилище активных ботов в памяти: masterId -> экземпляр Telegraf
const activeBots = new Map()

// Создаём бота и навешиваем обработчики команд
function createBot(masterId, botToken) {
  const bot = new Telegraf(botToken)

  // Команда /start — клиент открывает бота мастера
  bot.start(async (ctx) => {
    try {
      const { data: master } = await supabase
        .from('masters')
        .select('name, slug')
        .eq('id', masterId)
        .single()

      if (!master) return

      const appUrl = `${process.env.BASE_URL}/${master.slug}`

      await ctx.reply(
        `Привет! 👋\n\nДобро пожаловать в ${master.name}!\nЗдесь вы можете записаться на процедуры и посмотреть наш каталог.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Открыть каталог и записаться', web_app: { url: appUrl } }]
            ]
          }
        }
      )
    } catch (err) {
      log.error(`bot/${masterId}`, 'Ошибка обработки /start', { error: err.message })
    }
  })

  // Команда /bookings — мастер смотрит свои записи на сегодня
  bot.command('bookings', async (ctx) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data: bookings } = await supabase
        .from('bookings')
        .select('time_start, time_end, client_name, services(name)')
        .eq('master_id', masterId)
        .eq('date', today)
        .eq('status', 'CONFIRMED')
        .order('time_start', { ascending: true })

      if (!bookings || bookings.length === 0) {
        return ctx.reply('📅 На сегодня записей нет.')
      }

      const lines = bookings.map((b, i) => {
        const service = b.services?.name || 'Услуга'
        return `${i + 1}. ${b.time_start}–${b.time_end} | ${b.client_name} | ${service}`
      })

      await ctx.reply(`📅 Записи на сегодня:\n\n${lines.join('\n')}`)
    } catch (err) {
      log.error(`bot/${masterId}`, 'Ошибка обработки /bookings', { error: err.message })
    }
  })

  return bot
}

// Зарегистрировать бота: добавить в Map и запомнить
function registerBot(masterId, botToken) {
  // Если бот уже был — удаляем старый
  if (activeBots.has(masterId)) {
    activeBots.delete(masterId)
  }
  const bot = createBot(masterId, botToken)
  activeBots.set(masterId, bot)
  return bot
}

// Установить webhook у Telegram для бота мастера
async function setWebhook(masterId, botToken) {
  const webhookUrl = `${process.env.BASE_URL}/webhooks/telegram/${masterId}`
  const bot = new Telegraf(botToken)
  await bot.telegram.setWebhook(webhookUrl)
  log.info(`bot/${masterId}`, `Webhook установлен: ${webhookUrl}`)
  return webhookUrl
}

// Удалить webhook (при отключении бота)
async function removeWebhook(botToken) {
  const bot = new Telegraf(botToken)
  await bot.telegram.deleteWebhook()
}

// Обработать входящий update от Telegram
async function handleUpdate(masterId, update) {
  let bot = activeBots.get(masterId)

  // Если бота нет в памяти — перезагружаем из БД
  if (!bot) {
    const { data: master } = await supabase
      .from('masters')
      .select('bot_token')
      .eq('id', masterId)
      .single()

    if (!master?.bot_token) {
      log.warn(`bot/${masterId}`, 'Токен не найден в БД')
      return
    }

    bot = registerBot(masterId, master.bot_token)
  }

  await bot.handleUpdate(update)
}

// При старте сервера — загрузить всех активных ботов
async function loadAllBots() {
  const { data: masters, error } = await supabase
    .from('masters')
    .select('id, bot_token')
    .eq('bot_webhook_active', true)
    .eq('is_active', true)
    .not('bot_token', 'is', null)

  if (error) {
    log.error('BotManager', 'Ошибка загрузки ботов из БД', { error: error.message })
    return
  }

  if (!masters || masters.length === 0) {
    log.info('BotManager', 'Активных ботов нет')
    return
  }

  for (const master of masters) {
    registerBot(master.id, master.bot_token)
  }

  log.info('BotManager', `Загружено ботов: ${masters.length}`)
}

module.exports = { registerBot, setWebhook, removeWebhook, handleUpdate, loadAllBots }
