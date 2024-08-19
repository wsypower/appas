import { join, resolve } from 'node:path'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import consola from 'consola'
import ctx from '../src/ctx'

export function apaasConfig(): Plugin {
  return {
    name: 'apaas-config',
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
