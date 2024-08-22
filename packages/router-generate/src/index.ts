import path from 'node:path'
import process from 'node:process'
import type { PluginOption } from 'vite'

export function VitePluginApaasRouterGenerator(): PluginOption {
  return {
    name: 'vite-plugin-apaas-router-generator',
    config(config) {
      const projectRoot = config.root || process.cwd()
      const routerEntry = path.resolve(projectRoot, 'src/router/index.ts')

      // 添加多入口
      config.build.rollupOptions = config.build.rollupOptions || {}
      config.build.rollupOptions.input = {
        ...(config.build.rollupOptions.input || {}),
        router: routerEntry,
      }

      // 动态外部化 vue 和 vue-router，仅在处理 router 入口时生效
      config.build.rollupOptions.external = (id) => {
        if (id.endsWith('.vue')) {
          return routerEntry === config.build.rollupOptions.input.router
        }
        return false
      }

      // 配置输出文件名
      const originalOutput = config.build.rollupOptions.output || {}
      config.build.rollupOptions.output = {
        ...originalOutput,
        entryFileNames: (chunk) => {
          if (chunk.name === 'router') {
            return 'router-table.js' // 自定义 router 的输出文件名
          }
          return typeof originalOutput.entryFileNames === 'function'
            ? originalOutput.entryFileNames(chunk)
            : originalOutput.entryFileNames || 'assets/[name].js'
        },
        format: originalOutput.format || 'es', // 使用 ES 模块格式
      }
    },
  }
}
