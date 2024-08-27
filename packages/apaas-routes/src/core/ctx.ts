import consola from 'consola'
import * as t from '@babel/types'
import type { Rollup } from 'vite'
import type { Options, RoutesInfo } from '../types'
import { transformCodeToApaas } from './format'
import { readExportedRoutes, resolveModule } from './resolve'
import { parseDirectives } from './parseDirectives'

export function createContext(options: Options) {
  const {
    filePath = 'src/router/routes.ts',
    variableName = 'asyncRoutes',
  } = options

  /** 路由AST相关信息 */
  let routes: RoutesInfo = {}

  /** 存储的 `v-auth` 指令 */
  const directivesMap = new Map<string, string[]>()

  /**
   * 解析指令
   */
  function resolveDirectives(id: string, code: string) {
    if (id.endsWith('.vue')) {
      parseDirectives(id, code, directivesMap)
    }
  }

  /**
   * 解析路由
   */
  async function resolveRoutes(id: string, code: string, ctx: Rollup.TransformPluginContext) {
    // 读取指定文件中的变量
    if (id.endsWith(filePath)) {
      routes = readExportedRoutes(code, variableName)

      if (!routes.node || !t.isArrayExpression(routes.node)) {
        consola.info(`${variableName} not found or not array in ${id}`)
        return
      }

      // 解析变量依赖的模块
      await resolveModule(routes, ctx, id)
    }
  }

  /**
   * 格式化代码
   */
  function transformCode() {
    // 默认移除黑白名单页面
    const excludes = ['blacklist', 'whitelist']
    return transformCodeToApaas(routes, directivesMap, excludes)
  }

  return {
    resolveDirectives,
    resolveRoutes,
    transformCode,
  }
}
