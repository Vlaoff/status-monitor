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
  logRetention: number
  endpoints: Endpoint[]
  notifiers: {
    type: string
    channel: string
    webhook: string
  }[]
}
