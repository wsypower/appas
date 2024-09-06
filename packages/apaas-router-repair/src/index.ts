import type { PluginOption } from 'vite'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import generator from '@babel/generator'
import consola from 'consola'

/**
 * Checks if a property is the `meta.auth` property.
 *
 * @param {t.ObjectProperty} prop - The property node to check.
 * @returns {boolean} Returns true if the property is `meta.auth`, false otherwise.
 */
function isMetaAuthProperty(prop: t.ObjectProperty) {
  return t.isIdentifier(prop.key, { name: 'auth' })
}

/**
 * Removes the `auth` property from the `meta` object if it exists.
 *
 * If `meta.auth` is found, it logs an error message and removes the property.
 *
 * @param {t.ObjectExpression} metaObject - The `meta` object expression.
 */
function removeAuthFromMeta(metaObject: t.ObjectExpression) {
  metaObject.properties = metaObject.properties.filter(
    (metaProp) => {
      const flag = !(t.isObjectProperty(metaProp) && isMetaAuthProperty(metaProp))
      if (!flag) {
        isError(metaObject)
      }
      return flag
    },
  )
}

/**
 * Determines if the given node is an array representing `asyncRoutes`.
 *
 * @param {t.Node} path - The AST node to check.
 * @returns {boolean} Returns true if the node is an `ArrayExpression`.
 */
function isAsyncRoutesArray(path: t.Node) {
  return t.isArrayExpression(path)
}

/**
 * Retrieves the `title` property value from the `meta` object.
 *
 * @param {t.ObjectExpression} metaObject - The `meta` object expression.
 * @returns {string|null} Returns the value of `meta.title`, or null if not found.
 */
function getTitleFromMeta(metaObject: t.ObjectExpression): string | null {
  const titleProp = metaObject.properties.find(
    prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: 'title' }),
  )

  if (titleProp && t.isObjectProperty(titleProp) && t.isStringLiteral(titleProp.value)) {
    return titleProp.value.value
  }

  return null
}

/**
 * Logs an error if `meta.auth` is found, specifying the route's title.
 *
 * @param {t.ObjectExpression} metaObject - The `meta` object expression containing the `auth` property.
 */
function isError(metaObject: t.ObjectExpression) {
  const title = getTitleFromMeta(metaObject)
  consola.error(`在一级应用：${title}中发现auth属性，已自动在编译器中移除，请不要在一级权限中添加auth属性`)
}

/**
 * Vite Plugin to modify `asyncRoutes` and remove `meta.auth` properties.
 *
 * This plugin processes the routes defined in `src/router/routes.ts` and removes any
 * `meta.auth` property from the top-level routes to ensure that `auth` is not misused.
 *
 * @returns {PluginOption} Returns the Vite plugin configuration.
 */
export function VitePluginApaasRouterRepair(): PluginOption {
  return {
    name: 'vite-plugin-apaas-router-repair',
    apply: 'build',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('src/router/routes.ts'))
        return null

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      })

      traverse(ast, {
        VariableDeclarator(path) {
          // Ensure we're only working with the asyncRoutes array
          if (!t.isIdentifier(path.node.id, { name: 'asyncRoutes' }))
            return

          const init = path.node.init
          if (!isAsyncRoutesArray(init!))
            return

          // Iterate over each element in the asyncRoutes array
          init.elements.forEach((element) => {
            if (!t.isObjectExpression(element))
              return

            // Process each element's meta property
            element.properties.forEach((prop) => {
              if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key, { name: 'meta' }))
                return

              const metaObject = prop.value
              if (!t.isObjectExpression(metaObject))
                return
              // Remove the meta.auth property
              removeAuthFromMeta(metaObject)
            })
          })
        },
      })

      const output = generator(ast, {
        sourceMaps: true,
        sourceFileName: id,
      })
      return {
        code: output.code,
        map: output.map,
      }
    },
  }
}
