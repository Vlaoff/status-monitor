export type StatusLog = {
  [endpointId: string]: LogItem[]
}

export type LogItem = EndpointStatus & {
  time: number
}

export type Endpoint = {
  id: string
  name: string
  url: string
}

export type EndpointStatus = {
  status: number
  statusText: string
  duration: number
}

export type MonitorConfig = {
  interval: number
  // in days
  logRetention: number
  endpoints: Endpoint[]
  notifiers: {
    type: 'slack'
    channel: string
    webhook: string
  }[]
}
