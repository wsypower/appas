interface URLConfig {
  name: string
  replace: string
  placeholder: string
}

interface ApaasConfig {
  router: string
  url: URLConfig[]
}
