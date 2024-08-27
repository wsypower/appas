import { parse as parseVue } from '@vue/compiler-sfc'
import type { TemplateChildNode } from '@vue/compiler-dom'
import { NodeTypes, compile } from '@vue/compiler-dom'

/**
 * TODO: 只处理了静态值
 */
export function parseDirectives(id: string, code: string, directivesMap: Map<string, string[]>) {
  const authCodes = directivesMap.get(id) || directivesMap.set(id, []).get(id)!

  // 解析 .vue 文件
  const { descriptor } = parseVue(code)
  // 如果没有模板部分，跳过
  if (!descriptor.template)
    return

  // 获取模板内容
  const templateContent = descriptor.template.content

  // 编译模板为 AST
  const { ast } = compile(templateContent)

  // 快速判断是否有 auth 指令
  if (!ast.directives.includes('auth'))
    return

  function collectInstruction(node: TemplateChildNode) {
    // 如果节点是 ELEMENT
    if (node.type === NodeTypes.ELEMENT) {
      node.props.forEach((prop) => {
        if (
          prop.type === NodeTypes.DIRECTIVE
          && prop.name === 'auth'
          && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
        ) {
          const propValue = prop.exp.content
          authCodes.push(propValue.replace(/['"]/g, ''))
        }
      })
    }

    // 如果节点是 IF, 遍历它的 branches
    if (node.type === NodeTypes.IF) {
      node.branches.forEach(collectInstruction)
    }

    // 如果节点是 FOR/IF_BRANCH/ELEMENT, 遍历它的子节点
    if (
      node.type === NodeTypes.ELEMENT
      || node.type === NodeTypes.FOR
      || node.type === NodeTypes.IF_BRANCH
    ) {
      node.children.forEach(collectInstruction)
    }
  }

  ast.children.forEach(collectInstruction)
}
