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

  traverse(
    routes.node,
    {
      ObjectExpression(path) {
        const { node } = path

        const metaProperty = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'meta' }))
        if (metaProperty && t.isObjectProperty(metaProperty) && t.isObjectExpression(metaProperty.value)) {
          // sidebar 为 false 时，删除该路由
          const sidebarProperty = metaProperty.value.properties.find((p) => {
            return t.isObjectProperty(p)
              && t.isIdentifier(p.key, { name: 'sidebar' })
              && t.isBooleanLiteral(p.value, { value: false })
          })

          if (sidebarProperty) {
            path.remove()
          }

          // 重命名属性名称
          metaProperty.value.properties.forEach((p) => {
            if (!t.isObjectProperty(p)) {
              return
            }

            // 添加 permCode
            if (t.isIdentifier(p.key, { name: 'auth' })) {
              node.properties.unshift(t.objectProperty(t.identifier('permCode'), p.value))
            }

            // 添加 permName
            if (t.isIdentifier(p.key, { name: 'title' })) {
              node.properties.unshift(t.objectProperty(t.identifier('permName'), p.value))
            }
          })

          // 移除 meta
          node.properties = node.properties.filter((p) => {
            return !(t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'meta' }))
          })
        }

        // 添加 permPath
        node.properties.forEach((p) => {
          if (t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'path' })) {
            p.key.name = 'permPath'

            if (t.isStringLiteral(p.value) && !p.value.value.startsWith('/')) {
              const parentPath = path.findParent(p => p.isObjectExpression())
              if (parentPath && t.isObjectExpression(parentPath.node)) {
                const parentRoutePathProperty = parentPath.node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permPath' }))
                if (
                  parentRoutePathProperty
                  && t.isObjectProperty(parentRoutePathProperty)
                  && t.isStringLiteral(parentRoutePathProperty.value)
                ) {
                  const routePath = `${parentRoutePathProperty.value.value}/${p.value.value}`.replace('\/\/', '\/')
                  p.value = t.stringLiteral(routePath)
                }
              }
            }
          }
        })

        // 添加 permType
        const permTypeProperty = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permType' }))
        if (!permTypeProperty) {
          node.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('sider')))

          // 如果是叶子节点，则为其添加按钮级路由
          const children = node.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' }))
          const isLeaf = !children || (children && t.isObjectProperty(children) && t.isArrayExpression(children.value) && children.value.elements.length === 0)
          if (isLeaf) {
            const leafNode = t.cloneNode(node)
            leafNode.properties = leafNode.properties.filter((p) => {
              if (t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permPath' })) {
                return false
              }
              if (t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permType' })) {
                return false
              }
              return true
            })
            leafNode.properties.unshift(t.objectProperty(t.identifier('permType'), t.stringLiteral('module')))
            node.properties.push(t.objectProperty(t.identifier('children'), t.arrayExpression([leafNode])))
          }

          // 菜单级路由移除 permCode
          node.properties = node.properties.filter((p) => {
            return !(t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'permCode' }))
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
