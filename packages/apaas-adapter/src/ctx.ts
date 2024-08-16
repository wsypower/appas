export class Ctx {
  config!: Record<string, any>

  setConfig(config: Record<string, any>) {
    this.config = config
  }

  getConfig() {
    return this.config
  }
}

export default new Ctx()
