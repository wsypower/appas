import process from 'node:process'
import type { PluginOption } from 'vite'
import { VitePluginApaasAdapter, defineConfig } from '@pubinfo/apaas-adapter'
import { VitePluginApaasRoutes } from '@pubinfo/apaas-routes'

function VitePluginApaas(): PluginOption {
  // 历史遗留问题，这里的 APAAS 环境变量是从 process.env 中获取的，不能取mode模式
  const isApaas = process.env.APAAS === 'true'
  return isApaas
    ? [
        VitePluginApaasAdapter(),
        VitePluginApaasRoutes(),
      ]
    : []
}

export {
  VitePluginApaas,
  defineConfig,
}
