import type { PluginOption } from 'vite'

export function VitePluginApaasAdapter(): PluginOption {
  return {
    name: 'vite-plugin-apaas-adapter',
    apply: 'build',
    enforce: 'pre',
    configResolved() {
      // eslint-disable-next-line no-console
      console.log('我执行了')
    },
  }
}
