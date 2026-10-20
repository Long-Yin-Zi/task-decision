# task-decision · 右侧面板 UI 规范

> 版本 v1.0 · 适用 `client.js` 0.3.x · 面板宽 360–420px、高度满屏
> 本文只写**视觉 + 文案 + 状态契约**，不改任何代码。落地方式：按第 8 节附录 A 整段替换现有 `CSS` + `CSS2`。
> 只使用宿主提供的 alias token；硬编码颜色仅允许 `rgba(0,0,0,x)` 阴影与 `transparent` 混色。

---

## 0. 一页结论

### 0.1 现状诊断（三个真问题）

| 用户原话 | 真实原因 | 本规范的处理 |
|---|---|---|
| 「里面现在有英文」 | `client.js` 里 `zh` 字典定义了但没被使用；`makeT` 用 `ctx.locale.bind(NS)`，而 `locale/zh.json` 只有 `meta` 一个键。缺 key 时 `t(key)` 返回 key 本身 → 面板顶部显示 `summary`、`questions`、`single`、`note`、`overall`，页头按钮显示 `launcher`。另外 `zh` 字典里 `selectOne: 'single'`、`selectMany: 'multi'` 本身也是英文值。 | 第 2.3 节给出**全量中文文案表**（key → 中文，一个字都不留英文）；兜底规则改为「缺 key 用中文兜底句，禁止回退成 key」。 |
| 「布局也可以再优化」 | 面板里同时存在：圆角 12/14、边框、卡片阴影、左侧 3px 色条、渐变底、11px 字距 0.5px 的英文式小标题 —— 所有元素都在抢注意力，等于没有层级；且 `CSS` 之上又叠了一层 `CSS2` 覆盖，间距靠补丁。 | 建立单一层级：**填充卡（摘要）→ 描边卡（问题）→ 控件（选项）**；一套 4/6/8/10/12/16/20 间距阶梯；删掉 `CSS2`，只留一个 `<style>`。 |
| 「提交区在滚动里不好找」 | `.wg-actions` 是 `position:sticky; bottom:-1px`，贴在滚动容器**内部**，同时盖了一层渐变。长列表时底栏与内容互相压、边缘出现第二道线，滚动到底还多出一截。 | 改为 **flex 三行**：头固定、只有中间 `overflow:auto`、底栏是滚动容器之外的兄弟节点。按钮永远在最底部，不需要 `sticky`、不需要 `bottom:-1px` 补丁。 |

### 0.2 三条最关键的设计决策（先看这三条，其余都是它的展开）

1. **只让中间滚动。** 头 44px、底 60–80px 是 flex 兄弟，不参与滚动、不做 sticky 叠加。任何滚动位置都能看到「提交拍板」，也不会和宿主的 pane 滚动容器打架。
2. **主按钮用反色，不用品牌色大按钮。** 底色 `--dsw-alias-label-primary`、文字 `--dsw-alias-bg-base`：亮色是深色按钮，暗色自动变成浅色按钮，零硬编码、零对比度事故，也不用阴影霓虹。品牌蓝只保留给 focus ring 和「已选」。
3. **颜色只表达三种状态，且互不兼职。** `accent` = 已选 / 进度；`warn` = 还没选完（校验）；`error` = 发送失败（异常）；`success` = 已提交。颜色不重复表达同一件事之外的含义，用户扫一眼就知道"哪里还欠东西、哪里真出错了"。

### 0.3 设计原则（判断一切争议的尺子）

- **一个面板只有一个焦点**：眼睛先落到「待拍板问题 3 / 已选 1/3」，再落到没选完的那张卡，最后落到按钮。
- **层级靠底色差 + 1px 边线，不靠阴影和色条。** 全面板只有主按钮允许一处阴影。
- **中文优先**：不写全大写英文小标题、不加字距模拟「标签感」、技术标识（q1、a、b）不上屏。
- **状态不用弹窗。** 所有校验/失败/成功都在原位解释，并保留用户已填内容。

---

## 1. 布局骨架

### 1.1 结构图（示意，不按像素）

```
┌────────────────────────────────────────────┐  ← 面板 360–420px / 高 100%
│ 待拍板 [3 题]                     ✓ 已提交   │  H 44  固定头（border-bottom）
├────────────────────────────────────────────┤  1px --dsw-alias-border-l1
│                                            │
│  本轮摘要                                    │  标签 12/18
│  ┌──────────────────────────────────────┐  │
│  │▎本轮做了 A、发现 B，已改成 C。         │  │  摘要卡：10/12/11/14
│  │▎下一轮准备 D。                         │  │  r10 · bg-layer-1
│  └──────────────────────────────────────┘  │
│                    ↕ 16                    │  区块间距
│  待拍板问题 [3]              已选 1/3       │  组头 18（下 8）
│  ▬▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │  进度条 2（下 12）
│  ┌──────────────────────────────────────┐  │
│  │ [1] 用哪种缓存方案？          [单选]   │  │  问题卡：12/13 · r10
│  │     需要你定内存还是 Redis…            │  │  描述缩进 28
│  │  ┌────────────────────────────────┐  │  │
│  │  │ ◉ 内存缓存（快，受进程限制）      │  │  │  选项 ≥40 / 9·11 · r8
│  │  └────────────────────────────────┘  │  │
│  │   ┆ 给这个选项补一句（可选）           │  │  备注 32 / 缩进 25+10
│  │  ┌────────────────────────────────┐  │  │
│  │  │ ○ Redis（跨实例，要运维）         │  │  │
│  │  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘  │  卡间 10
│  …                                         │
│  ＋ 其他补充（可选）                         │  32（可展开）
│                                            │
├────────────────────────────────────────────┤  1px border-l1
│ 还有 2 题没选                  全部清空      │  状态行 16
│ ┌────────────────────────────────────────┐ │
│ │               提交拍板                  │ │  主按钮 36 · r8
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘  footer 58–104px
```

DOM 骨架（`h()` 结构，仅三行）：

```
.wg-wrap[data-phase]
├─ .wg-head        （固定）
├─ .wg-scroll      （唯一滚动容器：摘要 → 问题组 → 其他补充）
└─ .wg-foot        （固定：状态行 / 错误条 / 主按钮 或 完成条）
```

### 1.2 尺寸表

| 区域 | 高度 | 内边距 | 间距 | 备注 |
|---|---|---|---|---|
| `.wg-wrap` | 100% | — | — | `display:flex; flex-direction:column; min-height:0` |
| `.wg-head` | 44px（`flex:0 0 auto`） | `0 16px` | gap 8 | 底边 1px `border-l1` |
| `.wg-scroll` | `flex:1 1 auto; min-height:0` | `14px 16px 20px` | 区块间 16 | `overflow-y:auto`，唯一滚动处 |
| 区块标签 `.wg-label` | 18px | 0 | 下 6 | 12/18/600 |
| 摘要卡 `.wg-sum` | auto（≥52） | `10px 12px 11px 14px` | — | r10，左侧 2px accent 条 |
| 问题组头 `.wg-qhead` | 18px | 0 | 下 8 | 左标签 + 右进度 |
| 进度条 `.wg-track` | 2px | 0 | 下 12 | 轨道 `border-l1`，填充 accent |
| 问题卡 `.wg-q` | auto | `12px 13px` | 卡间 10 | r10，透明底 + 1px 描边 |
| 题头 `.wg-q-top` | 20–42px（标题 2 行封顶） | 0 | 下 2 | 徽标 20 + gap 8 |
| 描述 `.wg-q-prompt` | auto | 0 | 上 2 | 左缩进 28 |
| 选项 `.wg-opt` | ≥40px | `9px 11px` | 选项间 6，上 10 | r8，整行可点 |
| 备注 `.wg-note` | 32px | `0 9px` | 上 6，左缩进 25 | r6，与选项同级而非嵌套 |
| 其他补充 | 32 / ≥64（展开） | `0 2px` / `8px 10px` | 上 0 | 默认收起为一行 |
| `.wg-foot` | 58（只有完成条）/ 80（常态）/ 104（错误条） | `10px 16px 12px` | 行间 6 | 顶边 1px `border-l1` |
| 主按钮 | 36px | — | — | 全宽，r8 |

宽度断点：

| 面板宽 | 左右 padding | 卡内 padding | 说明 |
|---|---|---|---|
| 360–399 | 16 | `12 13` | 基准值，设计以 360 校验 |
| 400–420 | 16 | `12 14` | 只加 1px 内边距，不放大字号 |
| < 360（宿主极端情况） | 12 | `10 11` | 字号不变；主按钮仍全宽；禁止出现横向滚动 |

### 1.3 滚动策略（四条硬规则）

1. 根节点 `height:100%; min-height:0; display:flex; flex-direction:column`；**只有** `.wg-scroll` 写 `overflow-y:auto`。
2. 头与底是 flex 兄弟，**不写 `position:sticky`**。理由：宿主可能已经把 tab 内容包在自己的滚动容器里，双层 sticky 会形成双滚动条、并在底栏上沿叠出第二道线（这就是现在「底部怪怪的」的来源）。
3. 滚动区底部留 20px：让最后一张卡的 `focus-visible` 外描边不被裁；`overscroll-behavior:contain` 防止滚到底带动整页。
4. 若实测宿主 tab 容器没有确定高度（`height:100%` 塌陷），不要改结构：给 `.wg-wrap` 加 `position:absolute; inset:0`（父级 `position:relative`）即可，仍然只有中间滚动。

滚动条：`width:10px`，thumb 用 `color-mix(in srgb, label-tertiary 30%, transparent)` 做 3px 透明边框内缩；hover 提到 46%。暗色下不另调。

### 1.4 层级与「反花哨」约束

- 面板内不写 `z-index`：底栏靠 DOM 顺序压在滚动内容之上；不存在浮层、弹层、自绘 tooltip。
- 表达层级只用三种手段：底色差（base / layer-1 / layer-2）、1px 边线（l1 / l2）、半透明 tint。
- **禁止**：卡片投影（主按钮除外）、渐变背景（底栏遮罩除外）、左侧粗色条 >2px、hover 放大、毛玻璃滥用。
- 全面板 emoji 数量 = 0；勾选、对勾、空状态图标全部用 CSS 形状画（见 3.4 / 3.8）。

---

## 2. 排版系统

### 2.1 字号阶梯（只有这 7 档，不许临时加）

| 角色 | size / line-height | weight | 颜色 | 用在哪 |
|---|---|---|---|---|
| 面板标题 | 14 / 20 | 600 | `label-primary` | 固定头左侧「待拍板」 |
| 问题标题 | 13.5 / 21 | 600 | `label-primary` | 题卡标题，最多 2 行 |
| 正文 | 13 / 22（1.69） | 400 | `label-primary` | 本轮摘要；选项文字 13/20 |
| 次级正文 | 12.5 / 20 | 400 | `label-secondary` | 题干描述、备注、补充输入、完成条 |
| 标签 / 状态 | 12 / 18 | 600 | `label-secondary` | 区块标签（本轮摘要 / 待拍板问题） |
| 元信息 | 11.5 / 16 | 400 | `label-tertiary` | 状态行、页头 flag、提示句 |
| 计数 | 11 / 16 | 500–600 | `label-tertiary`（进度）/ `label-secondary`（chip） | 「已选 1/3」「3 题」；`tabular-nums` |
| 类型标签 | 11 / 16 | 500 | `label-tertiary` | 「单选」「多选」 |
| 徽标 | 11 / 1 | 600 | accent / secondary | 题号 1、2、3；`tabular-nums` |
| 按钮 | 13 / 1 | 600 | `bg-base`（反色） | 主按钮 |
| 错误条 | 11.5 / 17 | 600 标题 / 400 正文 | `label-primary` + `label-secondary` | 「提交失败」+ 具体原因（≤2 行） |

### 2.2 中文排版规则（10 条，写 CSS 时逐条对照）

1. **禁止全大写、禁止 `letter-spacing` 造字距**。中文加字距只会糊；小标题靠 12/600 + 次级色建立层级，不靠「标签感」。
2. 中文正文行高 ≥ 1.6（本规范 13/22、12.5/20）；`line-height:1` 只允许出现在按钮、徽标这类单行元素上。
3. 数字用 `font-variant-numeric: tabular-nums`；中英文/数字之间留半角空格：「已选 2/3」「共 3 题」「还有 2 题没选」。
4. 标点：句内用全角「，。：；」，引号用「」『』，省略号用「…」而不是 `...`，分隔用「·」且两侧各一个半角空格。
5. 按钮 2–4 字、动词开头：「提交拍板」「重新提交」「全部清空」；不使用「确定 / 好的 / OK」。
6. 不用感叹号、不用颜文字、不用 emoji 当图标（面板内 0 emoji）。
7. 技术标识不上屏：不显示 `q1` / `a` / `b` / `single` / `multi`。题号显示为 1、2、3，类型显示为「单选」「多选」。
8. 强调只用两种：字重 600，或颜色（accent / error）。选中态**不改字重**（避免 CJK 字宽变化导致抖动），只改边框 + 底色 + 指示器。
9. 英文/URL/长串用 `overflow-wrap:anywhere` 兜底，不允许撑出横向滚动。
10. 行宽天然受面板限制（约 24–26 个汉字），不要人为限宽；描述类文字不做截断（用户要靠它做决定），只有标题允许 2 行截断并挂 `title` 属性。

### 2.3 文案表（**唯一**允许上屏的中文；禁止英文值）

| key | 中文 | 位置 | 备注 |
|---|---|---|---|
| `tab.title` | 本轮工作 & 待拍板 | 宿主 tab | 已有，不动 |
| `head.title` | 待拍板 | 固定头左 | 14/600 |
| `head.count` | {n} 题 | 固定头 chip | n≥1 才显示 |
| `head.flag.done` | 已提交 | 固定头右 | ok 色，前面 CSS 勾 |
| `head.flag.error` | 提交失败 | 固定头右 | error 色，前面圆点 |
| `sec.summary` | 本轮摘要 | 区块标签 | |
| `summary.empty` | 模型这轮没有附摘要。 | 摘要卡占位 | `data-empty="true"`，tertiary |
| `sec.questions` | 待拍板问题 | 组头 | 右侧接进度 |
| `progress` | 已选 {done}/{total} | 组头右 | 全选后仍显示，作为确认 |
| `type.single` | 单选 | 题卡右 | |
| `type.multi` | 多选 | 题卡右 | |
| `invalid.inline` | 这一题还没选 | 题卡内 | 仅在点过提交后出现 |
| `note.placeholder` | 给这个选项补一句（可选） | 备注框 | 点明"这是备注不是题干" |
| `sec.overall` | 其他补充 | 收起态按钮 | 前面 CSS `+` |
| `overall.placeholder` | 还有什么要补充的？（可选） | 展开后的 textarea | |
| `status.hint` | 逐题选择后提交 | 底栏状态行 | 一题都没选时的默认句 |
| `status.partial` | 还有 {n} 题没选 | 底栏状态行 | tertiary，中性提示 |
| `status.incomplete` | 还有 {n} 题没选，已定位到第一题 | 底栏状态行 | warn，点击提交之后 |
| `status.sending` | 正在提交，请稍候 | 底栏状态行 | |
| `link.clear` | 全部清空 | 状态行右 | 有选中且非提交中才出现 |
| `btn.submit` | 提交拍板 | 主按钮 | |
| `btn.sending` | 提交中… | 主按钮（disabled） | 用「…」不是 `...` |
| `btn.retry` | 重新提交 | 主按钮（失败后） | |
| `link.retry` | 重试 | 错误条右 | 与主按钮同一 handler |
| `error.title` | 提交失败 | 错误条第一行 | 600 |
| `error.fallback` | 发送通道不可用，请稍后重试 | 错误条第二行兜底 | 有 `e.message` 时用它 |
| `done.bar` | 已提交，AI 会继续 | 完成条 | ok 色，前面 CSS 勾 |
| `done.hint` | 新的拍板会替换这里 | 完成条右 | 11/400，tertiary |
| `empty.title` | 这一轮不用拍板 | 空状态 | |
| `empty.hint` | AI 这轮没有需要你决定的事；有决策时会自动出现在这里。 | 空状态 | 19px 行高 |
| `loading.text` | 正在等本轮结果… | 骨架下方 | |
| `toolview.text` | 本轮有待拍板项，见右侧面板 | 聊天流工具卡 | 面板外 |
| `toolview.open` | 打开面板 | 聊天流工具卡按钮 | 面板外 |
| `launcher.text` | 拍板 | 页头入口按钮 | 面板外，必须中文 |
| `launcher.title` | 本轮工作 & 待拍板（重新打开） | 页头按钮 title | |
| `parseFail` | 这轮结果没读懂，已忽略 | 静默提示 | 不弹窗、不占位 |

**兜底规则（必须改）**：`t(key)` 取不到时返回上表中文兜底句，**不允许返回 key 本身**；`locale/zh.json` 里补齐上表键值。中文文案值里出现任何英文单词（`single`/`note`/`overall`…）视为 bug。

### 2.4 类名映射（旧 → 新，便于对照改）

| 旧 | 新 | 说明 |
|---|---|---|
| `.wg-body` | `.wg-scroll` | 唯一滚动容器 |
| `.wg-sec` | `.wg-label` / `.wg-qhead` | 拆成区块标签与问题组头 |
| `.wg-summary` | `.wg-sum` | 去掉渐变底与 3px 粗色条 |
| `.wg-q-id` | `.wg-no` | 题号徽标，显示 1/2/3，不显示 q1 |
| `.wg-opt-mark` | `.wg-mark` | 文字符号（○☐☑◉）改 CSS 形状 |
| `.wg-opt-id` | **删除** | 选项 id 不上屏 |
| `.wg-opt-wrap` | `.wg-opt-row` | 「选项按钮 + 备注」包裹层 |
| `.wg-actions` | `.wg-foot` | 固定底栏（移出滚动区） |
| `.wg-submit` | `.wg-primary` | 反色主按钮 |
| `.wg-ok` / `.wg-err` | `.wg-status` / `.wg-error` | 状态行与错误条拆开 |
| `.wg-done-tip` | `.wg-done` | 完成条 |
| `CSS2`（覆盖层） | **删除** | 全部合并进单一 `<style>` |

---

## 3. 组件规格

> 以下每条都给：结构 → 尺寸/颜色 → 状态（默认 / hover / 选中 / 禁用 / focus-visible）。CSS 以第 8 节附录 A 为准，这里只给决策与关键值。

### 3.1 固定头 `.wg-head`

**结构**：`[标题「待拍板」] [计数 chip：3 题] ……… [状态 flag]`

| 项 | 规格 |
|---|---|
| 高度 | 44px，`flex:0 0 auto` |
| 内边距 | `0 16px`，子项 gap 8 |
| 背景 | `bg-base`（与面板同底，滚动内容不会透出） |
| 底边 | `1px solid border-l1` |
| 标题 | 14/20 600 `label-primary`，字距 0 |
| 计数 chip | 高 18、`padding:0 6px`、r6、`bg-layer-2`、11/600 `label-secondary`、`tabular-nums`；`n=0` 时**不渲染** |
| 状态 flag | 右对齐（`margin-left:auto`），11.5/16；`data-tone="ok"` → success + CSS 勾；`data-tone="bad"` → error + 6px 圆点 |
| hover / 选中 / 禁用 | 整块不可点，不适用 |
| focus-visible | 不适用（容器不可聚焦） |

规则：面板里**不重复宿主 tab 标题**，header 只用一句「待拍板 + 数量 + 总状态」，保证 360px 下不换行。加载/空状态下 chip 与 flag 都隐藏，标题保持不动（避免头高跳动）。

### 3.2 摘要卡 `.wg-sum`

**结构**：区块标签「本轮摘要」（标签在卡**外**）→ 卡片 → 正文。

| 项 | 规格 |
|---|---|
| 尺寸 | 宽 100%，高 auto（空态一行约 52px）；`padding:10px 12px 11px 14px` |
| 圆角 / 边框 | r10；`1px solid border-l1` |
| 背景 | `bg-layer-1`（唯一"填充"的卡片，作为层级最高的一层信息） |
| 强调 | `::before` 左侧 2px、上下各内缩 10px、`accent`、`opacity .45`、`border-radius:0 2px 2px 0` |
| 正文 | 13/22、400、`label-primary`、`white-space:pre-wrap`、`overflow-wrap:anywhere` |
| 上限 | 正文包一层 `.wg-sum-text`，默认 4 行 `-webkit-line-clamp`；超出时在卡下加 11.5px 文字按钮「展开全文」。v1 可先不做，但**必须有** `data-clamped` 钩子（加在 `.wg-sum-text` 上，不要加在卡上，否则左侧色条会被一起裁掉） |
| 空摘要 | `data-empty="true"`：去掉左侧色条、透明底、12.5/20 `label-tertiary`，文案 `summary.empty` |
| hover | 无（不是可点区域）；hover 不改边框，避免"看起来能点" |
| focus-visible | 不适用（若做了「展开全文」按钮，则按钮本体 2px brand 外描边） |
| 禁用 / 只读 | 不适用（摘要永远只读；已提交态外观不变） |

### 3.3 问题卡 `.wg-q`

**结构**：`[题号徽标 1] [标题 ……………] [类型标签 单选]` → 描述（缩进 28）→ 选项组。

| 项 | 规格 |
|---|---|
| 尺寸 | 宽 100%，高 auto；`padding:12px 13px`；`+ .wg-q` 时 `margin-top:10px` |
| 圆角 / 边框 | r10；`1px solid border-l1`；背景 transparent（在底色上"画框"，不再叠一层填充） |
| 题号徽标 | 20×20（`min-width:20px`，两位数字可撑开）、r6、`1px solid border-l2`、底 `bg-base`、11/600 `label-secondary`、`tabular-nums`、`margin-top:1px` |
| 标题 | 13.5/21 600 `label-primary`，`-webkit-line-clamp:2`，`overflow-wrap:anywhere`，挂 `title` 属性 |
| 类型标签 | 11/16 500 `label-tertiary`，`padding:0 5px`、r4、`bg-layer-2`，右对齐、`margin-top:2px`、不换行 |
| 描述 | 12.5/20 400 `label-secondary`；左缩进 28（= 徽标 20 + gap 8），与标题左缘对齐 |
| 已答态 | `data-answered="true"`：边框 → `ring-accent`（accent 38% + border-l1），徽标 → accent 字 + accent 12% 底；**不动背景** |
| 未答校验态 | `data-invalid="true"`：边框 → `ring-bad`（error 46%），底 → error 6%，徽标同色系；卡底内联一行 `invalid.inline`（4px 圆点 + 11.5/16 error） |
| hover | 卡片本身不响应 hover（内部有输入控件，整卡 hover 会产生"可点"错觉） |
| focus-visible | 卡片可 `tabindex="-1"` 被程序聚焦：`outline:2px solid brand; outline-offset:2px`；用户 Tab 不会停在卡上 |
| 禁用（已提交只读态） | 边框回落到 `border-l1`，选项区整体替换为回放（见 3.8） |

### 3.4 选项 `.wg-opt`（单选 / 多选共用一套）

**结构**：`button.wg-opt[data-on][data-type]` → `span.wg-mark` + `span.wg-opt-label`；备注输入是它的**兄弟节点**，绝不嵌在 button 里。

| 状态 | 背景 | 边框 | 指示器 | 文字 | 光标 |
|---|---|---|---|---|---|
| 默认 | `bg-base` | `1px border-l1` | 15×15，`1.5px border-l2` 描边，透明底 | 13/20 400 `label-primary` | pointer |
| hover | `interactive-bg-hover` | `1px border-l2` | 不变 | 不变 | pointer |
| 选中 | `color-mix(accent 12%, bg-base)` | `1px accent` | 填满 accent，内部标记用 `bg-base` 色 | 不变（**不改字重**） | pointer |
| 选中 + hover | `color-mix(accent 14%, bg-base)` | `1px accent` | 同上 | 同上 | pointer |
| focus-visible | 不变 | 不变 | 不变 | 不变 | `outline:2px solid brand; outline-offset:1px` |
| 提交中 | 不变 | 不变 | 不变 | 不变 | `pointer-events:none` |
| 已提交（只读） | 透明 | 无 | 无 | 回放形态见 3.8 | default |

尺寸：`min-height:40px`、`padding:9px 11px`、r8、`gap:10px`、整行 `width:100%`、`text-align:left`、`user-select:none`。`min-height:40` 是硬下限（热区），选项文字换行时自然增高，**不截断标签**。

指示器形状：单选用 15px 圆环 + 中心 6px 圆点（`scale(0)→1`）；多选用 15px 圆角方（r4）+ 8×4px CSS 勾（`border-left/bottom` 旋转 -45°）。选中时圆环/方框填 `accent`，标记用 `bg-base` 反色。

> 暗色对比兜底：若实测「accent 填充 + bg-base 勾」在暗色下 <3:1，改用描边方案（不加填充、只把描边与标记都设成 accent），附录 A 末尾给了替换片段。

### 3.5 备注输入 `.wg-note`

只在**该选项被选中**时出现；取消选中即移除（值保留在内存，重新选中可恢复）。

**与题干的四道区分**（必须同时做到，用户才不会把备注看成题干）：
1. **位置**：缩进 `margin-left:25px`，外层再 `padding-left:10px`，落在选项文字下方而不是与题干对齐；
2. **标记**：左侧 2px、accent 22% 的竖线（连接线），暗示"属于上面那个选项"；
3. **形态**：32px 高、r6、`bg-layer-2` 底的输入框（题干是纯文本，没有框）；
4. **文案**：占位符「给这个选项补一句（可选）」，明确是"补一句"。

| 项 | 规格 |
|---|---|
| 尺寸 | 宽 100%、高 32px、`padding:0 9px`、r6 |
| 颜色 | 底 `bg-layer-2`、边框 `1px border-l1`、文字 12.5/20 `label-primary`、占位 `label-tertiary` |
| 间距 | 与所属选项 `margin-top:6px`；多个选中项时各自带自己的备注，垂直间距 6 |
| hover | 不变（输入框 hover 不做反馈） |
| 选中/焦点 | `:focus`：边框 → brand，底 → `bg-base`，`box-shadow:0 0 0 3px color-mix(brand 16%, transparent)`；不写 `outline`（避免双环） |
| 禁用 | 提交中 `readOnly`，颜色不变（内容要能读） |
| 限制 | `maxLength=200`，不做字数计数（密度优先）；不自动撑高 |

**实现陷阱**：备注 input 若放进选项 button 内部，点击输入框会触发选项切换、中文输入法候选会被打断。必须是兄弟节点。

### 3.6 其他补充（收起态展开）

- **收起态**：32px 高的一行文字按钮，前缀 CSS `+`（13px `label-tertiary`），文案「其他补充」，12/18 `label-secondary`；hover → `label-primary`；focus-visible → 2px brand。
- **展开态**：`textarea` 宽 100%、`min-height:64px`、`padding:8px 10px`、r8、`1px border-l1`、底 `bg-base`、12.5/20、`resize:vertical`；focus 同备注框。展开后不再收起（避免输入内容被折叠）。
- 上边距：作为最后一个区块，与问题组间距 16；`margin-bottom:0`。

### 3.7 粘底操作区 `.wg-foot`

**结构（从上到下）**：`状态行`（16px）→ `错误条`（仅失败）→ `主按钮`（36px）或 `完成条`（36px）。

| 子元素 | 尺寸 | 样式 | 状态 |
|---|---|---|---|
| 容器 | `padding:10px 16px 12px`，行间 gap 6 | 顶边 `1px border-l1`，底 `bg-base`，`flex:0 0 auto` | 上沿 16px 渐变遮罩（`::before`，`pointer-events:none`），让滚动内容淡出而不是硬切 |
| 状态行 | `min-height:16px`，11.5/16 | 左文案 `label-tertiary`；右「全部清空」11.5/16 `label-secondary` + 下划线（`text-underline-offset:2px`） | `data-tone="warn"` → warn（校验）；`data-tone="bad"` → error（罕见）；无内容也保留 16px 占位，防止底栏高度跳变 |
| 主按钮 | `width:100%`、高 36、r8 | 底 `label-primary`、字 `bg-base`、13/600、`box-shadow:0 1px 2px rgba(0,0,0,.12)` | hover：`color-mix(label-primary 90%, bg-base)`；active：`translateY(.5px)` + 去阴影；focus-visible：2px brand、offset 2；disabled：底 `bg-layer-2`、字 `label-tertiary`、边框 `border-l1`、无阴影、`cursor:default` |
| 错误条 | 自动高，`min-height:40px` | 底 error 7% + 边 error 26%、r8、`padding:8px 10px`；左 6px error 圆点；右「重试」小按钮（高 24、r6、error 描边 30%、hover error 10% 底） | 出现时**取代**状态行（不同时显示两处错误） |
| 完成条 | 高 36、r8 | 底 success 8% + 边 success 28%，success 11/600；左侧 CSS 勾；右侧 `done.hint` 11/400 tertiary | 不可点，`cursor:default` |

底栏高度速查：**58**（只有完成条）/ **80**（常态：状态行 + 按钮）/ **104**（错误条）；三种情况按钮下沿都贴底。

**按钮层级（主 / 次）**：主按钮只有一个——「提交拍板」，全宽 36px。次按钮是状态行右侧的「全部清空」文字按钮（无底无框、下划线，热区靠 `padding:2px 0` 补到 ≥24×24），固定占状态行右端，不与主按钮争宽度。若产品坚持要实体次按钮：高 32、r8、透明底 + `1px border-l2`、字 13/600 `label-secondary`，与主按钮同一行（主按钮 `flex:1`、gap 8），360px 下两者都不换行；本规范默认不采用，因为 360px 下双按钮会把主 CTA 压到 200px 以内。

> 关键：底栏是滚动容器的**兄弟**，故高度变化只会从上方"长出去"，主按钮下沿始终贴底、不跳。若做成 sticky 就会上下抖。

### 3.8 空 / 加载 / 已提交

**加载态（还没有 gate 数据）**

- 头：只显示「待拍板」，无 chip、无 flag。
- 骨架（静态、**不做 shimmer**）：3 条 12px 高的圆角条（宽 100% / 88% / 62%，r4，`color-mix(label-tertiary 14%, transparent)`，条间 8）+ 2 张 72px 高的描边占位卡（r10、卡间距 10）。
- 骨架下方 12px 处放 `loading.text`（11.5/16 `label-tertiary`）。
- 底栏隐藏；滚动区不可交互。

**空状态（本轮 0 题）**

- 头部：标题「待拍板」，无 chip/flag。
- 摘要卡照常显示（这轮做了什么仍然有价值）；空状态块放在问题区位置，**不做整页居中**、不加虚线框。
- 空块：`padding:30px 16px 34px`、垂直居中；36px 圆（`bg-layer-2`）内用 CSS 画一个 13×7 的对勾（`label-tertiary`）；标题 `empty.title` 13/20 600；说明 `empty.hint` 12/19 `label-tertiary`，`max-width:238px`、居中。
- 底栏隐藏。

**已提交态（只读回放）**

- 头部 flag：`已提交`（ok + CSS 勾）。
- 摘要卡保持原样。
- 每张问题卡：徽标 → accent 底（`data-answered`），标题、类型标签保留；选项列表整体替换为回放行：
  `✓ 选项文字`（12.5/19，`label-primary`，勾为 success 色）+ 若有备注，下一行缩进 17px `备注：…`（12/18 `label-tertiary`）。
- 底栏：只留完成条 `已提交，AI 会继续` + 右侧 `新的拍板会替换这里`；不再出现主按钮。
- 全部控件 `pointer-events:none`，不可再编辑（如需改，等 AI 下一轮重新登记）。

---

## 4. 状态与反馈

### 4.1 状态机（`data-phase` 是唯一真相）

| phase | 触发 | 头部 | 底栏 | 主体 |
|---|---|---|---|---|
| `loading` | 尚无 gate | 无 chip/flag | 隐藏 | 静态骨架 + `loading.text` |
| `empty` | 有 gate、0 题 | 无 chip/flag | 隐藏 | 摘要卡 + 空状态块 |
| `idle` | 有题，可编辑 | 无 flag | 状态行 + 可用主按钮 | 可编辑；0 选中 → `status.hint` |
| `incomplete` | 点提交但还有题没选 | 无 flag | 状态行 warn + 主按钮仍可用 | 首个未选卡 `data-invalid` + 内联提示 + 滚动定位 |
| `sending` | 已调用发送 | 无 flag | 主按钮 disabled「提交中…」；状态行「正在提交，请稍候」；隐藏「全部清空」 | 选项/备注只读（`pointer-events:none`），仍可滚动 |
| `error` | 发送抛错 | flag「提交失败」 | 错误条（含重试）+ 主按钮「重新提交」 | 保留全部选择与备注，可修改（修改即回 `idle`） |
| `done` | 发送成功 | flag「已提交」 | 完成条（无按钮） | 只读回放 |

状态切换的清理规则：任何一次选项变更 → `phase` 回 `idle` 并清除所有 `data-invalid`；新一轮 gate 到达 → 清空选择、`phase=idle`、滚动回顶部；`sending` 期间到达的新 gate 忽略，等本次提交结束再应用。

### 4.2 提交中

- 按钮：`disabled`，文案「提交中…」，底色 `bg-layer-2`/字 `label-tertiary`（**不用** spinner、不用省略号动画）。
- 状态行：「正在提交，请稍候」；「全部清空」消失（此时清空会与请求内容不一致）。
- 选项与备注：`pointer-events:none` + `readOnly`，但**不降透明度**（用户会盯着自己的选择看）。
- `aria-busy="true"` 挂在 `.wg-wrap`。

### 4.3 成功

- 底栏完成条 + 头部 flag 同时出现，`aria-live="polite"` 播报「已提交，AI 会继续」。
- 不做面板内 toast（宿主已有全局提示，重复会吵）；不自动关面板（用户可能要看回放）。

### 4.4 失败条（含重试）

- 结构：`● | 提交失败 / <具体原因> | [重试]`；原因取 `e.message` 前 80 字，没有就用 `error.fallback`。
- 位置：底栏内、主按钮上方；底栏整体 +24px（从上方长出去，按钮不跳）。
- 重试：两个入口同一 handler（错误条「重试」、主按钮「重新提交」）；重试**不改变**任何已填内容，也不重新构建 payload 以外的东西。
- 失败后用户改任何选项 → 错误条立即消失，回 `idle`（不要出现"改完了还在报错"）。
- 不弹 window.alert、不在聊天流里插系统消息。

### 4.5 未选题时（不许弹窗）

四层提示，同一次点击内同时出现：

1. 底栏状态行 → warn：「还有 2 题没选，已定位到第一题」；
2. 组头进度 → warn 色「已选 1/3」，进度条填充同步变 warn；
3. 每张未选卡 → `data-invalid`（error 描边 46% + 6% 底 + 徽标变色）+ 卡底内联「这一题还没选」；
4. 自动定位：`scrollIntoView({block:'center'})`（瞬时，不做平滑滚动），并把焦点放到**卡片容器**（`tabindex="-1"`），不放到选项按钮上（避免误以为已选中）。

补一条键盘细节：卡片 `scroll-margin:12px`，保证定位后不会被头部或底栏盖住。

### 4.6 可访问性硬要求（不额外花成本的部分）

- 单选组 `role="radiogroup"` + `aria-labelledby` 指向题目标题；单选按钮 `role="radio" aria-checked`；多选按钮用 `aria-pressed`。
- 备注输入 `aria-label="选项「{label}」的备注"`；错误条 `role="alert"`；状态行 `aria-live="polite"`。
- 所有可点元素都有 `:focus-visible`（2px brand），Tab 顺序 = DOM 顺序（选项 → 备注 → 下一题 → 补充 → 提交）。
- 点击热区：选项 ≥40px 高、备注 32、文字按钮 ≥24、主按钮 36；不为"看起来精致"牺牲热区。

---

## 5. 动效

只允许 **120–200ms**；只做状态过渡，不做入场编排；**没有无限动画**。

| 元素 | 过渡属性 | 时长 | 曲线 |
|---|---|---|---|
| 选项 | `background-color`, `border-color` | 140ms | `ease-out` |
| 指示器 | `border-color`, `background-color` | 120ms | `ease-out` |
| 指示器内标记 | `transform`（scale 0→1） | 120ms | `ease-out` |
| 问题卡 | `border-color`, `background-color` | 140ms | `ease-out` |
| 进度条填充 | `width`, `background-color` | 160ms | `ease-out` |
| 主按钮 | `background-color` | 140ms | `ease-out` |
| 主按钮按压 | `transform: translateY(.5px)` | 120ms | `ease-out` |
| 备注出现 | `opacity`（0→1） | 140ms | `ease-out` |
| 状态行颜色 | `color` | 120ms | `ease-out` |

禁止清单：`transition: all`；hover 缩放；骨架 shimmer；loading 转圈；自动轮播的渐变；超过 200ms 的位移动画；给整个面板做 tab 切换动效（交给宿主）。`@media (prefers-reduced-motion: reduce)` 下所有过渡降到 1ms、动画关闭。

---

## 6. 暗色模式注意事项

1. **不判断主题**：不要用 `prefers-color-scheme`（宿主可强制主题，与系统不一致），全部走 token；半透明都基于当前 token 现算。
2. **不硬编码颜色**：除 `rgba(0,0,0,.12)` 的主按钮阴影与 `transparent` 混色外，一个色值都不许写。
3. **层级不能靠阴影**：暗色下阴影基本不可见 → 卡片必须有 1px `border-l1`；摘要卡靠 `bg-layer-1` + 边线双重确认。
4. **tint 百分比取中间值**：亮色 8–10% 就够，暗色需要 14–18% 才看得出。本规范统一取 **12%**，两套主题都可读；若宿主在 `<html>` / `<body>` 暴露主题属性，可加一次性微调（附录 A 末尾，按实测选择器填写）。
5. **反色按钮天然成立**：亮色 = 深底浅字，暗色 = 浅底深字；不要给它再加品牌色描边，否则暗色会脏。
6. **tertiary 只做装饰信息**：暗色下 `label-tertiary` 对比可能低于 4.5:1，所以它只能承载计数、占位符、提示；错误文案必须用 `error` 或 `label-primary`。
7. **focus ring 用 brand**：暗色下 2px 品牌色 + 2px offset 是最稳的可见性方案，不要改成白色描边。
8. **骨架块**：`color-mix(label-tertiary 14%, transparent)` 在亮/暗都是中性灰，不要用 `bg-layer-2` 硬填（暗色偏亮会像加载条）。
9. **滚动条 thumb**：亮暗都用 tertiary 30% 透明，暗色不要加深到看不见。
10. **实测**：亮/暗各截一张 360px 宽的面板图，检查 4 件事——摘要卡是否还能与底分开、选中选项是否有足够边界、错误条是否不像警告条、主按钮是否仍是页面最重的元素。

---

## 7. 验收清单（12 条，逐条勾）

- [ ] **1. 零英文**：面板内不出现 `summary / questions / single / multi / note / overall / launcher` 等任何英文 key；类型显示「单选/多选」；无全大写、无字距模拟的小标题。
- [ ] **2. 底栏常驻**：头与底不随内容滚动；滚到列表任意位置，36px 主按钮都完整可见，且底栏上沿只有一道 1px 线（没有第二道线/双边框）。
- [ ] **3. 窄宽不破**：DevTools 设 360px 宽，无横向滚动；标题最多 2 行；focus ring 不被裁切；底栏按钮不换行。
- [ ] **4. 三层可辨**：1 秒内能指出「摘要（填充卡）/ 问题（描边卡）/ 选项（控件）」三层，且面板内不存在第二种卡片投影。
- [ ] **5. 进度可读**：组头能同时读到「待拍板问题 3 / 已选 1/3」与 2px 进度条；已答卡的徽标与未答卡有可见差异。
- [ ] **6. 未选不弹窗**：直接点提交 → 无 alert/无 toast；状态行变 warn、进度变 warn、未选卡出现 error 描边 + 内联「这一题还没选」，并定位到第一题。
- [ ] **7. 提交中**：按钮禁用且文案为「提交中…」；无转圈/无 shimmer/无循环动画；仍可滚动阅读；「全部清空」消失。
- [ ] **8. 失败可恢复**：错误条与「重试」出现；已选内容与备注一字不丢；改动任一选项后错误条立即消失。
- [ ] **9. 成功只读**：完成条 + 头部勾；题目变为只读回放（选项 + 备注）；主按钮消失、不可再点。
- [ ] **10. 键盘全程**：Tab 可走完「选项 → 备注 → 下一题 → 补充 → 提交」；空格选中；所有可点元素有可见 focus；状态变化被读屏播报。
- [ ] **11. 主题合规**：亮/暗切换无失效颜色；代码里除阴影/透明混色外零硬编码色值；正文对比 ≥4.5:1。
- [ ] **12. 动效克制**：所有过渡 120–200ms、只涉及上表属性；无无限动画；`prefers-reduced-motion` 下无位移。

验收方法：① 面板拉到 360px 与 420px 各看一遍；② 断网/改 `sendToSession` 抛错看失败态；③ 手动把 `questions` 置空、置 6 题、置超长标题各看一遍；④ 只按 Tab + 空格完成一次提交。

---

## 8. 附录 A：可直接落地的 CSS（单一 `<style>`）

> 替换现有 `CSS` 与 `CSS2`，不再保留覆盖层。`color-mix` 需 Chromium 111+（当前 DSH Web 满足）。

```css
/* 0 · 语义层：组件只引用 --wg-*，暗色/主题差异集中在这里 */
.wg-wrap{
  --wg-surface: var(--dsw-alias-bg-base);
  --wg-raised:  var(--dsw-alias-bg-layer-1);
  --wg-sunken:  var(--dsw-alias-bg-layer-2);
  --wg-line:    var(--dsw-alias-border-l1);
  --wg-line-2:  var(--dsw-alias-border-l2);
  --wg-text:    var(--dsw-alias-label-primary);
  --wg-text-2:  var(--dsw-alias-label-secondary);
  --wg-text-3:  var(--dsw-alias-label-tertiary);
  --wg-hover:   var(--dsw-alias-interactive-bg-hover);
  --wg-accent:  var(--dsw-alias-state-business-primary);
  --wg-brand:   var(--dsw-alias-brand-primary);
  --wg-ok:      var(--dsw-alias-state-success-primary);
  --wg-warn:    var(--dsw-alias-state-warn-primary);
  --wg-bad:     var(--dsw-alias-state-error-primary);

  --wg-tint-accent: color-mix(in srgb, var(--wg-accent) 12%, var(--wg-surface));
  --wg-tint-bad:    color-mix(in srgb, var(--wg-bad) 6%, var(--wg-surface));
  --wg-ring-accent: color-mix(in srgb, var(--wg-accent) 38%, var(--wg-line));
  --wg-ring-bad:    color-mix(in srgb, var(--wg-bad) 46%, var(--wg-line));

  display:flex; flex-direction:column;
  height:100%; min-height:0;
  background:var(--wg-surface); color:var(--wg-text);
  font-size:13px; line-height:1.7;
  -webkit-font-smoothing:antialiased;
}
.wg-wrap,.wg-wrap *{box-sizing:border-box}

/* 1 · 固定头 */
.wg-head{flex:0 0 auto;display:flex;align-items:center;gap:8px;
  height:44px;padding:0 16px;border-bottom:1px solid var(--wg-line)}
.wg-head-title{font-size:14px;font-weight:600;line-height:20px;color:var(--wg-text);letter-spacing:0}
.wg-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:18px;padding:0 6px;
  border-radius:6px;background:var(--wg-sunken);font-size:11px;font-weight:600;line-height:18px;
  color:var(--wg-text-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.wg-flag{margin-left:auto;display:inline-flex;align-items:center;gap:5px;
  font-size:11.5px;line-height:16px;color:var(--wg-text-3);white-space:nowrap}
.wg-flag[data-tone="ok"]{color:var(--wg-ok)}
.wg-flag[data-tone="bad"]{color:var(--wg-bad)}
.wg-flag[data-tone="ok"]::before{content:"";width:8px;height:4px;margin-top:-2px;
  border-left:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg)}
.wg-flag[data-tone="bad"]::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}

/* 2 · 滚动区（唯一滚动容器） */
.wg-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  padding:14px 16px 20px;scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--wg-text-3) 30%,transparent) transparent}
.wg-scroll::-webkit-scrollbar{width:10px}
.wg-scroll::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:8px;background-clip:content-box;
  background-color:color-mix(in srgb,var(--wg-text-3) 30%,transparent)}
.wg-scroll::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--wg-text-3) 46%,transparent)}
.wg-block + .wg-block{margin-top:16px}

/* 3 · 区块标签 */
.wg-label{display:flex;align-items:center;gap:8px;margin:0 0 6px;
  font-size:12px;font-weight:600;line-height:18px;color:var(--wg-text-2);letter-spacing:0}
.wg-label-hint{margin-left:auto;font-size:11px;font-weight:400;line-height:16px;color:var(--wg-text-3)}

/* 4 · 摘要卡 */
.wg-sum{position:relative;padding:10px 12px 11px 14px;border:1px solid var(--wg-line);
  border-radius:10px;background:var(--wg-raised);font-size:13px;line-height:1.75;
  white-space:pre-wrap;overflow-wrap:anywhere;
  transition:border-color 140ms ease-out,background-color 140ms ease-out}
.wg-sum::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;
  border-radius:0 2px 2px 0;background:var(--wg-accent);opacity:.45}
.wg-sum[data-empty="true"]{background:transparent;color:var(--wg-text-3);font-size:12.5px;line-height:20px}
.wg-sum[data-empty="true"]::before{display:none}
.wg-sum-text[data-clamped="true"]{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.wg-more{margin-top:4px;padding:0;border:0;background:none;cursor:pointer;
  font:inherit;font-size:11.5px;line-height:16px;color:var(--wg-text-2)}
.wg-more:hover{color:var(--wg-text)}
.wg-more:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px;border-radius:3px}

/* 5 · 问题组头 + 进度 */
.wg-qhead{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.wg-qhead .wg-label{margin:0}
.wg-progress{margin-left:auto;font-size:11px;font-weight:500;line-height:16px;color:var(--wg-text-3);
  font-variant-numeric:tabular-nums;transition:color 120ms ease-out}
.wg-progress[data-tone="warn"]{color:var(--wg-warn)}
.wg-track{height:2px;margin-bottom:12px;border-radius:2px;background:var(--wg-line);overflow:hidden}
.wg-track > i{display:block;height:100%;border-radius:2px;background:var(--wg-accent);
  transition:width 160ms ease-out,background-color 160ms ease-out}
.wg-track[data-tone="warn"] > i{background:var(--wg-warn)}

/* 6 · 问题卡 */
.wg-q{border:1px solid var(--wg-line);border-radius:10px;padding:12px 13px;background:transparent;
  transition:border-color 140ms ease-out,background-color 140ms ease-out}
.wg-q + .wg-q{margin-top:10px}
.wg-q[data-answered="true"]{border-color:var(--wg-ring-accent)}
.wg-q[data-invalid="true"]{border-color:var(--wg-ring-bad);background:var(--wg-tint-bad)}
.wg-q:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px}
.wg-q-top{display:flex;align-items:flex-start;gap:8px}
.wg-no{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
  min-width:20px;height:20px;margin-top:1px;padding:0 5px;
  border:1px solid var(--wg-line-2);border-radius:6px;background:var(--wg-surface);
  font-size:11px;font-weight:600;line-height:1;color:var(--wg-text-2);font-variant-numeric:tabular-nums;
  transition:color 120ms ease-out,border-color 120ms ease-out,background-color 120ms ease-out}
.wg-q[data-answered="true"] .wg-no{color:var(--wg-accent);border-color:var(--wg-ring-accent);background:var(--wg-tint-accent)}
.wg-q[data-invalid="true"] .wg-no{color:var(--wg-bad);border-color:var(--wg-ring-bad);background:var(--wg-tint-bad)}
.wg-q-title{flex:1 1 auto;min-width:0;font-size:13.5px;font-weight:600;line-height:21px;color:var(--wg-text);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.wg-type{flex:0 0 auto;margin-top:2px;padding:0 5px;border-radius:4px;background:var(--wg-sunken);
  font-size:11px;line-height:16px;color:var(--wg-text-3);white-space:nowrap}
.wg-q-prompt{margin:2px 0 0 28px;font-size:12.5px;line-height:20px;color:var(--wg-text-2);overflow-wrap:anywhere}

/* 7 · 选项（单选 / 多选共用） */
.wg-opts{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.wg-opt{display:flex;align-items:flex-start;gap:10px;width:100%;min-height:40px;margin:0;padding:9px 11px;
  text-align:left;border:1px solid var(--wg-line);border-radius:8px;background:var(--wg-surface);
  color:var(--wg-text);font:inherit;font-size:13px;line-height:20px;cursor:pointer;
  -webkit-appearance:none;appearance:none;user-select:none;
  transition:background-color 140ms ease-out,border-color 140ms ease-out}
.wg-opt:hover{background:var(--wg-hover);border-color:var(--wg-line-2)}
.wg-opt[data-on="true"]{background:var(--wg-tint-accent);border-color:var(--wg-accent)}
.wg-opt:focus-visible{outline:2px solid var(--wg-brand);outline-offset:1px}
.wg-opt-label{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.wg-mark{position:relative;flex:0 0 auto;width:15px;height:15px;margin-top:2px;
  border:1.5px solid var(--wg-line-2);border-radius:50%;background:transparent;
  transition:border-color 120ms ease-out,background-color 120ms ease-out}
.wg-opt[data-type="multi"] .wg-mark{border-radius:4px}
.wg-mark::after{content:"";position:absolute;left:50%;top:50%;
  transform:translate(-50%,-50%) scale(0);transition:transform 120ms ease-out}
.wg-opt[data-type="single"] .wg-mark::after{width:6px;height:6px;border-radius:50%;background:var(--wg-surface)}
.wg-opt[data-type="multi"] .wg-mark::after{width:8px;height:4px;margin-top:-1px;
  border-left:1.5px solid var(--wg-surface);border-bottom:1.5px solid var(--wg-surface);
  transform:translate(-50%,-60%) rotate(-45deg) scale(0)}
.wg-opt[data-on="true"] .wg-mark{background:var(--wg-accent);border-color:var(--wg-accent)}
.wg-opt[data-on="true"] .wg-mark::after{transform:translate(-50%,-50%) scale(1)}
.wg-opt[data-on="true"][data-type="multi"] .wg-mark::after{transform:translate(-50%,-60%) rotate(-45deg) scale(1)}

/* 8 · 备注（仅在选中项下方出现；必须是选项按钮的兄弟节点） */
.wg-note-wrap{position:relative;margin:6px 0 0 25px;padding-left:10px}
.wg-note-wrap::before{content:"";position:absolute;left:0;top:1px;bottom:3px;width:2px;border-radius:2px;
  background:color-mix(in srgb,var(--wg-accent) 22%,transparent)}
.wg-note{display:block;width:100%;height:32px;padding:0 9px;border:1px solid var(--wg-line);border-radius:6px;
  background:var(--wg-sunken);color:var(--wg-text);font:inherit;font-size:12.5px;line-height:30px;
  transition:border-color 140ms ease-out,background-color 140ms ease-out}
.wg-note::placeholder{color:var(--wg-text-3)}
.wg-note:focus{outline:none;border-color:var(--wg-brand);background:var(--wg-surface);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--wg-brand) 16%,transparent)}

/* 9 · 其他补充 */
.wg-more-row{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 2px;
  border:0;background:none;cursor:pointer;text-align:left;
  font:inherit;font-size:12px;line-height:18px;color:var(--wg-text-2)}
.wg-more-row:hover{color:var(--wg-text)}
.wg-more-row:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px;border-radius:4px}
.wg-more-row::before{content:"+";font-size:13px;line-height:1;color:var(--wg-text-3)}
.wg-overall{display:block;width:100%;min-height:64px;padding:8px 10px;resize:vertical;
  border:1px solid var(--wg-line);border-radius:8px;background:var(--wg-surface);color:var(--wg-text);
  font:inherit;font-size:12.5px;line-height:20px;transition:border-color 140ms ease-out}
.wg-overall::placeholder{color:var(--wg-text-3)}
.wg-overall:focus{outline:none;border-color:var(--wg-brand);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--wg-brand) 16%,transparent)}

/* 10 · 粘底操作区 */
.wg-foot{position:relative;flex:0 0 auto;display:flex;flex-direction:column;gap:6px;
  padding:10px 16px 12px;border-top:1px solid var(--wg-line);background:var(--wg-surface)}
.wg-foot::before{content:"";position:absolute;left:0;right:0;top:-16px;height:16px;pointer-events:none;
  background:linear-gradient(to bottom,color-mix(in srgb,var(--wg-surface) 0%,transparent),var(--wg-surface))}
.wg-status{display:flex;align-items:center;gap:8px;min-height:16px;
  font-size:11.5px;line-height:16px;color:var(--wg-text-3)}
.wg-status[data-tone="warn"]{color:var(--wg-warn)}
.wg-status[data-tone="bad"]{color:var(--wg-bad)}
.wg-status-text{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wg-clear{flex:0 0 auto;padding:2px 0;border:0;background:none;cursor:pointer;
  font:inherit;font-size:11.5px;line-height:16px;color:var(--wg-text-2);
  text-decoration:underline;text-underline-offset:2px;
  text-decoration-color:color-mix(in srgb,var(--wg-text-2) 40%,transparent)}
.wg-clear:hover{color:var(--wg-text)}
.wg-clear:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px;border-radius:3px}
.wg-primary{display:flex;align-items:center;justify-content:center;width:100%;height:36px;
  border:1px solid transparent;border-radius:8px;
  background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);
  font:inherit;font-size:13px;font-weight:600;line-height:1;letter-spacing:0;cursor:pointer;
  box-shadow:0 1px 2px rgba(0,0,0,.12);
  transition:background-color 140ms ease-out,transform 120ms ease-out,box-shadow 140ms ease-out}
.wg-primary:hover:not(:disabled){
  background:color-mix(in srgb,var(--dsw-alias-label-primary) 90%,var(--dsw-alias-bg-base))}
.wg-primary:active:not(:disabled){transform:translateY(.5px);box-shadow:none}
.wg-primary:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px}
.wg-primary:disabled{background:var(--wg-sunken);color:var(--wg-text-3);
  border-color:var(--wg-line);box-shadow:none;cursor:default}

/* 11 · 错误条（含重试） */
.wg-error{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;
  background:color-mix(in srgb,var(--wg-bad) 7%,transparent);
  border:1px solid color-mix(in srgb,var(--wg-bad) 26%,transparent);
  font-size:11.5px;line-height:17px}
.wg-error-dot{flex:0 0 auto;width:6px;height:6px;margin-top:5px;border-radius:50%;background:var(--wg-bad)}
.wg-error-body{flex:1 1 auto;min-width:0}
.wg-error-title{margin:0;font-weight:600;color:var(--wg-text)}
.wg-error-msg{margin:1px 0 0;color:var(--wg-text-2);overflow-wrap:anywhere;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wg-retry{flex:0 0 auto;align-self:center;padding:3px 8px;border-radius:6px;cursor:pointer;
  border:1px solid color-mix(in srgb,var(--wg-bad) 30%,transparent);background:transparent;
  font:inherit;font-size:11.5px;font-weight:600;line-height:16px;color:var(--wg-bad)}
.wg-retry:hover{background:color-mix(in srgb,var(--wg-bad) 10%,transparent)}
.wg-retry:focus-visible{outline:2px solid var(--wg-brand);outline-offset:1px}

/* 12 · 完成条 */
.wg-done{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:8px;
  background:color-mix(in srgb,var(--wg-ok) 8%,transparent);
  border:1px solid color-mix(in srgb,var(--wg-ok) 28%,transparent);
  font-size:12.5px;font-weight:600;line-height:1;color:var(--wg-ok)}
.wg-done::before{content:"";flex:0 0 auto;width:9px;height:5px;margin-top:-2px;
  border-left:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg)}
.wg-done-sub{margin-left:auto;font-size:11px;font-weight:400;color:var(--wg-text-3)}

/* 13 · 未选提示（卡内） */
.wg-invalid{display:flex;align-items:center;gap:5px;margin-top:8px;
  font-size:11.5px;line-height:16px;color:var(--wg-bad)}
.wg-invalid::before{content:"";width:4px;height:4px;border-radius:50%;background:currentColor}

/* 14 · 只读回放（已提交） */
.wg-answer{display:flex;align-items:flex-start;gap:8px;margin-top:8px;
  font-size:12.5px;line-height:19px;color:var(--wg-text)}
.wg-answer::before{content:"";flex:0 0 auto;width:9px;height:5px;margin-top:5px;
  border-left:1.5px solid var(--wg-ok);border-bottom:1.5px solid var(--wg-ok);transform:rotate(-45deg)}
.wg-answer-label{min-width:0;overflow-wrap:anywhere}
.wg-answer-note{margin:2px 0 0 17px;font-size:12px;line-height:18px;color:var(--wg-text-3)}

/* 15 · 空 / 加载 */
.wg-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:30px 16px 34px;text-align:center}
.wg-empty-ico{display:flex;align-items:center;justify-content:center;width:36px;height:36px;
  margin-bottom:4px;border-radius:50%;background:var(--wg-sunken)}
.wg-empty-ico::after{content:"";width:13px;height:7px;margin-top:-3px;
  border-left:1.6px solid var(--wg-text-3);border-bottom:1.6px solid var(--wg-text-3);transform:rotate(-45deg)}
.wg-empty-title{margin:0;font-size:13px;font-weight:600;line-height:20px;color:var(--wg-text)}
.wg-empty-hint{margin:0;max-width:238px;font-size:12px;line-height:19px;color:var(--wg-text-3)}
.wg-sk{height:12px;border-radius:4px;background:color-mix(in srgb,var(--wg-text-3) 14%,transparent)}
.wg-sk + .wg-sk{margin-top:8px}
.wg-sk-card{margin-top:10px;padding:12px 13px;border:1px solid var(--wg-line);border-radius:10px}
.wg-loading{margin-top:12px;font-size:11.5px;line-height:16px;color:var(--wg-text-3)}

/* 16 · 提交中冻结（仍可滚动阅读） */
.wg-wrap[data-phase="sending"] .wg-opt,
.wg-wrap[data-phase="sending"] .wg-clear{pointer-events:none}

/* 17 · 减少动效 */
@media (prefers-reduced-motion: reduce){
  .wg-wrap *{transition-duration:1ms !important;animation:none !important}
}
```

**可选：暗色对比兜底（若「accent 填充 + bg-base 勾」在暗色下 <3:1，换成描边方案）**

```css
.wg-opt[data-on="true"] .wg-mark{background:transparent;border-color:var(--wg-accent)}
.wg-opt[data-on="true"] .wg-mark::after{background:var(--wg-accent)}
.wg-opt[data-on="true"][data-type="multi"] .wg-mark::after{
  background:transparent;border-left-color:var(--wg-accent);border-bottom-color:var(--wg-accent)}
```

**可选：宿主若暴露主题属性，可只做一次 tint 微调**（先用 DevTools 确认选择器，再填）

```css
/* [data-theme="dark"] .wg-wrap{ --wg-tint-accent: color-mix(in srgb, var(--wg-accent) 16%, var(--wg-surface)); } */
```

---

## 9. 附录 B：数据 → UI 映射与边界

| 数据 | 上屏位置 | 规则 |
|---|---|---|
| `gate.summary` | `.wg-sum` | 空 → `data-empty` + `summary.empty` |
| `questions.length` | 头部 chip / 组头进度 | 0 → 空状态，底栏隐藏 |
| `question.id`（q1…） | **不上屏** | 只用于回传文本与 React key |
| 序号 `index+1` | 徽标 | 两位数字时徽标加宽，不换行 |
| `question.title` | `.wg-q-title` | 2 行截断 + `title` 属性 |
| `question.prompt` | `.wg-q-prompt` | 可空；不截断 |
| `question.type` | `.wg-type` + `data-type` | single→单选，multi→多选 |
| `option.id`（a/b…） | **不上屏** | 只用于回传与 key |
| `option.label` | `.wg-opt-label` | 不截断；长标签换行增高 |
| `picked` / `notes` / `overall` | 选项态 / 备注框 / 补充区 | 新一轮 gate 到达时清空 |
| `phase` | `.wg-wrap[data-phase]` | 唯一驱动底栏与只读态 |

边界/异常：

| 情况 | 处理 |
|---|---|
| `questions` 有空数组或全被过滤掉 | 按空状态处理，底栏隐藏 |
| 某题 `options` 过滤后为空 | 该题不渲染，并从计数中剔除（不要出现"无选项的题"） |
| 题目标题 > 40 字 | 2 行截断，`title` 给全文 |
| 选项文字 > 60 字 | 换行，不截断；选项高度随内容增长，热区不变 |
| 单题选项 > 6 | 不折叠，直接滚动（决策要看全选项）；可在提示词层建议模型 ≤5 |
| 备注 > 200 字 | `maxLength=200` 截断，不做计数 |
| 新一轮 gate 在编辑中途到达 | 清空选择、回顶部、`phase=idle`（避免把上一轮的备注发到新题上） |
| 提交中到达新 gate | 忽略，提交结束后再应用 |
| 发送通道报错 | 保留所有内容，进 `error`，不自动重试 |
| 面板宽度 < 360（宿主极端） | 左右 padding 降到 12；不缩字号、不隐藏控件 |

实现备注（三条，避免踩回旧坑）：

1. **单一 `<style>`**：把附录 A 整段放进现有那一个 `<style>`，删掉 `CSS2`；不要再靠第二层覆盖，否则间距又回到"补丁感"。
2. **文案走中文兜底**：给 `makeT` 加中文兜底表（本文 2.3），并补齐 `locale/zh.json`；**永远不要**把 key 当兜底文案。
3. **结构**：备注 input 必须是选项 button 的兄弟节点；底栏必须是滚动容器的兄弟节点。这两条决定了输入法是否被打断、按钮是否随内容跳动。
