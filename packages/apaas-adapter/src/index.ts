import type { Plugin, PluginOption } from 'vite'
import { isFunction } from 'radash'
import { adapterMain } from '../plugin/resolve-adapter'
import { userStoreAdapter } from '../plugin/user-store-adapeter'
import { requestAdapter } from '../plugin/request-adapter'

export function VitePluginApaasAdapter(): PluginOption {
  const pluginsList: Plugin[] = [
    adapterMain(),
    userStoreAdapter(),
    requestAdapter(),
  ]
  return {
    name: 'vite-plugin-apaas-adapter',
    enforce: 'pre',
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
