import type { PluginOption } from 'vite'
import { VitePluginApaasAdapter } from '@pubinfo/apaas-adapter'

export function VitePluginApaas(): PluginOption {
  return [
    VitePluginApaasAdapter(),
  ]
}
