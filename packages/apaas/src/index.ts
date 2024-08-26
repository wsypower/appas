import process from 'node:process'
import { VitePluginApaasAdapter, defineConfig } from '@pubinfo/apaas-adapter'
import { VitePluginApaasRoutes } from '@pubinfo/apaas-routes'

// TODO:堆栈过深跳过类型检查
function VitePluginApaas(): any {
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
