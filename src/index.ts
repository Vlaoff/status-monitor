import fs from 'fs'
import * as path from 'path'
import '@/utils/axios'
import low from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import { StatusLog, MonitorConfig } from '@/types'
import { checkStatus } from '@/checkStatus'
import { IncomingWebhook } from '@slack/webhook'
const adapter = new FileSync('db.json')
const db = low(adapter)

let timeout = null
const configFilePath = path.resolve('./config.js')

initMonitor()

fs.watch(configFilePath, () => {
  delete require.cache[configFilePath]
  initMonitor()
})

async function initMonitor () {
  clearTimeout(timeout)
  console.log('launching monitor with new config')
  const config: MonitorConfig = require(configFilePath)

  console.log(`monitoring: ${config.endpoints.map(x => x.name).join(', ')}`)
  console.log(`notifying: ${config.notifiers.map(x => x.channel).join(', ')}`)

  db.defaults({ statusLog: {} })
    .write()

  const webhook = new IncomingWebhook(config.notifiers[0].webhook)

  await webhook.send(`:chart: monitoring: ${config.endpoints.map(x => x.name).join(', ')}`)

  const statusLog = db.get('statusLog').value()

  const monitor = async (statusLog) => {
    return checkStatus(config, statusLog).then((statusLog) => {
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


