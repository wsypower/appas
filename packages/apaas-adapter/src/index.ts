import type { Plugin } from 'vite'

export function VitePluginApaasAdapter(): Plugin {
  return {
    name: 'vite-plugin-apaas-adapter',
    apply: 'build',
    enforce: 'pre',
    configureServer() {

    },
  }
}
