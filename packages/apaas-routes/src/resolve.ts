import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { Rollup } from 'vite'
import type { RoutesInfo } from './types'

/**
 * @desc: 读取文件导出的路由
 */
export function readExportedRoutes(code: string, variableName: string) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  let routes: RoutesInfo = {}

  traverse(ast, {
    ExportSpecifier(path) {
      const { node, scope, parentPath } = path
      if (
        t.isIdentifier(node.exported, { name: variableName })
        && t.isIdentifier(node.local)
      ) {
        const binding = scope.getBinding(node.local.name)
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          routes = {
            node: binding.path.node.init,
            scope,
            parentPath,
          }
        }
      }
    },
  })

  return routes
}

/**
 * @desc: 将依赖的模块解析并替换到指定位置
 */
export async function resolveModule(routes: RoutesInfo, ctx: Rollup.TransformPluginContext, id: string) {
  if (!routes.node) {
    return
  }

  const asyncTasks: Promise<void>[] = []

  traverse(
    routes.node,
    {
      ObjectProperty(path) {
        const { node, scope } = path
        if (!t.isIdentifier(node.key)) {
          return
        }

        if (node.key.name === 'children' && t.isArrayExpression(node.value)) {
          node.value.elements.forEach((n, index) => {
            if (!t.isIdentifier(n)) {
              return
            }
            asyncTasks.push((async () => {
              const binding = scope.getBinding(n.name)
              if (binding && binding.path.isImportDefaultSpecifier()) {
                const importDecl = binding.path.parent

                if (t.isImportDeclaration(importDecl)) {
                  const source = importDecl.source.value

                  const resolved = await ctx.resolve(source, id)
                  if (!resolved) {
                    return
                  }

                  const dependency = await ctx.load({ id: resolved.id })
                  if (dependency && dependency.code) {
                    const targetNode = resolveExternalModule(dependency.id, dependency.code)
                    if (t.isArrayExpression(node.value)) {
                      node.value.elements[index] = targetNode!
                    }
                  }
                }
              }
            })())
          })
        }
      },
    },
    routes.scope,
    null,
    routes.parentPath,
  )

  await Promise.all(asyncTasks)
}

/**
 * @desc: 读取外部依赖
 */
function resolveExternalModule(
  id: string,
  code: string,
  // { ctx }: { ctx: Rollup.TransformPluginContext },
) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  let targetNode
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const { node, scope } = path
      if (t.isIdentifier(node.declaration)) {
        const binding = scope.getBinding(node.declaration.name)
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          targetNode = binding.path.node.init
        }
      }
    },
  })

  return targetNode
}
