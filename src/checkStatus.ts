import _ from 'lodash'
import { format, formatDistance } from 'date-fns'
import axios from 'axios'
import { Endpoint, EndpointStatus, MonitorConfig, StatusLog } from '@/types'

export async function checkStatus (
  config: MonitorConfig,
  _statusLog: StatusLog = {},
  sendMessage: (message: string, topic?: string) => Promise<any>,
  logger
): Promise<StatusLog> {
  const statusLog = {
    ..._statusLog
  }

  if (!config) {
    throw new Error('no config loaded')
  }

  const { endpoints } = config
  const time = +new Date()

  const checks = endpoints.map(async (endpoint) => {
    if (!statusLog[endpoint.id]) {
      statusLog[endpoint.id] = []
    }

    const endpointStatus = await checkEndpoint(endpoint)
    const message = parseEndpointStatus(endpoint, endpointStatus, statusLog, time)
    message && await sendMessage(message, endpoint.namespace || endpoint.name)
    message && logger.info(message)

    statusLog[endpoint.id].push({
      time,
      ...endpointStatus
    })
  })

  await Promise.all(checks)

  return statusLog
}

export function parseEndpointStatus (
  endpoint: Endpoint,
  endpointStatus: EndpointStatus,
  statusLog: StatusLog,
  time = +new Date()
) {
  const endpointLogs = statusLog[endpoint.id]

  const onDown = () => {
    const wasOnline = endpointLogs.length
      ? _.last(endpointLogs).status === 200
      : true

    if (wasOnline) {
      const lastOnline = _.findLast(endpointLogs, (x => {
        return x.status !== 200
      })) || { time }

      return `
:cross_mark: *${endpoint.name}* is DOWN since ${format(lastOnline.time, 'HH:mm:ss')} \n${endpoint.url}\n${endpointStatus.status} - ${endpointStatus.statusText} - ${endpointStatus.duration}ms`
    }

    return null
  }

  const onUp = () => {
    const wasDown = endpointLogs.length
      ? _.last(endpointLogs).status !== 200
      : false

    if (wasDown) {
      const lastUp = _.findLast(endpointLogs, x =>  x.status === 200) || { time }

      return `
:check: ${endpoint.name} is UP
Was down from ${format(lastUp.time, 'HH:mm:ss')} for *${formatDistance(time, lastUp.time)}*
${endpoint.url}
response time: ${endpointStatus.duration}ms
`
    }

    return null
  }

  return endpointStatus.status !== 200
    ? onDown()
    : onUp()
}

export async function checkEndpoint ({ url }: Endpoint): Promise<EndpointStatus> {
  const {
    status,
    statusText,
    duration
  } = await axios(url).catch(e => {
    return e.response || {
      status: 0,
      statusText: e.message,
      duration: 0
    }
  })

  return {
    status,
    statusText,
    duration
  }
}
