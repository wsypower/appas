import type { NodePath, Scope } from '@babel/traverse'
import type * as t from '@babel/types'

export interface Options {
  /** 读取的文件路径 */
  filePath?: string
  /** 读取的变量名，需在文件中 export */
  variableName?: string
}

export interface RoutesInfo {
  node?: t.Expression | null
  scope?: Scope
  parentPath?: NodePath
}
