import axios from 'axios'

axios.interceptors.request.use(x => {
  return {
    ...x,
    meta: {
      // @ts-ignore
      ...x.meta,
      requestStartedAt: +new Date()
    }
  }
})

axios.interceptors.response.use(x => {
  // @ts-ignore
  const duration = +new Date() - x.config.meta.requestStartedAt

  return {
    ...x,
    duration
  }
},
// Handle 4xx & 5xx responses
x => {
  // @ts-ignore
  const duration = +new Date() - x.config.meta.requestStartedAt

  throw {
    ...x,
    response: {
      ...x.response,
      duration
    }
  }
}
)
