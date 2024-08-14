import type { Plugin } from 'vite'
import MagicString from 'magic-string'

// 定义虚拟模块的内容
const virtualModuleId = 'virtual:isApaas'
const resolvedVirtualModuleId = `\0${virtualModuleId}`

const virtual = `
import useUserStore from '@/store/modules/user';

export function isApass() {
  return import.meta.env.MODE === 'apaas';
}

function injectAdapterStyle() {
  const style = document.createElement('style');
  const css = "#app-main > header{display: none}#app-main .topbar-container{display: none}";
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

function injectAppStyle(app) {
  app._container.style.height = '100vh';
}

function injectReviseCssVar() {
  const cssVars = {
    '--g-header-height': '0',
    '--g-main-sidebar-width': '0',
    '--g-sub-sidebar-width': '0',
    '--g-sub-sidebar-collapse-width': '0',
    '--g-sidebar-logo-height': '0',
    '--g-tabbar-height': '0',
    '--g-toolbar-height': '0',
    '--g-tabbar-tab-max-width': '0',
    '--g-tabbar-tab-min-width': '0',
  };
  const root = document.documentElement;

  for (const [varName, value] of Object.entries(cssVars)) {
    root.style.setProperty(varName, value);
  }
}

function adapterStyle(app) {
  injectAdapterStyle();
  injectReviseCssVar();
  injectAppStyle(app);
}

function adapterContainer(app) {
  window.addEventListener('unmount', () => {
    app.unmount();
  });
}

function adapterToken() {
  const token = sessionStorage.getItem('Access-Token');
  const userStore = useUserStore();
  userStore.user.token = token;
}

export function apaasClean() {
  window.microApp.dispatch({ type: 'logout' });
  localStorage.clear();
  sessionStorage.clear();
}

export function adapterApaas(app) {
  if (isApass()) {
    adapterStyle(app);
    adapterContainer(app);
    adapterToken();
  }
}

`
/**
 * 处理在main中引入的虚拟模块的逻辑
 */
export function adapterMain(): Plugin {
  return {
    name: 'adapter-main',
    // 处理模块解析
    resolveId(id) {
      if (id === virtualModuleId) {
        return {
          id: resolvedVirtualModuleId,
          moduleSideEffects: true,
        }
      }
      return null
    },

    // 提供虚拟模块内容
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return virtual
      }
      return null
    },

    // 修改main文件
    transform(code, id) {
      // 检查是否是main文件
      if (id.endsWith('/src/main.ts')) {
        const ms = new MagicString(code)

        // 插入 import 语句
        const importIndex = code.indexOf('import')
        ms.appendLeft(importIndex, `import { adapterApaas } from 'virtual:isApaas';\n`)

        // 插入函数调用
        const mountIndex = code.indexOf('app.mount(\'#app\');')
        ms.appendRight(mountIndex + 'app.mount(\'#app\');'.length, `\n  adapterApaas(app);`)

        // 返回修改后的代码和 source map
        return {
          code: ms.toString(),
          map: ms.generateMap({
            source: id,
            includeContent: true,
            hires: true,
          }),
        }
      }
      return null
    },
  }
}
