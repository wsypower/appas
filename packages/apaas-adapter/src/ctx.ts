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
COPY ./apaas/nginx.conf /etc/nginx/nginx.conf
COPY ./apaas/nginx-default.conf /etc/nginx/conf.d/default.conf
COPY ./${this.outDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`
  }

  createNginxConfig(): string {
    return `
user  nginx;
# 工作进程必须为1
worker_processes  1;
error_log  /var/log/nginx/error.log debug;
pid        /var/run/nginx.pid;
events {
  worker_connections  1024;
}
http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;
  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                     '$status $body_bytes_sent "$http_referer" '
                     '"$http_user_agent" "$http_x_forwarded_for"';
  access_log /var/log/nginx/access.log main;
  sendfile        on;
  # tcp_nopush     on;
  keepalive_timeout  65;
  # gzip  on;
  include /etc/nginx/conf.d/*.conf;
}
`
  }

  createNginxDefaultConfig(): string {
    return `
server {
  listen 80;
  listen [::]:80;
  server_name localhost;
  location / {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "POST,GET,OPTIONS,DELETE,PUT,PATCH,HEAD";
    add_header Access-Control-Allow-Headers "Authorization,Content-Type,Accept,Origin,User-Agent,DNT,Cache-Control,X-Mx-ReqToken,X-Data-Type,X-Requested-With,X-Data-Type,X-Auth-Token";
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
