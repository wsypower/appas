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
import { createDocker } from '../plugin/create-docker'
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
    createDocker(),
  ]

  return {
    name: 'vite-plugin-apaas-adapter',
    apply: 'build',
    enforce: 'pre',
    async config() {
      const { config: apassUserConfig } = await loadConfig<ApaasConfig>({
        name: 'apaas',
        defaultConfig: {
          router: '${thisAbility.frontend.baseRoute}',
          url: [],
        },
      })
      const { map, config } = normalizeConfig(apassUserConfig)
      ctx.setConfig(config)
      ctx.setReplaceKey(map)
    },

    configResolved(ResolvedConfig) {
      ctx.createContext(ResolvedConfig)
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

    transformIndexHtml(...args) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.transformIndexHtml)) {
          const result = pluginsHook.transformIndexHtml.call(this, ...args)
          if (result) {
            return result
          }
        }
      }
    },

    generateBundle(...args) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.generateBundle)) {
          pluginsHook.generateBundle.call(this, ...args)
        }
      }
    },

    async buildEnd(...args) {
      for (const pluginsHook of pluginsList) {
        if (isFunction(pluginsHook.buildEnd)) {
          await pluginsHook.buildEnd.call(this, ...args)
        }
      }
    },

  }
}
