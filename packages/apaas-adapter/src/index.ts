/* eslint-disable no-template-curly-in-string */
import type { Plugin, PluginOption } from 'vite'
import { isFunction } from 'radash'
import { loadConfig } from 'c12'
import { userStoreAdapter } from '../plugin/user-store-adapeter'
import { requestAdapter } from '../plugin/request-adapter'
import { routerAdapter } from '../plugin/router-adapter'
import { normalizeConfig } from '../utils/index'
import { apaasConfig } from '../plugin/apaas-config'
import { adapterMain } from '../plugin/resolve-adapter'
import ctx from './ctx'

export function defineConfig(config: SimplifyDeep<Partial<ApaasConfig>>) {
  return config
}

export function VitePluginApaasAdapter(): PluginOption {
  const pluginsList: Plugin[] = [
    apaasConfig(),
    adapterMain(),
    userStoreAdapter(),
    requestAdapter(),
    routerAdapter(),
  ]
  return {
    name: 'vite-plugin-apaas-adapter',
    enforce: 'pre',
    async config(config) {
      // apaas 配置需要抹掉vite-plugin-env-runtime插件
      if (config.plugins) {
        config.plugins = config.plugins.filter((plugin) => {
          if (typeof plugin !== 'object' || Array.isArray(plugin) || plugin instanceof Promise) {
            return true
          }
          return plugin?.name !== 'vite-plugin-env-runtime'
        })
      }
      const { config: apassUserConfig } = await loadConfig<ApaasConfig>({
        name: 'apaas',
        defaultConfig: {
          router: '${thisAbility.frontend.baseRoute}',
          url: [],
        },
      })
      const apaasConfig = normalizeConfig(apassUserConfig)
      ctx.setConfig(apaasConfig)
      return config
    },
    configResolved(config) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.configResolved)) {
          pluginsHook.configResolved.call(this, config)
        }
      }
    },
    resolveId(...args) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.resolveId)) {
          const id = pluginsHook.resolveId.call(this, ...args)
          if (id) {
            return id
          }
        }
      }
      return null
    },
    load(...args) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.load)) {
          const result = pluginsHook.load.call(this, ...args)
          if (result) {
            return result
          }
        }
      }
      return null
    },
    transform(code, id) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.transform)) {
          const result = pluginsHook.transform.call(this, code, id)
          if (result) {
            return result
          }
        }
      }
      return null
    },
  }
}
