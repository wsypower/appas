import { join, resolve } from 'node:path'
import { cwd, exit } from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { PluginOption, Rollup } from 'vite'
import consola from 'consola'
import * as t from '@babel/types'
import { transformCodeToApaas } from './format'
import { readExportedRoutes, resolveModule } from './resolve'

/**
 * @desc: 生成apaas路由
 */
async function generateApaasRoutes(
  id: string,
  code: string,
  { ctx, variableName }: { ctx: Rollup.TransformPluginContext, variableName: string },
) {
  const routes = readExportedRoutes(code, variableName)

  if (!routes.node || !t.isArrayExpression(routes.node)) {
    consola.info(`${variableName} not found or not array in ${id}`)
    return
  }

  // 将依赖的模块解析并替换到指定位置
  await resolveModule(routes, ctx, id)

  // 遍历并格式化成 apaas 的格式
  return transformCodeToApaas(routes)
}

/**
 * @desc: 生成指定JSON文件
 */
function generateFile(content?: string) {
  if (!content) {
    return
  }

  const targetDir = resolve(cwd(), 'apaas')
  const outputFileName = resolve(targetDir, 'routes.json')

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(outputFileName, content)
  consola.success(`[vite-plugin-apaas] routes.json has been generated in ${join(targetDir, 'routes.json')}`)
}

export function VitePluginApaasRoutes(): PluginOption {
  let content: string | undefined

  return {
    name: 'vite-plugin-apaas-routes',
    apply: 'build',
    async transform(code, id) {
      if (id.endsWith('src/router/routes.ts')) {
        content = await generateApaasRoutes(id, code, { ctx: this, variableName: 'asyncRoutes' })

        return {
          code,
          map: null,
        }
      }
      return null
    },
    closeBundle() {
      try {
        generateFile(content)
      }
      catch (error) {
        consola.log(error)
        exit(1)
      }
    },
  }
}
