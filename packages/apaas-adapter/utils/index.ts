export function normalizeConfig(userConfig: ApaasConfig) {
  const map = new Map<string, string>()
  const config: Record<string, any> = {}
  for (const key of Object.keys(userConfig)) {
    switch (key) {
      case 'router':
        config.VUE_BASE_ROUTE = userConfig[key]
        break
      case 'url':
        for (const item of userConfig[key]) {
          config[item.name] = item.placeholder
          map.set(item.replace, item.name)
        }
        break
    }
  }

  return { map, config }
}
