import { IncomingWebhook } from '@slack/webhook'
import _ from 'lodash'
import { format, formatDistance } from 'date-fns'
import axios from 'axios'
import { Endpoint, EndpointStatus, MonitorConfig, StatusLog } from '@/types'

export async function checkStatus (
  config: MonitorConfig,
  _statusLog: StatusLog = {}
): Promise<StatusLog> {
  const statusLog = {
    ..._statusLog
  }

  if (!config) {
    throw new Error('no config loaded')
  }

  const { endpoints, notifiers } = config
  const webhook = new IncomingWebhook(notifiers[0].webhook)
  const time = +new Date()

  const checks = endpoints.map(async (endpoint) => {
    if (!statusLog[endpoint.id]) {
      statusLog[endpoint.id] = []
    }

    const endpointStatus = await checkEndpoint(endpoint)
    await parseEndpointStatus(endpoint, endpointStatus, webhook, statusLog, time)

    statusLog[endpoint.id].push({
      time,
      ...endpointStatus
    })
  })

  await Promise.all(checks)

  return statusLog
}

async function parseEndpointStatus (
  endpoint: Endpoint,
  endpointStatus: EndpointStatus,
  webhook: IncomingWebhook,
  statusLog: StatusLog,
  time = +new Date()
) {
  const onDown = async () => {
    const wasOnline = statusLog[endpoint.id].length
      ? _.last(statusLog[endpoint.id]).status === 200
      : true

    if (wasOnline) {
      const lastOnline = statusLog[endpoint.id].find(x => {
        return x.status !== 200
      }) || { time }

      const message = `
        :x: *${endpoint.name}* is DOWN since ${format(lastOnline.time, 'HH:mm:ss')} \n${endpoint.url}\n${endpointStatus.status} - ${endpointStatus.statusText} - ${endpointStatus.duration}`

      await webhook.send(message)
    }
  }

  const onUp = async () => {
    if (!statusLog[endpoint.id].length) {
      const message = `
:white_check_mark: ${endpoint.name} is UP
response time: ${endpointStatus.duration}
`

      await webhook.send(message)
      return
    }

    const wasDown = statusLog[endpoint.id].length
      ? _.last(statusLog[endpoint.id]).status !== 200
      : false

    if (wasDown) {
      const lastUp = _.last(statusLog[endpoint.id].filter(x => x.status === 200)) || { time }

      const message = `
:white_check_mark: ${endpoint.name} is UP
Was down from ${format(lastUp.time, 'HH:mm:ss')} for *${formatDistance(time, lastUp.time)}*
${endpoint.url}
response time: ${endpointStatus.duration}
`

      await webhook.send(message)
    }
  }

  return endpointStatus.status !== 200
    ? onDown()
    : onUp()
}

async function checkEndpoint ({ url }: Endpoint): Promise<EndpointStatus> {
  const {
    status,
    statusText,
    duration
  } = await axios(url).catch(e => e.response)

  return {
    status,
    statusText,
    duration
  }
}
