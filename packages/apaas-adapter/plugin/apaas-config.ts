import { join, resolve } from 'node:path'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import consola from 'consola'
import MagicString from 'magic-string'
import ctx from '../src/ctx'

export function apaasConfig(): Plugin {
  return {
    name: 'apaas-config',
    transform(code, id) {
      // 需要处理所有文件么？
      if (id.endsWith('.ts') || id.endsWith('.vue')) {
        const s = new MagicString(code)
        const map = ctx.replaceKeys
        // 遍历 ctx.replaceKeys 中的键
        for (const [key, value] of map.entries()) {
          // 构建要查找的字符串，例如 'import.meta.env.KEY'
          const searchString = `import.meta.env.${key}`
          // 查找并替换所有匹配的字符串
          let startIndex = code.indexOf(searchString)
          while (startIndex !== -1) {
            const endIndex = startIndex + searchString.length
            const replacement = `window.bootConfig.production.${value}`

            // 替换
            s.overwrite(startIndex, endIndex, replacement)
            // 查找下一个匹配项
            startIndex = code.indexOf(searchString, endIndex)
          }
        }

        // 如果有修改，返回新的代码和 source map
        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: s.generateMap({ hires: true }),
          }
        }
      }

      return null
    },
    transformIndexHtml(html) {
      const modifiedHtml = html
        .replace('<link rel="stylesheet" href="/loading.css" />', '')
        .replace('<link rel="stylesheet" href="/browser_upgrade/index.css" />', '')
        .replace(
          /<div class="w-admin-home">[\s\S]*?<\/div>[\s\S]*?<div id="browser-upgrade">[\s\S]*?<\/div>/,
          '',
        ).replace(
          '</head>',
          `<script src="${ctx.base}config/micro-service-config.js"></script></head>`,
        )

      return modifiedHtml
    },
    // 处理模块解析
    generateBundle() {
      const fileContent = ctx.createMicroServiceConfig()
      this.emitFile({
        type: 'asset',
        fileName: 'config/micro-service-config.js',
        source: fileContent,
      })
    },
    async buildEnd() {
      const fileContent = ctx.createMicroServiceConfig()
      const targetDir = resolve(process.cwd(), 'apaas')
      const outputFileName = resolve(targetDir, 'micro-service-config.js')

      mkdirSync(targetDir, { recursive: true })
      writeFileSync(outputFileName, fileContent)
      consola.success(`[vite-plugin-apaas] micro-service-config.js has been generated in ${join(targetDir, 'micro-service-config')}`)
    },
  }
}
