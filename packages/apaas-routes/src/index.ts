import { join, resolve } from 'node:path'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { PluginOption, Rollup } from 'vite'
import consola from 'consola'
import { parse } from '@babel/parser'
import type { NodePath, Scope } from '@babel/traverse'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generate from '@babel/generator'

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
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          targetNode = binding.path.node.init
        }
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
    node?: t.Expression | null
    scope?: Scope
    parentPath?: NodePath
  } = {}

  traverse(ast, {
    ExportSpecifier(path) {
      const { node, scope, parentPath } = path
      if (t.isIdentifier(node.exported, { name: variableName })) {
        if (t.isIdentifier(node.local)) {
          const binding = scope.getBinding(node.local.name)
          if (binding && t.isVariableDeclarator(binding.path.node)) {
            asyncRoutes.node = binding.path.node.init
            asyncRoutes.scope = scope
            asyncRoutes.parentPath = parentPath
          }
        }
      }
    },
  })

  if (!asyncRoutes.node || !t.isArrayExpression(asyncRoutes.node)) {
    return
  }

  const asyncTasks: Promise<void>[] = []

  // 将依赖的模块解析并替换到指定为止
  traverse(asyncRoutes.node, {
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
                if (resolved) {
                  const dependency = await ctx.load({ id: resolved.id })

                  if (dependency && dependency.code) {
                    const targetNode = resolveRoutes(dependency.id, dependency.code)
                    if (t.isArrayExpression(node.value)) {
                      node.value.elements[index] = targetNode!
                    }
                  }
                }
              }
            }
          })())
        })
      }
    },
  }, asyncRoutes.scope, null, asyncRoutes.parentPath)

  await Promise.all(asyncTasks)

  // 遍历并格式化成 apaas 的格式
  traverse(asyncRoutes.node, {
    ObjectExpression(path) {
      const { node } = path

      // sidebar 为 false 时，删除该路由
      const meta = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'meta' }))
      if (meta && t.isObjectProperty(meta) && t.isObjectExpression(meta.value)) {
        const sidebarProperty = meta.value.properties.find((p) => {
          return t.isObjectProperty(p)
            && t.isIdentifier(p.key, { name: 'sidebar' })
            && t.isBooleanLiteral(p.value, { value: false })
        })

        if (sidebarProperty) {
          path.remove()
        }
      }

      // 添加 permType
      const permType = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permType' }))
      if (!permType) {
        node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('sider')))
      }

      // 添加 按钮级路由
      // const children = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' }))
      // const isLeaf = !children || (children && t.isObjectProperty(children) && t.isArrayExpression(children.value) && children.value.elements.length === 0)
      // if (isLeaf && t.isObjectProperty(permType) && t.isStringLiteral(permType.value, { value: 'sidebar' })) {
      //   const _node = cloneDeep(node)
      //   _node.properties.forEach((p) => {
      //     if (t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permType' })) {
      //       p.value = t.stringLiteral('module')
      //     }
      //   })
      //   node.properties.push(t.objectProperty(t.identifier('children'), t.arrayExpression([_node])))
      // }
    },
    ObjectProperty(path) {
      const { node } = path
      if (!t.isIdentifier(node.key)) {
        path.remove()
        return
      }

      // 添加 permPath
      if (t.isIdentifier(node.key, { name: 'path' })) {
        node.key.name = 'permPath'
        if (t.isStringLiteral(node.value) && !node.value.value.startsWith('/')) {
          node.value = t.stringLiteral(`${node.value.value}`)
        }
      }

      // 检查属性是否为 meta，并且该属性是一个对象
      if (t.isIdentifier(node.key, { name: 'meta' }) && t.isObjectExpression(node.value)) {
        // 遍历 meta 对象的属性
        node.value.properties.forEach((property) => {
          if (!t.isObjectProperty(property)) {
            return
          }

          // 添加 permName
          if (t.isIdentifier(property.key, { name: 'title' })) {
            path.insertBefore(t.objectProperty(t.identifier('permName'), property.value))
          }

          // 添加 permCode
          if (t.isIdentifier(property.key, { name: 'auth' })) {
            path.insertBefore(t.objectProperty(t.identifier('permCode'), property.value))
          }
        })

        path.remove()
        return
      }

      const transformKeys = ['permType', 'permPath', 'permName', 'permCode', 'permDes', 'children']
      if (!transformKeys.includes(node.key.name)) {
        path.remove()
      }
    },
  }, asyncRoutes.scope, null, asyncRoutes.parentPath)

  // 生成JSON
  const json = generateApaasJSON(asyncRoutes.node)

  const targetDir = resolve(process.cwd(), 'apaas')
  const outputFileName = resolve(targetDir, 'routes.json')

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(outputFileName, json)
  consola.success(`[vite-plugin-apaas] routes.json has been generated in ${join(targetDir, 'routes.json')}`)
}

function generateApaasJSON(node: t.ArrayExpression) {
  const routes = `[{
    permType: "header",
    permName: "权限管理系统",
    permPath: "/",
    permCode: "",
    permDes: "腾龙权限管理系统",
    picPath: "",
    children: [],
  }]`

  const ast = parse(routes, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  const children: (t.SpreadElement | t.Expression | null)[] = []
  node.elements.forEach((n) => {
    if (!t.isObjectExpression(n)) {
      return
    }
    n.properties.forEach((p) => {
      if (
        t.isObjectProperty(p)
        && t.isIdentifier(p.key, { name: 'children' })
        && t.isArrayExpression(p.value)
      ) {
        p.value.elements.forEach((item) => {
          children.push(item)
        })
      }
    })
  })

  traverse(ast, {
    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: 'children' })
        && t.isArrayExpression(path.node.value)
      ) {
        path.node.value.elements = children
        path.stop()
      }
    },
  })

  // 将数组格式化成JSON的格式
  traverse(ast, {
    ObjectProperty(path) {
      // 将键名转换为字符串
      if (t.isIdentifier(path.node.key)) {
        path.node.key = t.stringLiteral(path.node.key.name)
      }
    },
  })

  return generate(ast).code
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
