import { load } from 'js-yaml'
import type { TreeDataNode, NodeType } from '@/types/structured-data'

export function jsonToTreeData(data: unknown): TreeDataNode[] {
  if (data === null || typeof data !== 'object') return []
  const entries: [string, unknown][] = Array.isArray(data)
    ? data.map((value, index) => [String(index), value])
    : Object.entries(data)
  return entries.map(([key, value]) => toNode(key, value, key))
}

export function yamlToTreeData(content: string): TreeDataNode[] {
  const data = load(content)
  return jsonToTreeData(data)
}

export function xmlToTreeData(content: string): TreeDataNode[] {
  const doc = new DOMParser().parseFromString(content, 'application/xml')
  const root = doc.documentElement
  if (!root || root.tagName === 'parsererror') {
    throw new Error('XML 解析失败：内容不是有效的 XML')
  }
  return [xmlElementToNode(root, root.tagName)]
}

function toNode(key: string, value: unknown, path: string): TreeDataNode {
  if (value === null) {
    return { key, value: 'null', type: 'null', path }
  }
  if (Array.isArray(value)) {
    return {
      key,
      value: '',
      type: 'array',
      path,
      children: value.map((child, index) => toNode(String(index), child, `${path}/${index}`)),
    }
  }
  if (typeof value === 'object') {
    return {
      key,
      value: '',
      type: 'object',
      path,
      children: Object.entries(value as Record<string, unknown>).map(([k, v]) => toNode(k, v, `${path}/${k}`)),
    }
  }
  const type: NodeType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
  return { key, value: String(value), type, path }
}

function xmlElementToNode(el: Element, path: string): TreeDataNode {
  const children: TreeDataNode[] = []

  for (const attr of Array.from(el.attributes)) {
    children.push({
      key: `@${attr.name}`,
      value: attr.value,
      type: 'string',
      path: `${path}/@${attr.name}`,
    })
  }

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element
      children.push(xmlElementToNode(element, `${path}/${element.tagName}`))
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim()
      if (text) {
        children.push({ key: '#text', value: text, type: 'string', path: `${path}/#text` })
      }
    }
  }

  return { key: el.tagName, value: '', type: 'object', path, children }
}
