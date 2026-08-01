# v1.2.0 发布计划

```mermaid
gantt
    title PeekView v1.2.0 发布时间线
    dateFormat  YYYY-MM-DD
    axisFormat  %m-%d

    section 开发
    需求冻结       :done,    a1, 2026-07-01, 3d
    后端开发       :active,  a2, 2026-07-04, 10d
    前端开发       :         a3, 2026-07-04, 8d
    MCP 适配       :         a4, 2026-07-10, 5d

    section 测试
    单元测试       :         b1, after a2, 3d
    E2E 测试       :         b2, after a3, 3d
    集成测试       :         b3, after b1, 2d

    section 发布
    文档更新       :         c1, after b3, 2d
    灰度发布       :         c2, after c1, 1d
    正式发布       :milestone, c3, after c2, 0d
```
