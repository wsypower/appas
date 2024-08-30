import { join, resolve } from 'node:path'
import { cwd, exit } from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { PluginOption } from 'vite'
import consola from 'consola'
import { createContext } from './core/ctx'

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
  const ctx = createContext({
    filePath: 'src/router/routes.ts',
    variableName: 'asyncRoutes',
  })

  return {
    name: 'vite-plugin-apaas-routes',
    apply: 'build',
    enforce: 'pre',
    async transform(code, id) {
      ctx.resolveDirectives(id, code)
      await ctx.resolveRoutes(id, code, this)
    },
    async closeBundle() {
      try {
        const content = await ctx.transformCode()
        generateFile(content)
      }
      catch (error) {
        consola.log(error)
        exit(1)
      }
    },
  }
}
