import { parse as parseVue } from '@vue/compiler-sfc'
import { compile as compileTemplate } from '@vue/compiler-dom'

const directivesMap = new Map<string, string[]>()

/**
 * TODO: 类型先补了any,后续再优化,补充类型就会少遍历节点
 * TODO: 只处理了静态值
 */
function parseDirectives(code: string, id: string) {
  const arr = directivesMap.get(id) || directivesMap.set(id, []).get(id)!

  // 解析 .vue 文件
  const { descriptor } = parseVue(code)
  // 如果没有模板部分，跳过
  if (!descriptor.template)
    return

  // 获取模板内容
  const templateContent = descriptor.template.content

  // 编译模板为 AST
  const { ast } = compileTemplate(templateContent)

  // 快速判断是否有 auth 指令
  if (!ast.directives.includes('auth'))
    return

  function collectInstruction(node: any) {
    // 如果节点有 props，检查其中的指令
    if (node.props) {
      node.props.forEach((prop: any) => {
        if (prop.type === 7 && prop.name === 'auth') {
          arr.push(prop.exp.content.replace(/['"]/g, ''))
        }
      })
    }

    // 如果节点有 children，递归遍历子节点
    if (node.children) {
      node.children.forEach(collectInstruction)
    }

    // 如果节点是 IF (type === 9)，遍历它的 branches
    if (node.type === 9 /* IF */) {
      node.branches.forEach((branch: any) => {
        collectInstruction(branch)
      })
    }

    // 如果节点是 FOR (type === 11)，遍历它的子节点
    if (node.type === 11 /* FOR */) {
      collectInstruction(node.children[0])
    }
  }
  ast.children.forEach(element => collectInstruction(element))
}

export {
  directivesMap,
  parseDirectives,
}
