import type { ResolvedConfig } from 'vite'

export class Ctx {
  base: string = ''
  config!: Record<string, any>
  outDir: string = ''
  replaceKeys!: Map<string, string>
  apaasOutputDir = 'apaas'

  setConfig(config: Record<string, any>) {
    this.config = config
  }

  getConfig() {
    return this.config
  }

  setReplaceKey(replaceKeys: Map<string, string>) {
    this.replaceKeys = replaceKeys
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

  createDockerConfig(): string {
    return `
FROM nginx:1.26-alpine
COPY ./apaas/nginx-default.conf /etc/nginx/conf.d/nginx-default.conf
COPY ./${this.outDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`
  }

  createNginxConfig(): string {
    return `
server {
  listen 80;
  listen [::]:80;
  server_name localhost;
  location / {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "POST, GET, OPTIONS";
    add_header Access-Control-Allow-Headers "Origin, Authorization, Accept, Link, X-Total-Count, Content-Disposition, Content-Type";
    add_header Access-Control-Allow-Credentials true;
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection 1;
    add_header X-Frame-Options SAMEORIGIN;
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
  error_page 500 502 503 504 /50x.html;
  location = /50x.html {
    root /usr/share/nginx/html;
  }
}
`
  }
}

export default new Ctx()
