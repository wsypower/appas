import { join, resolve } from 'node:path'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import consola from 'consola'
import ctx from '../src/ctx'

export function createDocker(): Plugin {
  return {
    name: 'create-docker',
    async buildEnd() {
      const file = {
        'dockerfile': ctx.createDockerConfig(),
        'nginx-default.conf': ctx.createNginxConfig(),
      }

      const targetDir = resolve(process.cwd(), ctx.apaasOutputDir)
      mkdirSync(targetDir, { recursive: true })

      for (const key of Object.keys(file) as Array<keyof typeof file>) {
        const content = file[key]
        const outputFileName = resolve(targetDir, key)
        writeFileSync(outputFileName, content)
        consola.success(`[vite-plugin-apaas] ${key} has been generated in ${join(targetDir, key)}`)
      }
    },
  }
}
