const { handleUpdate } = require('../../bot/manager')
const log = require('../../logger')

async function telegramWebhookRoutes(fastify) {

  // POST /webhooks/telegram/:masterId
  // Telegram отправляет сюда все сообщения из бота мастера
  fastify.post('/webhooks/telegram/:masterId', async (request, reply) => {
    const { masterId } = request.params
    const update = request.body

    // Сразу отвечаем Telegram что получили (иначе будет retry)
    reply.status(200).send({ ok: true })

    // Обрабатываем update асинхронно
    try {
      await handleUpdate(masterId, update)
    } catch (err) {
      log.error(`webhook/telegram`, 'Ошибка обработки update', { masterId, error: err.message })
    }
  })
}

module.exports = telegramWebhookRoutes
