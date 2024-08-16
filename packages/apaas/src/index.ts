import type { PluginOption } from 'vite'
import { VitePluginApaasAdapter, defineConfig } from '@pubinfo/apaas-adapter'

function VitePluginApaas(): PluginOption {
  return [
    VitePluginApaasAdapter(),
  ]
}

export {
  VitePluginApaas,
  defineConfig,
}
