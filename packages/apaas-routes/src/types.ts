import type { NodePath, Scope } from '@babel/traverse'
import type * as t from '@babel/types'

export interface RoutesInfo {
  node?: t.Expression | null
  scope?: Scope
  parentPath?: NodePath
}
