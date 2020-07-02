import { checkEndpoint, checkStatus, parseEndpointStatus } from '@/checkStatus'
import { EndpointStatus } from '@/types'
import { IncomingWebhook } from '@slack/webhook'

const send = jest.fn()
// @ts-ignore
IncomingWebhook = jest.fn(() => {
  return {
    send
  }
})

const goodEndpoint = {
  id: 'good-endpoint',
  name: 'Good',
  url: 'http://example.com/'
}

const badEndpoint = {
  id: 'bad-endpoint',
  name: 'Bad',
  url: 'http://example.invalid/'
}

const badStatus: EndpointStatus = {
  status: 500,
  statusText: 'bad',
  duration: 100
}

const goodStatus: EndpointStatus = {
  status: 200,
  statusText: 'good',
  duration: 100
}

describe('status checker', () => {
  it('checkEndpoint', async () => {
    const good = await checkEndpoint(goodEndpoint)
    expect(good.status).toEqual(200)

    const bad = await checkEndpoint(badEndpoint)
    expect(bad.status).not.toEqual(200)
  })


  describe('parseEndpointStatus', () => {
    it('first bad', () => {
      const message = parseEndpointStatus(
        badEndpoint,
        badStatus,
        {
          [badEndpoint.id]: []
        }
      )

      expect(message).toContain('DOWN')
    })

    it('first good', () => {
      const message = parseEndpointStatus(
        goodEndpoint,
        goodStatus,
        {
          [goodEndpoint.id]: []
        }
      )

      expect(message).toEqual(null)
    })

    it('bad good', () => {
      const message = parseEndpointStatus(
        goodEndpoint,
        goodStatus,
        {
          [goodEndpoint.id]: [
            {
              time: +new Date(),
              ...badStatus
            }
          ]
        }
      )

      expect(message).toContain('UP')
    })

    it('bad bad', () => {
      const message = parseEndpointStatus(
        badEndpoint,
        badStatus,
        {
          [badEndpoint.id]: [
            {
              time: +new Date(),
              ...badStatus
            }
          ]
        }
      )

      expect(message).toBeNull()
    })

    it('good bad', () => {
      const message = parseEndpointStatus(
        badEndpoint,
        badStatus,
        {
          [badEndpoint.id]: [
            {
              time: +new Date(),
              ...goodStatus
            }
          ]
        }
      )

      expect(message).toContain('DOWN')
    })
  })

  describe('checkStatus', () => {
    beforeEach(() => {
      send.mockReset()
    })
    const config = {
      interval: 0,
      logRetention: 0,
      endpoints: [
        goodEndpoint,
        badEndpoint
      ],
      notifiers: [
        {
          type: 'slack',
          channel: '',
          webhook: ''
        }
      ]
    }

    it('should init empty log', async () => {
      const statusLog = await checkStatus(config, {})

      expect(statusLog[goodEndpoint.id].length).toEqual(1)
      expect(statusLog[badEndpoint.id].length).toEqual(1)
      expect(send).toHaveBeenCalledTimes(1)
    })
  })
})
