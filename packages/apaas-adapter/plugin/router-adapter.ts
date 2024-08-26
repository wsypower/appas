import type { Plugin } from 'vite'
import { parse } from '@babel/parser'
import template from '@babel/template'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generator from '@babel/generator'

export function routerAdapter(): Plugin {
  return {
    name: 'router-adapter',
    // 处理模块解析
    transform(code, id) {
      if (id.endsWith('/src/router/utils/createRouter.ts')) {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript'],
        })

        // 插入 createWebHistory 的 import 语句
        const importPath = ast.program.body.findIndex(node =>
          t.isImportDeclaration(node)
          && node.source.value === 'vue-router',
        )

        const newImport = t.importDeclaration(
          [t.importSpecifier(t.identifier('createWebHistory'), t.identifier('createWebHistory'))],
          t.stringLiteral('vue-router'),
        )

        ast.program.body.splice(importPath + 1, 0, newImport)

        // 使用 template 来生成修改后的路由历史配置
        const createRouterTemplate = template.ast`
          createRouter({
            history: createWebHistory(window?.bootConfig?.production?.VUE_BASE_ROUTE),
            routes: constantRoutes,
            strict: true,
            scrollBehavior: () => ({ left: 0, top: 0 }),
          });
        ` as t.ExpressionStatement

        traverse(ast, {
          CallExpression(path) {
            if (
              t.isIdentifier(path.node.callee, { name: 'createRouter' })
              && path.node.arguments.length > 0
              && t.isObjectExpression(path.node.arguments[0])
            ) {
              // 查找 history 属性是否使用了 createWebHashHistory
              const isHashHistory = path.node.arguments[0].properties.find(prop =>
                t.isObjectProperty(prop)
                && t.isIdentifier(prop.key, { name: 'history' })
                && t.isCallExpression(prop.value)
                && t.isIdentifier(prop.value.callee, { name: 'createWebHashHistory' }),
              )

              if (isHashHistory) {
                // 替换 createRouter 的参数
                path.replaceWith(createRouterTemplate.expression)
              }
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
