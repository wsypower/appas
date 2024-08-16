import type { Plugin } from 'vite'
import ctx from '../src/ctx'

export function apaasConfig(): Plugin {
  return {
    name: 'apaas-config',
    // 处理模块解析
    generateBundle() {
      const fileContent = `
window.bootConfig = {
  production: ${JSON.stringify(ctx.getConfig(), null, 2)},
};
      `
      this.emitFile({
        type: 'asset',
        fileName: 'config/micro-service-config.js',
        source: fileContent,
      })
    },
  }
}
