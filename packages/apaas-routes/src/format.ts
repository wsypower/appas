import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generate from '@babel/generator'
import type { RoutesInfo } from './types'

/**
 * @desc: 将 `routes` 格式化成 `apaas` 的要求
 */
export function transformCodeToApaas(routes: RoutesInfo) {
  if (!routes.node || !t.isArrayExpression(routes.node)) {
    return
  }

  // 优先处理 meta
  traverse(
    routes.node,
    {
      ObjectExpression(path) {
        const { node } = path

        const tasks: Array<() => void> = []

        node.properties.forEach((property) => {
          if (
            !t.isObjectProperty(property)
            || !t.isIdentifier(property.key, { name: 'meta' })
            || !t.isObjectExpression(property.value)
          ) {
            return
          }

          // meta.sidebar 为 false
          const sidebarIsFalse = property.value.properties.some((p) => {
            return t.isObjectProperty(p)
              && t.isIdentifier(p.key, { name: 'sidebar' })
              && t.isBooleanLiteral(p.value, { value: false })
          })

          // meta.auth 存在
          const hasAuth = property.value.properties.some((p) => {
            return t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'auth' })
          })

          // 移除路由
          if (sidebarIsFalse && !hasAuth) {
            path.remove()
            return
          }

          // 重命名属性名称
          property.value.properties.forEach((p) => {
            if (!t.isObjectProperty(p)) {
              return
            }

            // 添加 permCode
            if (t.isIdentifier(p.key, { name: 'auth' })) {
              tasks.push(() => {
                node.properties.unshift(t.objectProperty(t.identifier('permCode'), p.value))
              })
            }

            // 添加 permName
            if (t.isIdentifier(p.key, { name: 'title' })) {
              tasks.push(() => {
                node.properties.unshift(t.objectProperty(t.identifier('permName'), p.value))
              })
            }
          })

          // 将该路由设置成按钮级路由
          if (sidebarIsFalse && hasAuth) {
            tasks.push(() => {
              node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('module')))
            })
          }
        })

        tasks.forEach(task => task())

        // 移除 meta
        node.properties = node.properties.filter((p) => {
          return !(t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'meta' }))
        })
      },
    },
    routes.scope,
    null,
    routes.parentPath,
  )

  traverse(
    routes.node,
    {
      ObjectExpression(path) {
        const { node } = path

        // children 为空数组时，移除 children 字段
        node.properties = node.properties.filter((property) => {
          return !(t.isObjectProperty(property)
            && t.isIdentifier(property.key, { name: 'children' })
            && t.isArrayExpression(property.value)
            && (property.value.elements.length === 0))
        })

        // 添加 permPath
        node.properties.forEach((property) => {
          // 重命名 path 为 permPath
          if (
            !t.isObjectProperty(property)
            || !t.isIdentifier(property.key, { name: 'path' })
            || !t.isStringLiteral(property.value)
          ) {
            return
          }
          property.key.name = 'permPath'

          // 拼接 permPath
          if (property.value.value.startsWith('/')) {
            return
          }
          const parentPath = path.findParent(p => p.isObjectExpression())
          if (parentPath && t.isObjectExpression(parentPath.node)) {
            const parentRoutePathProperty = parentPath.node.properties.find((p) => {
              return t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permPath' }) && t.isStringLiteral(p.value)
            })
            if (
              parentRoutePathProperty
              && t.isObjectProperty(parentRoutePathProperty)
              && t.isStringLiteral(parentRoutePathProperty.value)
            ) {
              const routePath = `${parentRoutePathProperty.value.value}/${property.value.value}`.replace('\/\/', '\/')
              property.value = t.stringLiteral(routePath)
            }
          }
        })

        // 添加 permType
        const permTypeProperty = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permType' }))
        if (!permTypeProperty) {
          node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('sider')))
        }

        // 判断是否为菜单级路由
        if (node.properties.find(p =>
          t.isObjectProperty(p)
          && t.isIdentifier(p.key, { name: 'permType' })
          && t.isStringLiteral(p.value, { value: 'sider' }))
        ) {
          // 如果是菜单级路由的最后一级，则为其 children 添加同名按钮级路由
          const childrenProperty = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' }))
          const moduleNode = t.cloneNode(node)
          moduleNode.properties = moduleNode.properties.filter((p) => {
            return !(
              t.isObjectProperty(p)
              && t.isIdentifier(p.key)
              && ['permPath', 'permType', 'children'].includes(p.key.name)
            )
          })
          moduleNode.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('module')))
          if (
            childrenProperty
            && t.isObjectProperty(childrenProperty)
            && t.isIdentifier(childrenProperty.key, { name: 'children' })
            && t.isArrayExpression(childrenProperty.value)
            && childrenProperty.value.elements.every((node) => {
              return t.isObjectExpression(node)
                && node.properties.find((p) => {
                  return t.isObjectProperty(p)
                    && t.isIdentifier(p.key, { name: 'permType' })
                    && t.isStringLiteral(p.value, { value: 'module' })
                })
            })
          ) {
            childrenProperty.value.elements.unshift(moduleNode)
          }
          if (!childrenProperty) {
            node.properties.push(t.objectProperty(t.identifier('children'), t.arrayExpression([moduleNode])))
          }

          // 菜单级路由移除 permCode
          node.properties = node.properties.filter((p) => {
            return !(t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permCode' }))
          })
        }

        // 判断是否为按钮级菜单
        if (node.properties.find(p =>
          t.isObjectProperty(p)
          && t.isIdentifier(p.key, { name: 'permType' })
          && t.isStringLiteral(p.value, { value: 'module' }))
        ) {
          node.properties = node.properties.filter((p) => {
            return !(t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permPath' }))
          })
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
 * @desc: 将格式化后 `ast` 放入到特定的JSON
 */
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

  // 去掉最外层的数组，只返回对象
  const code = generate(ast).code
  return code.replace(/^\[\s*|\s*\];?$/g, '')
}
