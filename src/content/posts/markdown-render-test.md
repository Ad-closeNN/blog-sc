---
title: Markdown 综合渲染能力测试
published: 2026-03-13
description: 覆盖 Markdown / GFM / 安全 HTML 子集的全面测试页面，用于校验完整排版、字号阶梯、粗体、代码块及表格等渲染效果。
tags: ["Markdown", "测试", "排版", "GFM"]
category: "测试"
showcover: false
aiSummary: "本文是一个全面的 Markdown、GFM 与安全 HTML 子集排版测试页面，用于全面校验文字阶梯、加粗、列表、代码块、引用及表格等各元素的渲染表现。"
aiSummaryModel: "gpt-5-nano"
---

段落测试：这段长文本用于测试普通段落的阅读节奏。一篇技术笔记里常常会混合普通文字、`inline code`、[站内链接](/posts/) 和 [外部链接](https://astro.build)。如果行高、段距和链接样式都合适，读起来应该稳定、清楚，并且不会像默认浏览器样式那样拥挤。

---

## 标题层级对比

# 一级标题 H1：大章节主标题测试 (36px / 2.25rem)

## 二级标题 H2：主要小节说明 (28px / 1.75rem)

### 三级标题 H3：子章节细节描述 (21.6px / 1.35rem)

#### 四级标题 H4：补充辅助信息 (18px / 1.125rem)

---

## 文本样式

- **粗体文本** Bold
- *斜体文本* Italic
- ***粗斜体*** Bold Italic
- ~~删除线~~ Strikethrough
- `行内代码` Inline Code
- 上标：E = mc<sup>2</sup>
- 下标：H<sub>2</sub>O
- 键盘快捷键：<kbd>Ctrl</kbd> + <kbd>K</kbd>，或 <kbd>⌘</kbd> + <kbd>Enter</kbd>

---

## 列表测试

### 无序列表

- 第一项：普通项目
- 第二项：有嵌套内容
  - 嵌套子项 A
  - 嵌套子项 B
    - 更深一层，用于观察缩进是否过大
- 第三项：最后一个项目

### 有序列表

1. 准备测试内容
2. 打开文章详情页
   1. 检查滚动区域
   2. 检查目录 (TOC) 激活状态
   3. 检查 Markdown 样式
3. 记录问题并继续调整

### 任务列表

- [x] 粗体、斜体、删除线
- [x] 表格和任务列表
- [x] 安全 HTML：`sup`、`sub`、`kbd`、`details`
- [ ] 代码高亮与等宽字体
- [ ] 数学公式渲染

---

## 引用块

> 这是一段引用文字。Markdown 的引用可以包含**其他格式**，比如 `inline code` 和 [链接](https://example.com)。
>
> —— 测试用引用来源

> 嵌套引用第一层
>> 第二层引用：用于测试层级缩进
>>> 第三层引用：不应该把布局撑坏

---

## 代码块

```typescript
interface MarkdownTest {
  heading: boolean;
  code: boolean;
  table: boolean;
  safeHtml: boolean;
}

function renderAll(): MarkdownTest {
  return {
    heading: true,
    code: true,
    table: true,
    safeHtml: true,
  };
}
```

```python
def fibonacci(n: int) -> list[int]:
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result
```

```bash
cat /var/log/nginx/access.log \
  | grep " 404 " \
  | awk '{print $1}' \
  | sort | uniq -c | sort -rn \
  | head -20
```

```text
这是一个超长单行代码块测试：aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

---

## 表格

| 特性 | 支持情况 | 备注 |
|------|:------:|------|
| 标题 | ✅ | H1-H4 都应有明确的大小的加粗梯度 |
| 粗体 | ✅ | `**text**` |
| 斜体 | ✅ | `*text*` |
| 删除线 | ✅ | GFM |
| 代码块 | ✅ | 保留语言 class，样式不撑破容器 |
| 表格 | ✅ | 响应式横向滚动 |
| 任务列表 | ✅ | checkbox 对齐 |
| 安全 HTML | ✅ | `sup/sub/kbd/details` |

---

## 折叠区域 (Details)

<details>
<summary>点击展开查看渲染细节说明</summary>

这里是被折叠的内容，可以包含**普通 Markdown**、`inline code` 和列表：

- 折叠内容 1
- 折叠内容 2
- 折叠内容 3

</details>

---

*以上内容覆盖了 Markdown / GFM / 安全 HTML 子集的主要渲染特性。*
