export const BASIC_URL = new Map()

export function normalizeConfig(userConfig: ApaasConfig) {
  const config: Record<string, any> = {}
  for (const key of Object.keys(userConfig)) {
    switch (key) {
      case 'router':
        config.VUE_BASE_ROUTE = userConfig[key]
        break
      case 'url':
        for (const item of userConfig[key]) {
          config[item.name] = item.placeholder
          BASIC_URL.set(item.replace, item.name)
        }
        break
    }
  }

  return config
}
