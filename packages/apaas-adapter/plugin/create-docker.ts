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
      const targetDir = resolve(process.cwd(), ctx.apaasOutputDir)

      const file = {
        'dockerfile': [
          ctx.createDockerConfig(),
          resolve(process.cwd()),
        ],
        'nginx.conf': [
          ctx.createNginxConfig(),
          targetDir,
        ],
        'nginx-default.conf': [
          ctx.createNginxDefaultConfig(),
          targetDir,
        ],
      }
      mkdirSync(targetDir, { recursive: true })

      for (const key of Object.keys(file) as Array<keyof typeof file>) {
        const content = file[key][0]
        const outputFileName = resolve(file[key][1], key)
        writeFileSync(outputFileName, content)
        consola.success(`[vite-plugin-apaas] ${key} has been generated in ${join(file[key][1], key)}`)
      }
    },
  }
}
