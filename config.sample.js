module.exports = {
  interval: 1000 * 30,
  logRetention: 1000 * 60 * 60 * 24,
  endpoints: [
    {
      id: 'uniqueId',
      name: 'Endpoint Name',
      url: 'https://example.com/healthz'
    }
  ],
  notifiers: [
    {
      type: 'slack',
      channel: '#services-status',
      webhook: ''
    }
  ]
}
