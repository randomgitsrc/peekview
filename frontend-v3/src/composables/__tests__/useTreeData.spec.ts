import { describe, it, expect } from 'vitest'
import { jsonToTreeData, yamlToTreeData, xmlToTreeData } from '../useTreeData'

// T075 useTreeData — JSON/YAML/XML → TreeDataNode 转换（P2 §3.7）
// 当前红灯：../useTreeData 模块不存在 → import 失败（B 类红灯）
// 注意：本文件不直接 import js-yaml（P4 才安装），YAML 测试只调用 yamlToTreeData() 断言结果

describe('T075 useTreeData JSON 转换（BDD-24）', () => {
  it('test_bdd_24_json_to_tree_data', () => {
    const tree = jsonToTreeData({ name: 'alice', tags: ['a', 'b'], meta: { level: 3 } })
    expect(tree).toBeDefined()
    expect(tree).toBeInstanceOf(Array)
    expect(tree).toHaveLength(3)

    const name = tree.find(n => n.key === 'name')
    expect(name?.type).toBe('string')
    expect(name?.value).toBe('alice')

    const tags = tree.find(n => n.key === 'tags')
    expect(tags?.type).toBe('array')
    expect(tags?.children).toHaveLength(2)

    const meta = tree.find(n => n.key === 'meta')
    expect(meta?.type).toBe('object')
    expect(meta?.children).toHaveLength(1)
  })

  it('test_bdd_24_json_primitives_at_root', () => {
    const tree = jsonToTreeData([1, 'x', true])
    expect(tree).toHaveLength(3)
    expect(tree[0].key).toBe('0')
    expect(tree[1].key).toBe('1')
    expect(tree[2].key).toBe('2')
  })
})

describe('T075 useTreeData YAML 转换（BDD-25）', () => {
  it('test_bdd_25_yaml_to_tree_data', () => {
    const tree = yamlToTreeData('name: alice\nage: 30')
    expect(tree).toBeInstanceOf(Array)
    expect(tree).toHaveLength(2)
    const name = tree.find(n => n.key === 'name')
    expect(name?.value).toBe('alice')
    const age = tree.find(n => n.key === 'age')
    expect(age?.type).toBe('number')
    expect(age?.value).toBe('30')
  })

  it('test_bdd_25_yaml_nested_objects', () => {
    const tree = yamlToTreeData('user:\n  name: bob\n  admin: true')
    const user = tree.find(n => n.key === 'user')
    expect(user?.type).toBe('object')
    expect(user?.children).toHaveLength(2)
  })
})

describe('T075 useTreeData XML 转换（BDD-26）', () => {
  it('test_bdd_26_xml_to_tree_data', () => {
    const tree = xmlToTreeData('<root><item id="1">text</item></root>')
    expect(tree).toBeInstanceOf(Array)
    expect(tree).toHaveLength(1)

    const root = tree[0]
    expect(root.key).toBe('root')
    expect(root.type).toBe('object')
    expect(root.children).toBeDefined()

    const item = root.children!.find(n => n.key === 'item')
    expect(item).toBeDefined()
    expect(item!.children).toBeDefined()

    const attr = item!.children!.find(n => n.key === '@id')
    expect(attr?.value).toBe('1')

    const text = item!.children!.find(n => n.key === '#text')
    expect(text?.value).toBe('text')
  })

  it('test_bdd_26_xml_siblings_merged_into_array', () => {
    const tree = xmlToTreeData('<list><item>a</item><item>b</item></list>')
    const list = tree[0]
    const items = list.children!.filter(n => n.key === 'item')
    expect(items.length).toBe(2)
  })
})

describe('T075 useTreeData 类型标签（BDD-29）', () => {
  it('test_bdd_29_type_labels_all_six_types', () => {
    const tree = jsonToTreeData({
      s: 'x',
      n: 42,
      b: true,
      nil: null,
      o: { k: 1 },
      a: [1],
    })
    const byKey = new Map(tree.map(n => [n.key, n.type]))
    expect(byKey.get('s')).toBe('string')
    expect(byKey.get('n')).toBe('number')
    expect(byKey.get('b')).toBe('boolean')
    expect(byKey.get('nil')).toBe('null')
    expect(byKey.get('o')).toBe('object')
    expect(byKey.get('a')).toBe('array')
  })
})

describe('T075 useTreeData YAML 安全（BDD-32）', () => {
  it('test_bdd_32_yaml_safe_schema_rejects_unsafe_tag', () => {
    // js-yaml SAFE_SCHEMA 拒绝 !!python/object 等自定义标签，转换必须抛错而非执行
    expect(() => yamlToTreeData('a: !!python/object:os.system ["ls"]')).toThrow()
  })
})

describe('T075 useTreeData 空输入（BDD-36）', () => {
  it('test_bdd_36_empty_json_object_no_crash', () => {
    expect(jsonToTreeData({})).toEqual([])
  })

  it('test_bdd_36_empty_json_array_no_crash', () => {
    expect(jsonToTreeData([])).toEqual([])
  })

  it('test_bdd_36_null_json_no_crash', () => {
    expect(jsonToTreeData(null)).toEqual([])
  })
})
