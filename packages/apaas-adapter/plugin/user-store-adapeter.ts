import type { Plugin } from 'vite'
import { parse } from '@babel/parser'
import template from '@babel/template'
import traverse from '@babel/traverse'
import type * as t from '@babel/types'
import generator from '@babel/generator'

export function userStoreAdapter(): Plugin {
  const adapeter = template.ast(`
    async function getPermissions() {
      const apaasAuth = JSON.parse(sessionStorage.getItem('LOGIN_USER_BUTTON_AUTH') || '{}');
      const res = apaasAuth.map((item) => {
        const code = item.action.split('.').at(-1);
        return code;
      });
      user.permissions = res;
      return user.permissions;
    }
`)

  return {
    name: 'user-store-adapter',
    // 处理模块解析
    transform(code, id) {
      if (id.endsWith('store/modules/user.ts')) {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript'],
        })

        traverse(ast, {
          FunctionDeclaration(path) {
            if (path.node.id?.name === 'getPermissions') {
              const newBody = (adapeter as t.FunctionDeclaration).body
              path.get('body').replaceWith(newBody)
            }
          },
        })

        // 生成新的代码
        const output = generator(ast, {
          sourceMaps: true,
          sourceFileName: id,
        })

        return {
          code: output.code,
          map: output.map,
        }
      }
      return null
    },
  }
}
