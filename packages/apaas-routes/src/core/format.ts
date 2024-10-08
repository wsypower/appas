import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generate from '@babel/generator'
import prettier from 'prettier'
import type { RoutesInfo } from '../types'
import { permTypeIs, propertyIs, propertyIsChildren } from './utils'
import CONFIG from './config'
/**
 * 将 `routes` 格式化成 `apaas` 的要求
 */
export function transformCodeToApaas(
  routes: RoutesInfo,
  directivesMap: Map<string, string[]>,
  excludes: string[] = [],
) {
  if (!routes.node || !t.isArrayExpression(routes.node)) {
    return
  }

  // 优先处理 meta
  traverse(
    routes.node,
    {
      ObjectExpression(path) {
        const { node } = path

        // 根据 meta.auth 和 excludes 判断是否移除该路由
        node.properties.forEach((property) => {
          if (
            propertyIs('meta', property)
            && t.isObjectExpression(property.value)
            && property.value.properties.some((p) => {
              return propertyIs('auth', p)
                && t.isStringLiteral(p.value)
                && excludes.includes(p.value.value)
            })
          ) {
            path.remove()
          }
        })

        const tasks: Array<() => void> = []

        node.properties.forEach((property) => {
          if (!(propertyIs('meta', property) && t.isObjectExpression(property.value))) {
            return
          }

          // meta.sidebar 为 false
          const sidebarIsFalse = property.value.properties.some((p) => {
            return propertyIs('sidebar', p) && t.isBooleanLiteral(p.value, { value: false })
          })

          // meta.auth 存在
          const hasAuth = property.value.properties.some(p => propertyIs('auth', p))

          // 重命名属性名称
          property.value.properties.forEach((p) => {
            // 添加 permCode
            if (propertyIs('auth', p)) {
              tasks.push(() => {
                node.properties.unshift(t.objectProperty(t.identifier('permCode'), p.value))
              })
            }

            // 添加 permName
            if (propertyIs('title', p)) {
              tasks.push(() => {
                node.properties.unshift(t.objectProperty(t.identifier('permName'), p.value))
              })
            }
          })

          // 添加 permType
          if (sidebarIsFalse) {
            // 非菜单路由则设置 permType 为 module
            tasks.push(() => {
              node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('module')))
            })

            // 如果没有配置 meta.auth，则加上删除标识符
            if (!hasAuth) {
              tasks.push(() => {
                node.properties.unshift(t.objectProperty(t.identifier('DELETE'), t.booleanLiteral(true)))
              })
            }
          }
          else {
            // 菜单路由则设置 permType 为 sider
            tasks.push(() => {
              node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('sider')))
            })
          }
        })

        tasks.forEach(task => task())

        // 移除 meta
        node.properties = node.properties.filter(p => !propertyIs('meta', p))
      },
    },
    routes.scope,
    null,
    routes.parentPath,
  )

  // 格式化为指定数据结构
  traverse(
    routes.node,
    {
      ObjectExpression(path) {
        const { node } = path

        // children 为空数组时，移除 children 字段
        node.properties = node.properties.filter((p) => {
          return !(propertyIsChildren(p) && (p.value.elements.length === 0))
        })

        // 添加 permPath
        node.properties.forEach((property) => {
          // 重命名 path 为 permPath
          if (!(propertyIs('path', property) && t.isStringLiteral(property.value))) {
            return
          }

          property.key.name = 'permPath'

          // permPath 不为 / 开头时，拼接父级的 permPath
          if (property.value.value.startsWith('/')) {
            return
          }
          const parentPath = path.findParent(p => p.isObjectExpression())
          if (!(parentPath && t.isObjectExpression(parentPath.node))) {
            return
          }
          const propertyPathValue = property.value.value
          parentPath.node.properties.forEach((p) => {
            if (propertyIs('permPath', p) && t.isStringLiteral(p.value)) {
              const routePath = `${p.value.value}/${propertyPathValue}`.replace('\/\/', '\/')
              property.value = t.stringLiteral(routePath)
            }
          })
        })

        // 判断是否为菜单级路由
        if (permTypeIs('sider', node)) {
          // 如果是菜单级路由有 permCode，则往它的 children 添加一个同名的按钮级路由
          if (node.properties.some(p => propertyIs('permCode', p))) {
            const moduleNode = t.cloneNode(node)
            moduleNode.properties = moduleNode.properties.filter((p) => {
              return !(
                t.isObjectProperty(p)
                && t.isIdentifier(p.key)
                && ['permPath', 'permType', 'children', 'component'].includes(p.key.name))
            })
            moduleNode.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('module')))

            // 添加到按钮级路由至 children
            const childrenProperty = node.properties.find(propertyIsChildren)

            if (childrenProperty) {
              childrenProperty.value.elements.unshift(moduleNode)
            }
            else {
              node.properties.push(t.objectProperty(t.identifier('children'), t.arrayExpression([moduleNode])))
            }
          }

          // 菜单级路由移除 permCode
          node.properties = node.properties.filter(p => !propertyIs('permCode', p))
        }

        // 判断是否为按钮级菜单
        if (permTypeIs('module', node)) {
          node.properties = node.properties.filter(p => !propertyIs('permPath', p))
        }

        // 读取 component，并从中将其用到的 v-auth 作为按钮级路由添加进 children
        node.properties.forEach((property) => {
          if (
            propertyIs('component', property)
            && t.isArrowFunctionExpression(property.value)
            && t.isCallExpression(property.value.body)
            && t.isArrowFunctionExpression(property.value.body.arguments[0])
            && t.isCallExpression(property.value.body.arguments[0].body)
            && t.isStringLiteral(property.value.body.arguments[0].body.arguments[0])
          ) {
            const component = property.value.body.arguments[0].body.arguments[0].value.replace(/^(@|\.\.|\.)*/, '')
            let authCodes: string[] = []
            for (const [id, value] of directivesMap) {
              if (id.includes(component)) {
                authCodes = value ?? []
                break
              }
            }

            const codeNodes = authCodes.map((code) => {
              return t.objectExpression([
                t.objectProperty(t.identifier('permType'), t.stringLiteral('module')),
                t.objectProperty(t.identifier('permCode'), t.stringLiteral(code)),
                t.objectProperty(t.identifier('permName'), t.stringLiteral(code)),
              ])
            })

            const childrenProperty = node.properties.find(propertyIsChildren)

            // 如果当前是菜单级路由, 则往它的 children 添加
            if (permTypeIs('sider', node) && childrenProperty) {
              childrenProperty.value.elements.push(...codeNodes)
            }

            // 如果当前是按钮级路由，则往父级的 children 添加
            if (permTypeIs('module', node)) {
              const parentPath = path.findParent(p => p.isObjectExpression())
              if (parentPath && t.isObjectExpression(parentPath.node)) {
                parentPath.node.properties.forEach((p) => {
                  if (propertyIsChildren(p)) {
                    p.value.elements.push(...codeNodes)
                  }
                })
              }
            }
          }
        })

        // 移除具有DELETE标识符的路由
        if (
          node.properties.some(p => propertyIs('DELETE', p)
          && t.isBooleanLiteral(p.value, { value: true }))
        ) {
          path.remove()
        }
      },
      ObjectProperty(path) {
        const { node } = path
        const transformKeys = ['permType', 'permPath', 'permName', 'permCode', 'permDes', 'children']

        // 移除多余的属性
        if (!t.isIdentifier(node.key) || !transformKeys.includes(node.key.name)) {
          path.remove()
        }
      },
    },
    routes.scope,
    null,
    routes.parentPath,
  )

  return generateApaasJSON(routes.node)
}

/**
 * 将格式化后 `ast` 放入到特定的JSON
 */
async function generateApaasJSON(node: t.ArrayExpression) {
  const title = CONFIG.title ?? '权限管理系统'
  const routes = `[{
    permType: "header",
    permName: "${title}",
    permPath: "/",
    permCode: "",
    permDes: "${title}",
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
      if (propertyIsChildren(p)) {
        p.value.elements.forEach((item) => {
          children.push(item)
        })
      }
    })
  })

  traverse(ast, {
    ObjectProperty(path) {
      if (propertyIsChildren(path.node)) {
        path.node.value.elements = children
        path.stop()
      }
    },
  })

  // 将数组格式化成JSON的格式
  traverse(ast, {
    enter(path) {
      // 移除前导注释
      if (path.node.leadingComments) {
        path.node.leadingComments = null
      }
      // 移除尾随注释
      if (path.node.trailingComments) {
        path.node.trailingComments = null
      }
    },
    ObjectProperty(path) {
      // 将键名转换为字符串
      if (t.isIdentifier(path.node.key)) {
        path.node.key = t.stringLiteral(path.node.key.name)
      }
    },
  })

  // 去掉最外层的数组，只返回对象
  const code = generate(ast).code.replace(/^\[\s*|\s*\];?$/g, '')
  const prettierCode = await prettier.format(code, { parser: 'json' })
  return prettierCode
}
