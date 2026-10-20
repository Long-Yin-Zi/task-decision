// ============================================================================
// task-decision · 宿主半部
// ----------------------------------------------------------------------------
// 【v0.2 为什么改用工具调用，而不是正文里的标记块】
//   v0.1 让模型在正文末尾输出 <!-- dsh-gate:start … --> 标记块，
//   但 DSH 的聊天渲染器不会吃掉 HTML 注释（会原样转义显示），
//   结果聊天流里出现一大坨 JSON —— 违背"不要脏聊天流"的初衷。
//   改成注册一个真正的工具 `gate_ask`：
//     · 模型调用它就等于"登记本轮摘要 + 待拍板"
//     · 聊天里显示的是一个工具卡片，客户端可以把它渲染成一行提示
//     · 参数是结构化 JSON，客户端解析 tool 调用参数即可，不用再从正文里抠文本
//
// 【这个文件做两件事】
//   1) 注册 gate_ask 工具（只登记，不做任何副作用）
//   2) 往系统提示词里加规则，要求模型每轮结束时调用它
// ============================================================================

const GATE_RULES = `## 每轮结束时登记「本轮摘要 + 待拍板」（task-decision）

你必须在每轮回复**结束前**调用一次工具 \`gate_ask\`（放在这轮最后；调用完再给最终答复也可以）：

- summary：本轮做了什么、发现了什么问题、怎么解决的（3~6 句，纯文本）。
- questions：需要用户拍板的问题数组；**没有就传空数组 []**，面板会只显示摘要。

### ⭐ 每条问题都必须「脱离对话也能看懂」

用户看面板时**不会回头翻聊天记录**。所以：

- id：q1、q2…（本轮内唯一）
- title：≤20 字，写清"问的是哪件事"，例如「成绩表要不要加索引」。
  ❌ 禁止只写代号（「B1-C」「E1」这种），用户根本不知道那是什么。
- prompt：**必须写全背景**——
  ① 这件事是什么、影响什么；
  ② 每个选项具体会做什么、代价是什么；
  ③ 如果某个选项涉及另一份待办清单，把那一项**内容本身**写出来，别只写编号。
- options[].label：**必须能独立看懂**，写成一句完整的话。
  ❌ 反例：「继续 B1-C」「方案二」「按你说的做」
  ✅ 正例：「给成绩表加联合索引（导入变快，磁盘略增）」
  ✅ 正例：「先改管理员改身份证号时的重复记录处理（避免取到旧人）」
- type：single（单选）或 multi（多选）

### 用户可以直接写备注否决所有选项

面板上**每题都有一个备注框**：用户可以不选任何选项，只写一句自己的想法就能提交。
所以：**不要因为"怕选项覆盖不到"就少给选项**，正常列出你推荐的 2~4 个即可。

规则：
1. 一轮只调用一次；不要在第 2 次回复里重复登记同一批问题。
2. 用户在【拍板回传】里已经回答过的题，按回答继续干活，不要再登记同一题。
   回传格式形如：
       q1（问题标题）：选 b「选项文字」、c「选项文字」；整题备注：……
       q2（问题标题）：未选项；整题备注：……
   · 括号里的就是**当时那个问题**（所以 title 必须写成能独立看懂的一句话）
   · 「未选项；整题备注：…」表示用户否掉了所有选项、按备注执行，**按备注办**
   · 「未选择」且无备注不会出现（面板提交时会拦住）
3. **不要在正文里用自然语言列"待拍板：…"**——正文照常写结论即可，问题全部走 gate_ask。
4. 如果这一轮只是在回答一个简单问题、完全不需要摘要，也可以不调用；但只要有决策点就必须调用。`;

export const inject = ['tools', 'systemPrompt'];

export function apply(ctx) {
  ctx.effect(
    () => ctx.tools.register({
      name: 'gate_ask',
      description: '登记本轮工作摘要与需要用户拍板的问题。每轮结束前调用一次；没有待拍板问题时 questions 传空数组。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '本轮做了什么、发现什么问题、怎么解决的' },
          questions: {
            type: 'array',
            description: '需要用户拍板的问题；没有就传空数组',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '题号，如 q1' },
                title: { type: 'string', description: '问题标题（≤20 字）。要写清问的是什么，禁止只写代号（如「B1-C」）' },
                prompt: { type: 'string', description: '必须写全背景：这件事是什么、影响什么；每个选项分别会做什么、代价是什么；涉及其他待办时把那一项的内容本身写出来，不要只写编号' },
                type: { type: 'string', enum: ['single', 'multi'], description: '单选或多选' },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: '选项 id，如 a' },
                      label: { type: 'string', description: '选项文字。必须能脱离对话独立看懂（写完整的一句话），禁止「方案二」「继续 B1-C」这类代号' },
                    },
                    required: ['id', 'label'],
                  },
                },
              },
              required: ['id', 'title', 'options'],
            },
          },
        },
        required: ['summary', 'questions'],
      },
      output: {
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, questions: { type: 'number' } },
          required: ['ok', 'questions'],
        },
        render: (args, value) => [{
          type: 'text',
          text: '已登记本轮摘要，待拍板 ' + String(value && value.questions !== undefined ? value.questions : 0) + ' 项',
        }],
      },
      async execute(args) {
        const questions = args && Array.isArray(args.questions) ? args.questions.length : 0;
        return { ok: true, questions };
      },
    }),
    'task-decision: gate_ask tool',
  );

  ctx.effect(
    () => ctx.systemPrompt.section({
      name: 'task-decision',
      order: 40,
      text: GATE_RULES,
    }),
    'task-decision: prompt rules',
  );
}
