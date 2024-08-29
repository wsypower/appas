import * as t from '@babel/types'

/** 判断当前节点的 permType */
export function permTypeIs(
  value: 'sider' | 'module',
  node: t.ObjectExpression,
) {
  return node.properties.some(
    (p): p is t.ObjectProperty & { key: t.Identifier } & { value: t.StringLiteral } => {
      return propertyIs('permType', p) && t.isStringLiteral(p.value, { value })
    },
  )
}

/** 判断当前属性值是否为 children */
export function propertyIsChildren(
  p: t.SpreadElement | t.ObjectMethod | t.ObjectProperty,
): p is t.ObjectProperty & { key: t.Identifier } & { value: t.ArrayExpression } {
  return propertyIs('children', p) && t.isArrayExpression(p.value)
}

/** 判断当前属性值的名字 */
export function propertyIs(
  name: string,
  p: t.SpreadElement | t.ObjectMethod | t.ObjectProperty,
): p is t.ObjectProperty & { key: t.Identifier } {
  return t.isObjectProperty(p) && t.isIdentifier(p.key, { name })
}
