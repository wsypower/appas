import type { PluginOption, Rollup } from 'vite'
import { parse } from '@babel/parser'
import type { NodePath, Scope } from '@babel/traverse'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

function resolveRoutes(
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
        targetNode = binding?.path.node.init
      }
    },
  })

  return targetNode
}

async function resolveModule(
  id: string,
  code: string,
  { ctx, variableName }: { ctx: Rollup.TransformPluginContext, variableName: string },
) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  const asyncRoutes: {
    node?: t.Node
    scope?: Scope
    parentPath?: NodePath
  } = {}

  traverse(ast, {
    ExportSpecifier(path) {
      const { node, scope, parentPath } = path
      if (t.isIdentifier(node.exported, { name: variableName })) {
        if (t.isIdentifier(node.local)) {
          const binding = scope.getBinding(node.local.name)
          asyncRoutes.node = binding?.path.node.init
          asyncRoutes.scope = scope
          asyncRoutes.parentPath = parentPath
        }
      }
    },
  })

  if (asyncRoutes.node && t.isArrayExpression(asyncRoutes.node)) {
    const asyncTasks: Promise<void>[] = []
    traverse(asyncRoutes.node, {
      ObjectProperty(path) {
        const { node, scope } = path

        if (t.isIdentifier(node.key)) {
          if (t.isIdentifier(node.key, { name: 'children' }) && t.isArrayExpression(node.value)) {
            node.value.elements.forEach((n, index) => {
              if (t.isIdentifier(n)) {
                asyncTasks.push((async () => {
                  const binding = scope.getBinding(n.name)
                  if (binding && binding.path.isImportDefaultSpecifier()) {
                    const importDecl = binding.path.parent
                    const source = importDecl.source.value

                    const resolved = await ctx.resolve(source, id)
                    if (resolved) {
                      const dependency = await ctx.load({ id: resolved.id })

                      if (dependency && dependency.code) {
                        const targetNode = resolveRoutes(dependency.id, dependency.code, { ctx })
                        node.value.elements[index] = targetNode
                      }
                    }
                  }
                })())
              }
            })
          }
        }
      },
    }, asyncRoutes.scope, null, asyncRoutes.parentPath)

    await Promise.all(asyncTasks)

    // console.log(generate(asyncRoutes.node).code)

    // 生成JSON
    // let json
    // traverse(asyncRoutes.node, {
    //   enter(path) {
    //     const { node } = path
    //     if (t.isArrayExpression(node)) {
    //       json = node.elements.map((item) => {})
    //       path.stop()
    //     }
    //   },
    // }, asyncRoutes.scope, null, asyncRoutes.parentPath)
  }

  // return generate(asyncRoutes.node).code
}

export function VitePluginApaasRoutes(): PluginOption {
  return {
    name: 'vite-plugin-apaas-routes',
    apply: 'build',
    async transform(code, id) {
      if (id.endsWith('src/router/routes.ts')) {
        await resolveModule(id, code, { ctx: this, variableName: 'asyncRoutes' })

        return {
          code,
          map: null,
        }
      }
      return null
    },
  }
}
