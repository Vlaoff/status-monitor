import fs from 'fs'
import * as path from 'path'
import '@/utils/axios'
import low from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import { StatusLog, MonitorConfig } from '@/types'
import { checkStatus } from '@/checkStatus'
import { IncomingWebhook } from '@slack/webhook'
import pino from 'pino'
import logdna from 'logdna'
import { getZulipClient, sendMessage } from '@/zulip'

const adapter = new FileSync('db.json')
const db = low(adapter)

let timeout = null
const configFilePath = path.resolve('./config.js')
let logger = console

initMonitor()

fs.watch(configFilePath, () => {
  delete require.cache[configFilePath]
  initMonitor()
})

async function initMonitor () {
  clearTimeout(timeout)

  const config: MonitorConfig = require(configFilePath)

  if (config.LOGDNA_KEY) {
    const logdnaLogger = config.LOGDNA_KEY && logdna.createLogger(config.LOGDNA_KEY, {
      env: 'production',
      app: 'status-monitor'
    })

    const logdnaTransport = {
      write (msg: string) {
        if (!config.LOGDNA_KEY) {
          return
        }
        logdnaLogger && logdnaLogger.log(msg)
      }
    }

    logger = pino({}, logdnaTransport)
  }

  logger.info('launching monitor with new config')

  logger.info(`monitoring: ${config.endpoints.map(x => x.name).join(', ')}`)
  logger.info(`notifying: ${config.notifiers.map(x => x.type).join(', ')}`)

  db.defaults({ statusLog: {} })
    .write()

  const slackNotifier = config.notifiers.find(x => x.type === 'slack')
  const zulipNotifier = config.notifiers.find(x => x.type === 'zulip')

  const getSendMessage = async () => {
    const webhook = slackNotifier
      ? new IncomingWebhook(config.notifiers[0].webhook)
      : null

    const zulipClient = zulipNotifier
      ? await getZulipClient()
      : null


    return async (content, topic?) => {
      webhook && await webhook.send(content)
      zulipClient && await sendMessage(zulipClient, {
        to: zulipNotifier.to,
        type: 'stream',
        topic,
        content
      })
    }
  }

  const messageSender = await getSendMessage()

  await messageSender(`:chart: monitoring: ${config.endpoints.map(x => x.name).join(', ')}`, 'logs')

  const statusLog = db.get('statusLog').value()

  const monitor = async (statusLog) => {
    return checkStatus(config, statusLog, messageSender, logger).then((statusLog) => {
      logger.info('monitoring job completed')
      db.set('statusLog', filterLogs(statusLog, config)).write()

      timeout = setTimeout(() => {
        monitor(statusLog)
      }, config.interval)
    })
  }

  monitor(statusLog)
}

function filterLogs (statusLog: StatusLog, { logRetention }: MonitorConfig): StatusLog {
  return Object.keys(statusLog).reduce((acc, key) => {
    acc[key] = statusLog[key].filter(x => Math.abs(x.time - +new Date()) < logRetention)
    return acc
  }, {})
}


