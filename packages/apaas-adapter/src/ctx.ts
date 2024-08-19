import type { ResolvedConfig } from 'vite'

export class Ctx {
  base: string = ''
  config!: Record<string, any>
  outDir: string = ''
  setConfig(config: Record<string, any>) {
    this.config = config
  }

  getConfig() {
    return this.config
  }

  createContext(ResolvedConfig: ResolvedConfig) {
    this.outDir = ResolvedConfig.build.outDir
    this.base = ResolvedConfig.base
  }

  createMicroServiceConfig(): string {
    return `
/* eslint-disable no-template-curly-in-string */
window.bootConfig = {
  production: ${JSON.stringify(this.getConfig(), null, 2)},
};
`
  }
}

export default new Ctx()
