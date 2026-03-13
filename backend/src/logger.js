const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(__dirname, '../../logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')
const ERROR_FILE = path.join(LOG_DIR, 'errors.log')

// Создаём папку logs если её нет
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function formatLine(level, context, message, extra) {
  const extraStr = extra ? ` | ${JSON.stringify(extra)}` : ''
  return `[${timestamp()}] [${level.padEnd(5)}] [${context}] ${message}${extraStr}\n`
}

function writeToFile(file, line) {
  fs.appendFile(file, line, (err) => {
    if (err) console.error('[logger] Не удалось записать лог:', err.message)
  })
}

const logger = {
  info(context, message, extra) {
    const line = formatLine('INFO', context, message, extra)
    process.stdout.write(line)
    writeToFile(LOG_FILE, line)
  },

  warn(context, message, extra) {
    const line = formatLine('WARN', context, message, extra)
    process.stdout.write(line)
    writeToFile(LOG_FILE, line)
  },

  error(context, message, extra) {
    const line = formatLine('ERROR', context, message, extra)
    process.stderr.write(line)
    writeToFile(LOG_FILE, line)
    writeToFile(ERROR_FILE, line) // ошибки дублируются в errors.log
  }
}

module.exports = logger
