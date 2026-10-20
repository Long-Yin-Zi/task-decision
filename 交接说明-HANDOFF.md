# 交接说明 · dsh-work-summary-gate（给接手的新工作区）

> 这份文件是**上一个工作区**（`D:\project\wisdom_wenxing`）里的 AI 在会话结束前写的。
> 新工作区的 AI **看不到那段对话记录**（DSH 的会话按工作区隔离，存在 `~/.dsh/sessions/--D-project-wisdom_wenxing--` 下）。
> 所以这里的每一条都是"你必须知道、否则会踩坑"的信息，请先读完再动手。

---

## 1. 这是什么

一个 **DSH（DeepSeek Harness）插件**，名字 `dsh-work-summary-gate`，当前版本 **0.5.0**（0.4.1 → 0.5.0 的变更见第 9 节）。

**它做的事**：AI 每轮回复结束时，把「本轮总结 + 需要用户拍板的问题」登记成一个工具调用（`gate_ask`）；
插件在 DSH **右侧边栏**开一个 tab，把这些问题集中显示，用户逐题选择 / 写备注，点提交后把结构化答案发回会话给 AI。

**解决什么痛点**：多轮开发里 AI 一次抛出好几个决策点，散在正文里容易漏答、答错题号；回传时 AI 又容易忘记"那道题到底问的是什么"。

---

## 2. 文件在哪、哪些是插件本体

**插件根目录 = 本文件所在目录**（原来在 `D:\project\wisdom_wenxing\dsh-plugins\work-summary-gate`，被搬到了这里）。

```
├── index.js              宿主半部：注册 gate_ask 工具 + 注入系统提示词规则（改它要重启 DSH）
├── client.js             浏览器半部：右侧面板 UI + 提交/回传/自动收起（改它刷新页面即可）
├── cordis.patch.yml      组合补丁：让 DSH 的插件表插入本插件一行
├── package.json          包信息（发布必需：name / version / license / repository）
├── README.md             说明文档（发布必需：必须含安装命令）
├── LICENSE               MIT（发布必需：版权人 tdcy）
├── .gitignore
├── icon.svg              插件图标
├── locale/{zh,en}.json   界面文案
└── design/ui-spec.md     面板设计与交互规格（设计文档，可删）
```

> ⚠️ **这个目录被 DSH 通过 Junction（目录链接）引用**：
> `C:\Users\17633\.dsh\profiles\desktop\node_modules\dsh-work-summary-gate` → 指向插件根目录。
> **一旦移动/重命名插件目录，这个链接就会失效，插件会「加载不到」**（表现为右侧栏没有面板、AI 也没有 gate_ask 工具）。
> 移动后必须重建链接（命令见第 6 节）。

---

## 3. 已经完成的事（不要重做）

### 3.1 功能（v0.4.0 → v0.4.1）

| 功能 | 说明 |
|---|---|
| 右侧独立面板 | 摘要 + 全部待决问题集中一处 |
| 单选 / 多选 | 勾选框区分圆形/方形 |
| **每题常驻备注框** | 选项都不满意时，**不选任何选项、只写备注也能提交** |
| 提交前校验 | 既没选也没写备注的题会被标红拦住 |
| **回传带上问题标题** | 格式：`q1（问题标题）: 选 b「…」；整题备注：…` |
| **提交后自动收起右侧栏** | 把注意力还给 AI 回复 |
| **防重复提交** | 两道闸：① `useRef` 同步锁（同一 tick 连点）② `submittedRow` 已提交闸（关掉面板再打开也不能重复发） |
| 失败可重试 | 发送失败保留已填内容 |
| 中英双语 | locale 表，跟随 DSH 语言 |

### 3.2 发布资料（已按 dsh-plugin.org 收录要求补齐）

- ✅ `LICENSE`（MIT，版权人 `tdcy`）
- ✅ `package.json`：已补 `license` / `author` / `keywords` / `repository` / `homepage` / `bugs`，**已删掉 `"private": true`**，版本号 `0.4.1`
- ✅ `README.md` 已重写：一句话价值、安装命令、功能、工作原理、回传格式、文件结构、权限声明、兼容性、版本历史、许可证
- ✅ `index.js` 确认导出 `apply(ctx)`（收录硬性要求）
- ✅ 仓库干净：无 `node_modules` / `dist` / 临时目录

### 3.3 已验证

- `package.json` 是合法 JSON
- `index.js`、`client.js` 均通过 `node --check`
- 插件在 DSH 桌面端（`dsh web` 内嵌）实际跑通过

---

## 4. 还没做的事（你的待办）

### ① 放截图（唯一的"内容"缺口）

在插件目录下建 `docs/`，放 1~2 张图：

- `docs/screenshot-panel.png` —— 面板展开、几道题、一道写了备注
- `docs/screenshot-collapsed.png` —— 提交后侧边栏收起的状态

然后打开 `README.md`，找到「## 截图」这一节，把里面被注释掉的这行取消注释：

```markdown
![面板](docs/screenshot-panel.png)
```

### ② 上传到 GitHub

GitHub 用户名已确认：**`tdcy`**，目标仓库：`https://github.com/tdcy/dsh-work-summary-gate`

```powershell
cd <插件根目录>            # 也就是本文件所在的目录
git init
git add .
git commit -m "feat: initial release v0.4.1"
git branch -M main
git remote add origin https://github.com/tdcy/dsh-work-summary-gate.git
git push -u origin main
```

**推送前先在 https://github.com/new 建一个公开空仓库**，仓库名 `dsh-work-summary-gate`，
⚠️ 创建时**不要勾** "Add a README file" / ".gitignore" / "Choose a license"（本地文件都有了，勾了会冲突）。

### ③ 加 topic（收录硬性要求）

仓库页 → **Settings** → **Topics** → 输入 `dsh-plugin` → Save。

### ④ 提交到插件市场

打开 https://github.com/dshplugin/dsh-plugin-hub/issues/new ，标题：

```
[插件提交] tdcy/dsh-work-summary-gate — 把 AI 每轮抛出的决策点收进右侧面板，选完写备注一键回传
```

正文（直接复制）：

```markdown
### 仓库地址
https://github.com/tdcy/dsh-work-summary-gate

### 一句话价值
安装后，AI 每轮不再在正文里堆一长串待决问题，而是收进右侧边栏的独立 tab：一次选完、每题可写备注、点一下提交，答案带着问题标题自动发回会话，AI 接着干活。

### 能力分类
界面与体验

### 安装命令
dsh plugin --profile web add github:tdcy/dsh-work-summary-gate

### 兼容与运行要求
DSH 0.2.1-rc.2（nightly）验证；profile: web；纯 JS 无原生依赖；Windows/macOS/Linux

### 许可证
MIT

### 截图 / 演示
（可选，后续补）

### 补充说明
- 不发起任何网络请求、不读写工作区文件；唯一外部交互是把「拍板回传」发回当前会话。
- 仅注册一个工具 gate_ask 与一段系统提示词规则。
- 目前为 Web UI 专用插件（package.json 声明 dsh.client.platform = "web"）。

### 提交前自查
- [x] 仓库已公开
- [x] 已添加 GitHub topic：dsh-plugin
- [x] README 包含安装命令
- [x] 插件导出 apply(ctx) 模块
- [x] 仓库根目录包含 package.json
```

> 说明：**没有 npm 包也照常收录**，但不会出现在 DSH 内的「插件中心」（插件中心只收能用 `dsh plugin --profile web add <包名>` 一键装的）。
> 想进插件中心需要再 `npm publish`（要 npm 账号，包名 `dsh-work-summary-gate` 未被占用）。

### ⑤（可选）让别的项目也能用

插件目录原来在（旧路径）`D:\project\wisdom_wenxing\dsh-plugins\work-summary-gate`，
不要在旧项目里再维护一份 —— 以**新目录为唯一来源**，旧项目里那份应删除或加进旧项目的 `.gitignore`，
否则会出现"两份代码、不知道改哪份"的问题。

---

## 5. 关键技术约束（不看会踩坑）

1. **宿主半部 vs 浏览器半部**
   - `index.js`（宿主，Node 侧）→ 改动**必须重启 DSH** 才生效。
   - `client.js`（浏览器侧）→ 改动**刷新页面**即可（`Ctrl+F5` 更稳）。

2. **`package.json` 里的 `dsh.client.platform = "web"`**
   DSH 的客户端插件加载器**只接受字符串 `"web"`**（硬编码校验）。这个插件是 Web UI 专用：
   能被 `dsh web` / 会跑 web UI 的桌面端加载，但 DSH「纯 Electron 本地文档」那种界面载体里不会显示。

3. **右侧栏 API 是内部面**
   - 打开面板：`ctx.get('sidebarRight').openTab(kind)`
   - 收起面板：`ctx.get('sidebarRight').actionsFor(sessionId).setExpanded(sessionId, false)`
   都是 DSH 内部接口，升级可能改名。代码里每一处都包了 `try/catch` 兜底 ——
   **收起失败只是"不自动收起"，绝不影响提交**。改这里时请保持这个容错风格。

4. **提交通道**
   实际顺序是**先试** `sessions.binding(sessionId).session.prompt(content,'queue')`，失败再退回 `ctx.sessions.scope(sessionId).get('conversation').send(text)`（见 `client.js` 的 `sendToSession`；v0.3.0 修的就是这个）。⚠️ 本节早期版本把两者写反了，以代码为准。

5. **不要动 `node_modules` 里的东西**
   `~/.dsh/profiles/desktop/node_modules/dsh-work-summary-gate` 只是 Junction，不是副本。

---

## 6. 移动目录后怎么恢复（必看）

假设新位置就是 `D:\project\dsh-Plugin\task-decision`（本文件所在处）：

```powershell
# 1) 删掉旧的 Junction（只删链接，不会删真实文件）
rmdir "C:\Users\17633\.dsh\profiles\desktop\node_modules\dsh-work-summary-gate"

# 2) 重建，指向新位置
mklink /J "C:\Users\17633\.dsh\profiles\desktop\node_modules\dsh-work-summary-gate" "D:\project\dsh-Plugin\task-decision"

# 3) 重启 DSH
```

> `rmdir` 对 Junction 只删链接本身，源目录不受影响；但**不要**用 `rmdir /s`。

---

## 7. 怎么快速确认"插件是不是好的"

1. 重启 DSH，随便开一个会话，问 AI 一句需要决策的话（或让 AI 调用 `gate_ask`）。
2. 期望：聊天流里出现一行卡片「📋 本轮有待拍板项，见右侧面板」，同时右侧栏自动打开 tab。
3. 每道题下面应该有一个**常驻备注框**（写着"上面都不合适？…"）。
4. 只在一个备注框里写字、**一个选项都不选** → 提交按钮应该能点。
5. 提交后：右侧栏**自动收起**；再点页头「拍板」重新打开，按钮应显示「已提交」且**点不动**（防重复提交生效）。

只要这 5 步都对，插件就是完好的。

---

## 8. 一句话总结给接手的 AI

> 这个插件**功能已完成、发布资料已齐**（0.5.0 又补了"已提交只读回放"与文案），剩下的全是“发布动作”（截图、推 GitHub、加 topic、提 Issue）。
> 不要重构它，除非用户明确要求；改动前先确认 `node_modules` 里那个 Junction 指向的到底是不是你正在改的目录。

---

## 9. 2026-10-20 接手会话的更新（0.5.0）

**背景**：本会话接手后，按用户拍板先做“面板补完（质量优先）”，发布动作往后排。

### 9.1 已改（全部在 `client.js`）

1. **已提交只读回放**（ui-spec 3.8 里一直没落地的部分）：提交后不再保留可编辑控件，改为只读回放
   —— 选中的选项逐条「✓ 文字」、该选项的备注、整题备注（没选任何选项时先显「未选项」）、整体补充。
   为了“关掉面板再打开也能回放”，提交快照存在 `store` 的 `submittedSnapshot` 里（`markSubmitted(sessionId, snapshot)`），
   不是 React 局部 state。
2. **删死代码**：`CSS`、`CSS2` 两份遗留样式已删（原来 `CSS` 只被加载态用到，现在加载态也用 `CSS_FINAL`）。
   原先只在 `CSS` 里定义、但组件还在用的 `.wg-launch*` / `.wg-tv*` 已搬进 `CSS_FINAL`（这两个在 `.wg-wrap` 外，直接用主题 token）。
3. **文案补齐**：中英字典各补 `noneSelected / noteLabel / qnoteLabel / doneHint / overallLabel`；
   并在 `apply()` 里 `ctx.locale.register(NS, { zh, en })` —— 以前从没注册过，`locale/*.json` 只有 `meta`，
   所以英文界面实际一直回落成中文兜底。`locale/*.json` 仍只保留 `meta`（给插件中心用），字典单一来源在 `client.js`。

### 9.2 已验证

- `node --check client.js` 通过；`package.json` 版本号已改 0.5.0。
- 离线冒烟（`.tmp-verify/smoke.mjs`，不进仓库）：用 React 桩把面板渲染成 JSON，
  覆盖 未提交可编辑 / 已提交只读回放（含备注、整题备注、未选项、整体补充）/ 主按钮消失 / 回传格式不变，全部通过。
- **未验证**：真实 DSH 界面里的观感（需要重启 DSH 后看实际面板）。

### 9.3 仍然没做

- 截图（`docs/` 仍未建）、`git init` 与推 GitHub、加 topic、提交 plugin-hub issue。
- ❗ **插件加载路径仍指旧目录**：`~/.dsh/profiles/desktop/package.json` 里是
  `"dsh-work-summary-gate": "link:D:/project/wisdom_wenxing/dsh-plugins/work-summary-gate"`。
  用户本轮明确选择“先别动，接线我自己手动改”，所以本会话**没有改**这个链接；换目录后要重启 DSH 才生效。
