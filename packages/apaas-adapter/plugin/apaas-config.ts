import { join, resolve } from 'node:path'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import consola from 'consola'
import ctx from '../src/ctx'

export function apaasConfig(): Plugin {
  return {
    name: 'apaas-config',
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
