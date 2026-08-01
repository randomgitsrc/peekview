import type { Ref } from 'vue'

export const TreeExpandKey: unique symbol = Symbol('tree-expand')

export interface TreeExpandContext {
  expandedPaths: Ref<Set<string>>
  togglePath: (path: string) => void
}
