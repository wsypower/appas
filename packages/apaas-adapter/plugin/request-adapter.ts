import type { Plugin } from 'vite'
import { parse } from '@babel/parser'
import template from '@babel/template'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generator from '@babel/generator'

export function requestAdapter(): Plugin {
  const case401Body = template.ast(`
  window.microApp.dispatch({ type: 'logout' });
  localStorage.clear();
  sessionStorage.clear();
  return;
`) as t.Statement[]

  const case401 = t.switchCase(t.numericLiteral(401), case401Body)

  return {
    name: 'request-adapter',
    // 处理模块解析
    transform(code, id) {
      if (id.endsWith('/src/api/factory.ts') || id.endsWith('/src/api/index.ts')) {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript'],
        })
        traverse(ast, {
          ObjectMethod(path) {
            if (t.isIdentifier(path.node.key, { name: 'onSuccess' })) {
              const methodBody = path.get('body')
              methodBody.traverse({
                SwitchStatement(switchPath) {
                  switchPath.node.cases.unshift(case401)
                },
              })
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
