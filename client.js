// ============================================================================
// task-decision · 浏览器半部
// ----------------------------------------------------------------------------
// 【整条链路】
//   1) 模型在回复末尾输出 <!-- dsh-gate:start … dsh-gate:end --> 标记块
//   2) 会话页头里的「探针」组件（零尺寸）监听会话输出；等 running===false 后解析
//   3) 解析成功 → 写进模块级 store → 自动打开右侧边栏的「本轮工作 & 待拍板」tab
//   4) 用户在面板里选选项、写备注 → 点「提交拍板」
//   5) 调用 ctx.sessions.scope(sessionId).conversation.send(text) 把结构化回传发回会话
//
// 【为什么解析放在页头探针而不是面板里】
//   面板只有用户打开时才挂载；如果用户没开面板，这一轮就丢了。
//   页头探针一直挂着，能在每轮结束时把结果接住，再决定要不要自动开 tab。
//
// 【为什么等 running===false 再解析】
//   流式输出时 JSON 只有半截，提前解析会反复失败、还可能把半截结果渲染出来。
//   这里只在"不 running"时读最后一次 assistant 文本，并做 JSON 完整性校验，失败静默。
// ============================================================================

window.__ModuleLoader__.load({
  id: 'task-decision',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useRef, useState, useEffect, useSyncExternalStore } = React;

    const NS = 'task-decision';
    const START = 'dsh-gate:start';
    const END = 'dsh-gate:end';
    const TAB_KIND = 'task-decision';
    const TAB_ID = 'task-decision';

    // ------------------------------------------------------------------
    // 文案
    // ------------------------------------------------------------------
    const zh = {
      tab: '本轮工作 & 待拍板',
      empty: '本轮无待拍板',
      emptyHint: 'AI 这一轮没有需要你拍板的事项。',
      summary: '本轮摘要',
      questions: '待拍板',
      submit: '提交拍板',
      sending: '提交中…',
      submitted: '已提交，AI 会继续干活',
      retry: '重试',
      note: '备注（可选）',
      // ⭐【2026-10 新增】每题一个"常驻"备注框：
      //   原来备注只在"选中某个选项后"才出现，结果是
      //   —— 上面的选项我都不想要，就没地方写东西，也就提交不了。
      qnote: '上面都不合适？把你想怎么做写在这里（写了这一项就可以不选）',
      needPickOrNote: '这题既没选、也没写备注',
      noSummary: '（模型这轮没给摘要）',
      selectOne: '单选',
      selectMany: '多选',
      loading: '等待本轮结果…',
      parseFail: '标记块解析失败（已忽略）',
      needPick: '还有题目没选，也没写备注',
      overall: '整体补充（可选）',
      overallHint: '对整轮结果的补充说明，可留空',
      toolview: '本轮有待拍板项，见右侧面板',
      open: '打开面板',
      launcher: '拍板',
      launchedTip: '本轮工作 & 待拍板（重新打开）',
      submittedShort: '已提交',
      needPickShort: '还有未选',
      expand: '展开全部',
      collapse: '收起',
      overallAdd: '其他补充',
      needPickOne: '这题还没选',
      sendFail: '发送失败',
      retrySend: '重试发送',
      submittedSub: 'AI 会继续干活',
      footHint: '选好（或写备注）后点提交，会发回当前会话',
      // ⭐【0.5.0】已提交后的只读回放文案
      noneSelected: '未选项',
      noteLabel: '备注：',
      qnoteLabel: '整题备注：',
      doneHint: '新的拍板会替换这里',
      overallLabel: '整体补充',
      // ⭐【0.6.0】附件相关
      attachAdd: '添加附件',
      attachHint: 'Ctrl+V 粘贴截图/文件，或点「添加附件」',
      attachBusy: '处理中…',
      attachFailed: '附件失败',
      attachRemove: '移除这个附件',
      attachWait: '还有附件没处理完，稍等再提交',
      attachUnavailable: '当前 DSH 未提供附件上传服务',
    };
    const en = {
      tab: 'Work Summary & Gate',
      empty: 'No decisions pending',
      emptyHint: 'Nothing needs your call in this turn.',
      summary: 'Summary',
      questions: 'Decisions',
      submit: 'Send decisions',
      sending: 'Sending…',
      submitted: 'Sent — the agent will continue',
      retry: 'Retry',
      note: 'Note (optional)',
      qnote: 'None of these fit? Write your own answer here (then you may leave the options empty)',
      needPickOrNote: 'Neither an option nor a note was given',
      noSummary: '(the model gave no summary)',
      selectOne: 'single',
      selectMany: 'multi',
      loading: 'Waiting for this turn…',
      parseFail: 'Gate block could not be parsed (ignored)',
      needPick: 'Some questions are neither answered nor annotated',
      overall: 'Overall note (optional)',
      overallHint: 'Anything else about this turn',
      toolview: 'This turn has decisions — see the right panel',
      open: 'Open panel',
      launcher: 'Decisions',
      launchedTip: 'Work summary & decisions (reopen)',
      submittedShort: 'Sent',
      needPickShort: 'unanswered',
      expand: 'Show all',
      collapse: 'Collapse',
      overallAdd: 'Additional note',
      needPickOne: 'Not selected yet',
      sendFail: 'Send failed',
      retrySend: 'Retry',
      submittedSub: 'The agent will continue',
      footHint: 'Submit to send back to this session',
      noneSelected: 'No option selected',
      noteLabel: 'Note: ',
      qnoteLabel: 'Overall note: ',
      doneHint: 'A new gate will replace this',
      overallLabel: 'Overall note',
      attachAdd: 'Add attachment',
      attachHint: 'Ctrl+V to paste a screenshot/file, or click Add attachment',
      attachBusy: 'Working…',
      attachFailed: 'Attachment failed',
      attachRemove: 'Remove this attachment',
      attachWait: 'Attachments are still being processed — try again in a moment',
      attachUnavailable: 'This DSH build does not provide attachment upload',
    };

    // ------------------------------------------------------------------
    // 标记块解析
    //   兼容两种写法：
    //   a) JSON 在注释内部：<!-- dsh-gate:start {json} dsh-gate:end -->
    //   b) 用户给的规范：<!-- dsh-gate:start --> {json} <!-- dsh-gate:end -->
    // ------------------------------------------------------------------
    function normalizeGate(obj) {
      if (!obj || typeof obj !== 'object') return null;
      const questions = Array.isArray(obj.questions) ? obj.questions : [];
      const clean = questions
        .filter((q) => q && typeof q.id === 'string' && Array.isArray(q.options))
        .map((q) => ({
          id: q.id,
          title: String(q.title || q.id),
          prompt: String(q.prompt || ''),
          type: q.type === 'multi' ? 'multi' : 'single',
          options: q.options
            .filter((o) => o && typeof o.id === 'string')
            .map((o) => ({ id: o.id, label: String(o.label || o.id) })),
        }));
      return {
        summary: typeof obj.summary === 'string' ? obj.summary : '',
        questions: clean,
      };
    }

    // 【v0.2 主路径】从 tool-result 节点里取 gate_ask 的参数
    //   legacy 节点形如 { kind:'tool-result', call:{ name, argsRaw } }
    function parseToolGate(nodes) {
      if (!Array.isArray(nodes)) return null;
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const n = nodes[i];
        if (!n || n.kind !== 'tool-result' || !n.call) continue;
        if (n.call.name !== 'gate_ask') continue;
        const raw = n.call.argsRaw;
        if (typeof raw !== 'string' || !raw) continue;
        try { return normalizeGate(JSON.parse(raw)); } catch (e) { return null; }
      }
      return null;
    }

    // 【兼容路径】正文里的文本标记块（v0.1 的写法，保留不删）
    function extractGate(text) {
      if (typeof text !== 'string' || !text) return null;
      const s = text.indexOf(START);
      if (s < 0) return null;
      const e = text.indexOf(END, s + START.length);
      if (e < 0) return null;
      let raw = text.slice(s + START.length, e);
      // 去掉两端的注释符号 / 可能包裹的代码围栏
      raw = raw.replace(/^\s*-->/, '').replace(/<!--\s*$/, '').trim();
      raw = raw.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
      if (!raw) return null;
      let obj = null;
      try {
        obj = JSON.parse(raw);
      } catch (err) {
        return null;             // 半截 JSON / 非法内容：静默降级
      }
      if (!obj || typeof obj !== 'object') return null;
      const questions = Array.isArray(obj.questions) ? obj.questions : [];
      const clean = questions
        .filter((q) => q && typeof q.id === 'string' && Array.isArray(q.options))
        .map((q) => ({
          id: q.id,
          title: String(q.title || q.id),
          prompt: String(q.prompt || ''),
          type: q.type === 'multi' ? 'multi' : 'single',
          options: q.options
            .filter((o) => o && typeof o.id === 'string')
            .map((o) => ({ id: o.id, label: String(o.label || o.id) })),
        }));
      return {
        summary: typeof obj.summary === 'string' ? obj.summary : '',
        questions: clean,
      };
    }

    // ------------------------------------------------------------------
    // 跨组件 store：探针写入，面板读取（按 sessionId 分区）
    // ------------------------------------------------------------------
    const gates = new Map();     // sessionId -> { gate, key, at }
    const listeners = new Set();
    function emit() { listeners.forEach((fn) => fn()); }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function getGate(sessionId) {
      const row = gates.get(sessionId);
      return row ? row.gate : null;
    }
    function setGate(sessionId, gate) {
      const key = JSON.stringify(gate);
      const prev = gates.get(sessionId);
      if (prev && prev.key === key) return false;
      // 新的一轮结果进来时保留 submittedKey（旧轮的），新 key 与它不等 → 角标重新计数
      gates.set(sessionId, { gate, key, at: Date.now(), submittedKey: prev ? prev.submittedKey : '' });
      emit();
      return true;
    }

    // 用户点过「提交拍板」后，角标不再计数（否则提交完还显示 3 条）
    // ⭐【0.5.0】同时把「这一轮到底提交了什么」存进 store：
    //   面板一关，React 局部 state 就没了；重开时要靠这份快照做只读回放，
    //   否则用户只看到「已提交」三个字，回头想核对选了哪几项都看不到。
    function markSubmitted(sessionId, snapshot) {
      const row = gates.get(sessionId);
      if (!row) return;
      gates.set(sessionId, Object.assign({}, row, {
        submittedKey: row.key,
        submittedSnapshot: snapshot || null,
      }));
      emit();
    }

    function makeT(ctx) {
      let bind = null;
      try { bind = ctx.locale.bind(NS); } catch (e) { bind = null; }
      return new Proxy({}, {
        get(_t, key) {
          if (typeof key !== 'string') return undefined;
          let v = null;
          try { v = bind ? bind(key) : null; } catch (e) { v = null; }
          // 【为什么要有本地兜底】locale 服务的字典键可能和当前 locale id 对不上，
          // 一旦没命中，bind() 会把 key 原样返回 —— 面板上就会冒出 summary / single / launcher
          // 这种英文小写词。这里直接落到本地中文表，保证永远不会把 key 露给用户。
          if (v === undefined || v === null || v === key) v = zh[key];
          if (v === undefined || v === null) v = key;
          return v;
        },
      });
    }

    // ------------------------------------------------------------------
    // 探针：挂在会话页头，零尺寸；每轮结束解析一次
    // ------------------------------------------------------------------
    function GateProbe(props) {
      const { sessionId, useChat, useSessionStatus, onGate, t } = props;
      const running = useSessionStatus((state) => {
        if (!state || typeof state.get !== 'function') return false;
        const st = state.get(sessionId);
        return !!(st && st.running === true);
      });
      // 【引用稳定】selector 返回数组本身（或同一个 EMPTY 常量），不要返回新对象，
      // 否则 useSyncExternalStore 会认为快照一直在变。
      const EMPTY = [];
      const nodes = useChat((state) => {
        const legacy = state && state.legacy ? state.legacy : null;
        return legacy && Array.isArray(legacy.nodes) ? legacy.nodes : EMPTY;
      });

      useEffect(() => {
        if (running) return;                       // 流式输出中不解析
        if (!nodes || !nodes.length) return;
        // 1) 主路径：工具调用 gate_ask 的参数
        let gate = parseToolGate(nodes);
        // 2) 兼容路径：正文里的文本标记块
        if (!gate) {
          let text = '';
          for (let i = nodes.length - 1; i >= 0; i -= 1) {
            const node = nodes[i];
            if (!node || node.kind !== 'assistant' || !Array.isArray(node.blocks)) continue;
            text = node.blocks
              .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
              .map((b) => b.text)
              .join('\n');
            if (text) break;
          }
          gate = extractGate(text);
        }
        if (!gate) return;
        const changed = setGate(sessionId, gate);
        if (changed && gate.questions.length && typeof onGate === 'function') onGate();
      }, [running, nodes, sessionId]);

      return null;                                  // 零尺寸
    }

    // ------------------------------------------------------------------
    // 组装【拍板回传】文本
    //   ⭐【2026-10 改动一】整题备注 qNotes：
    //     · 有选也有备注 → 「q1（标题）: 选 a「…」；整题备注：xxx」
    //     · 没选但有备注 → 「q2（标题）: 未选项；整题备注：xxx」（"选项都不满意"的表达）
    //     · 都没有       → 「q3（标题）: 未选择」（这种在提交时就会被拦住）
    //
    //   ⭐【2026-10 改动二】**把问题标题一起带回**
    //     【为什么】原来只回 `q1: 选 b「…」`。选项文字虽然自解释，但
    //       "q1 到底在问哪件事"这个上下文丢了 —— 长会话里一旦上下文被压缩，
    //       AI 只看到"用户选了 b"却不知道 b 是什么问题下的 b，很可能办错方向。
    //       现在把标题放进括号里，AI 拿到回传就能对上"这是哪个问题、选了什么"。
    // ------------------------------------------------------------------
    /** 一题的「文字答案」行：选了什么 / 未选项 + 整题备注 */
    function qAnswerLine(q, picked, notes, qNotes, hasAttach) {
      const sel = picked[q.id] || [];
      const qn = String((qNotes && qNotes[q.id]) || '').trim();
      const tail = qn ? '；整题备注：' + qn : '';
      // ⭐ 问题标题一并带回（没有标题就退化成纯代号，不至于报错）
      const title = String(q.title || '').trim();
      const head = q.id + (title ? '（' + title + '）' : '');
      // 【为什么 hasAttach 要影响这里】只有附件没有文字的题，写「未选择」会让模型以为用户弃权；
      //   改成「未选项（见下方附件）」才能表达"答案就在附件里"。
      if (!sel.length) return head + ': ' + (qn ? '未选项' : (hasAttach ? '未选项（答案见下方附件）' : '未选择')) + tail;
      const parts = sel.map((oid) => {
        const opt = q.options.find((o) => o.id === oid);
        const label = opt ? opt.label : oid;
        const note = notes[q.id] && notes[q.id][oid];
        return note
          ? oid + '「' + label + '」（备注：' + note + '）'
          : oid + '「' + label + '」';
      });
      return head + ': 选 ' + parts.join('、') + tail;
    }

    function buildReturn(gate, picked, notes, qNotes, overall) {
      const lines = ['【拍板回传】'];
      gate.questions.forEach((q) => { lines.push(qAnswerLine(q, picked, notes, qNotes)); });
      if (overall && overall.trim()) lines.push('（整体补充：' + overall.trim() + '）');
      return lines.join('\n');
    }

    function fmtBytes(n) {
      const v = Number(n) || 0;
      if (v < 1024) return v + ' B';
      if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
      return (v / 1024 / 1024).toFixed(1) + ' MB';
    }

    /**
     * ⭐【0.6.0】把「文字 + 附件」组装成 DSH 的消息内容块。
     *   DSH 的消息通道只认三种块：
     *     { type:'text',  text }                          文字
     *     { type:'image', mediaType, data, name }         图片（内联 base64，宿主负责规范化保存）
     *     { type:'file',  receiptId }                     任意文件（先用 fileUpload 上传拿收据）
     *   顺序 = 先写这题的文字，紧跟这题的附件，逐题串下去——
     *   这样模型读到某个图片/文件时，它前面紧挨着的那行就是"这属于哪道题"。
     */
    function buildPromptContent(gate, picked, notes, qNotes, overall, attachments) {
      const blocks = [{ type: 'text', text: '【拍板回传】' }];
      gate.questions.forEach((q) => {
        const list = (attachments && attachments[q.id]) || [];
        blocks.push({ type: 'text', text: qAnswerLine(q, picked, notes, qNotes, list.length > 0) });
        list.forEach((f, i) => {
          blocks.push({
            type: 'text',
            text: '  附件 ' + (i + 1) + '/' + list.length + '：' + f.name
              + '（' + (f.kind === 'image' ? '图片' : '文件') + '，' + fmtBytes(f.size) + '）',
          });
          if (f.kind === 'image' && f.data) {
            blocks.push({ type: 'image', mediaType: f.mediaType, data: f.data, name: f.name });
          } else if (f.receiptId) {
            blocks.push({ type: 'file', receiptId: f.receiptId });
          }
        });
      });
      if (overall && overall.trim()) blocks.push({ type: 'text', text: '（整体补充：' + overall.trim() + '）' });
      return blocks;
    }

    // ------------------------------------------------------------------
    // 面板
    // ------------------------------------------------------------------
    function GatePanel(props) {
      const { t, submit, sessionId, collapse, upload } = props;
      const row = useSyncExternalStore(
        subscribe,
        () => gates.get(sessionId) || null,
        () => gates.get(sessionId) || null,
      );
      const gate = row ? row.gate : null;
      const submittedRow = !!(row && row.submittedKey && row.submittedKey === row.key);
      const [picked, setPicked] = useState({});     // { qid: [oid] }
      const [notes, setNotes] = useState({});       // { qid: { oid: text } }
      // ⭐【2026-10 新增】每题一个常驻备注 { qid: text }
      //   【为什么必须有】原来的备注只在"选中某个选项"后才出现，
      //   于是"上面的选项我都不想要"时——既没法表达意见，也提交不了。
      const [qNotes, setQNotes] = useState({});
      // ⭐【0.6.0】每题附件：{ qid: [entry] }
      //   entry = { id, name, size, kind:'image'|'file', mediaType, previewUrl, data(base64),
      //             receiptId, status:'reading'|'uploading'|'ready'|'error', error, promise }
      //   【为什么用 ref 而不是 state】上传进度回调是异步的，闭包里必须读到最新列表；
      //   再用一个计数器触发重渲染，避免「state 快照过期 → 进度/状态丢更新」。
      const attachRef = useRef({});
      const fileInputRef = useRef(null);
      const filePickTarget = useRef('');
      const [, setAttachTick] = useState(0);
      const bumpAttach = () => setAttachTick((n) => n + 1);
      /**
       * ⭐【2026-10 新增】防重复提交的**同步锁**
       *
       * 【为什么不能用 phase 判断就够了】
       *   `setPhase('sending')` 是 React 状态更新，是**异步**的（要等下一次渲染才生效）。
       *   用户手快连点两下时，两次 click 事件可能在同一帧里都进来，
       *   两次都看到 phase 还是旧值 → 两次都通过校验 → **往会话里发了两条一样的拍板消息**。
       *   ref 是同步可读写的，赋值立刻生效，才能真正堵住这种"同一 tick 双击"。
       *
       * 【为什么成功后也要释放】成功后再提交由 submittedRow（下面那个"已提交闸"）拦住，
       *   不需要一直占着锁；万一 submit 抛异常，释放后才能"重试发送"。
       */
      const sendLock = useRef(false);
      const [overall, setOverall] = useState('');
      const [phase, setPhase] = useState('idle');   // idle | sending | done | error
      const [err, setErr] = useState('');
      const [invalid, setInvalid] = useState(false);      // 点过提交但还有题没选
      const [summaryOpen, setSummaryOpen] = useState(false);
      const [overallOpen, setOverallOpen] = useState(false);
      const gateKey = row ? row.key : '';

      // 新的一轮结果进来：清空上一轮的选择（备注也跟着清，避免串题）
      useEffect(() => {
        setPicked({});
        setNotes({});
        setQNotes({});
        attachRef.current = {};
        setOverall('');
        setPhase('idle');
        setErr('');
      }, [gateKey]);

      if (!gate) {
        return h('div', { className: 'wg-wrap' },
          h('style', null, CSS_FINAL),
          h('div', { className: 'wg-empty' },
            h('span', { className: 'wg-empty-ico' }),
            h('div', { className: 'wg-loading' }, t.loading)));
      }

      const toggle = (q, oid) => {
        setPicked((prev) => {
          const cur = prev[q.id] || [];
          if (q.type === 'multi') {
            return Object.assign({}, prev, {
              [q.id]: cur.includes(oid) ? cur.filter((x) => x !== oid) : cur.concat([oid]),
            });
          }
          return Object.assign({}, prev, { [q.id]: [oid] });
        });
        setPhase('idle');
        setInvalid(false);
      };
      const setNote = (qid, oid, value) => {
        setNotes((prev) => {
          const q = Object.assign({}, prev[qid] || {});
          q[oid] = value;
          return Object.assign({}, prev, { [qid]: q });
        });
      };
      // ⭐【2026-10】整题备注：写一个字就不再算"这题没答"
      const setQNote = (qid, value) => {
        setQNotes((prev) => Object.assign({}, prev, { [qid]: value }));
        setPhase('idle');
        setInvalid(false);
      };

      // ==================================================================
      //  ⭐【0.6.0】附件：每题独立的「粘贴 / 选文件」区（拖拽已在 0.6.1 去掉）
      //    图片 → 直接读成 base64，随消息内联发出（DSH 宿主会验格式并规范化保存）
      //    其他文件 → 立即后台上传到 DSH 的 fileUpload 服务，拿到 receiptId，提交时只引收据
      //    【为什么图片不也上传】DSH 的图片块就是内联 base64，没有收据一说；
      //                      而普通文件必须走上传，否则模型只能收到一段无意义的字符串。
      // ==================================================================
      const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      const entriesOf = (qid) => attachRef.current[qid] || [];
      const nextAttachId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

      const readImageBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result || '');
          const i = url.indexOf(',');
          resolve(i >= 0 ? url.slice(i + 1) : '');
        };
        reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
        reader.readAsDataURL(file);
      });

      const addFiles = (qid, fileList) => {
        const list = Array.from(fileList || []).filter(Boolean);
        if (!list.length) return;
        const bucket = attachRef.current[qid] || (attachRef.current[qid] = []);
        list.forEach((file) => {
          const kind = IMAGE_TYPES.includes(file.type) ? 'image' : 'file';
          const entry = {
            id: nextAttachId(),
            name: file.name || (kind === 'image' ? '粘贴的图片' : '未命名文件'),
            size: file.size,
            kind,
            mediaType: kind === 'image' ? file.type : undefined,
            status: kind === 'image' ? 'reading' : 'uploading',
          };
          if (kind === 'image') {
            entry.previewUrl = URL.createObjectURL(file);
            entry.promise = readImageBase64(file)
              .then((data) => { entry.data = data; entry.status = 'ready'; })
              .catch((e) => { entry.status = 'error'; entry.error = (e && e.message) || String(e); })
              .finally(bumpAttach);
          } else if (typeof upload === 'function') {
            const controller = new AbortController();
            entry.abort = () => controller.abort();
            entry.promise = Promise.resolve()
              .then(() => upload(sessionId, file, file.name || undefined, controller.signal, (progress) => {
                if (progress && progress.loaded !== undefined) entry.loaded = progress.loaded;
                if (progress && progress.total !== undefined) entry.total = progress.total;
                bumpAttach();
              }))
              .then((res) => {
                if (res && res.ok === false) throw new Error((res.error && res.error.message) || '文件上传失败');
                const value = res && res.value ? res.value : res;
                if (!value || !value.receiptId) throw new Error('文件上传没有返回收据');
                entry.receiptId = value.receiptId;
                entry.status = 'ready';
              })
              .catch((e) => { entry.status = 'error'; entry.error = (e && e.message) || String(e); })
              .finally(bumpAttach);
          } else {
            entry.status = 'error';
            entry.error = t.attachUnavailable;
          }
          bucket.push(entry);
        });
        bumpAttach();
      };

      const removeAttach = (qid, id) => {
        const bucket = attachRef.current[qid] || [];
        const entry = bucket.find((x) => x.id === id);
        if (entry) {
          try { if (entry.abort) entry.abort(); } catch (e) { /* 取消失败不影响移除 */ }
          try { if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); } catch (e) { /* 同上 */ }
        }
        attachRef.current[qid] = bucket.filter((x) => x.id !== id);
        bumpAttach();
      };

      const pickFiles = (qid) => {
        filePickTarget.current = qid;
        const el = fileInputRef.current;
        if (el) { el.value = ''; el.click(); }
      };

      const filesFromClipboard = (clipboard) => {
        const out = [];
        if (!clipboard) return out;
        if (clipboard.items && clipboard.items.length) {
          for (const item of clipboard.items) {
            if (item.kind === 'file') {
              const f = item.getAsFile();
              if (f) out.push(f);
            }
          }
        }
        if (!out.length && clipboard.files && clipboard.files.length) {
          for (const f of clipboard.files) out.push(f);
        }
        return out;
      };

      /** 这一题算不算"已答复"：选了选项、写了整题备注，或者挂了附件 */
      const answeredOf = (q) => (picked[q.id] || []).length > 0
        || String(qNotes[q.id] || '').trim().length > 0
        || entriesOf(q.id).length > 0;

      /**
       * ⭐【0.5.0】已提交后的只读回放行：
       *   · 选了选项 → 每项一行「✓ 选项文字」，该选项有单独备注就跟一行「备注：…」
       *   · 一个都没选（整题备注否决型）→ 「未选项」
       *   · 整题备注 → 最后一行「整题备注：…」
       * 【为什么要回放】提交后输入控件全没了，不回放的话用户无法核对
       *   “我到底提交了什么”，只能翻聊天记录；这一步不该让人去回忆。
       */
      const replayRows = (q) => {
        const sel = replay ? (replay.picked[q.id] || []) : [];
        const qn = replay ? String((replay.qNotes && replay.qNotes[q.id]) || '').trim() : '';
        const rows = [];
        q.options.forEach((o) => {
          if (!sel.includes(o.id)) return;
          rows.push(h('div', { key: 'a-' + o.id, className: 'wg-answer' },
            h('span', { className: 'wg-answer-label' }, o.label)));
          const on = replay && replay.notes && replay.notes[q.id] ? replay.notes[q.id][o.id] : '';
          if (on && String(on).trim()) {
            rows.push(h('div', { key: 'n-' + o.id, className: 'wg-answer-note' }, t.noteLabel + on));
          }
        });
        if (!sel.length) {
          rows.push(h('div', { key: 'none', className: 'wg-answer wg-answer-none' }, t.noneSelected));
        }
        if (qn) rows.push(h('div', { key: 'qn', className: 'wg-answer-note' }, t.qnoteLabel + qn));
        return rows;
      };

      /** 已提交后的附件回放：显示文件名/大小，图片还能看到缩略图 */
      const replayAttachRows = (q) => {
        const list = replay && replay.attachments && replay.attachments[q.id] ? replay.attachments[q.id] : [];
        if (!list.length) return null;
        return h('div', { className: 'wg-attach-list wg-attach-list-readonly' },
          list.map((e, i) => h('div', { key: 'rf-' + i, className: 'wg-attach-item' },
            e.kind === 'image' && e.previewUrl
              ? h('img', {
                className: 'wg-attach-thumb',
                src: e.previewUrl,
                alt: '',
                // 页面刷新后 blob: 预览会失效，隐藏而不是留一个碎图标
                onError: (ev2) => { if (ev2 && ev2.target) ev2.target.style.display = 'none'; },
              })
              : h('span', { className: 'wg-attach-ico' }, e.kind === 'image' ? 'IMG' : 'FILE'),
            h('span', { className: 'wg-attach-name', title: e.name }, e.name),
            h('span', { className: 'wg-attach-meta' }, fmtBytes(e.size)))));
      };

      // ⭐【0.6.1】只保留粘贴：拖拽已放弃（DSH 自己在 document 冒泡阶段接管了
      //   dragenter/dragover/drop，全窗口弹遮罩、松手直接进聊天框；题卡拿不到事件）。
      //   要恢复拖拽必须先解决“事件被全局遮罩抢走”的问题，否则只能误导用户。
      const handlePaste = (qid, ev) => {
        const cb = ev.clipboardData || (ev.nativeEvent && ev.nativeEvent.clipboardData);
        const files = filesFromClipboard(cb);
        if (!files.length) return;
        ev.preventDefault();
        addFiles(qid, files);
      };

      const onSend = async () => {
        // ==================================================================
        //  ⭐⭐【2026-10 防重复提交（两道闸）】
        // ==================================================================
        //  闸①（同步锁）：连点两下 —— 见 sendLock 的说明。
        //  闸②（已提交闸）：同一个 gateKey 已经提交过就不再允许提交。
        //     【为什么需要】原来只把"刚提交完"标成 done，但**关掉面板再打开**时
        //     phase 会重置成 idle，界面上又能点一次「提交拍板」→
        //     同一批决策被发第二遍，AI 会重复执行（例如把同一批学生再办一次）。
        //     submittedRow 就是"这一轮是否已提交过"的判据（新的一轮 gateKey 变了会自动放开）。
        if (sendLock.current) {
          return;
        }
        if (submittedRow) {
          return;
        }

        // ⭐【2026-10 改】判断标准从"必须选了选项"放宽成"选了 **或** 写了备注"。
        //   【为什么】原来的规则是"每题必须选中一个选项"，但现实里经常是
        //   "你给的几个选项我都不想要，我想按另一种方式做" ——
        //   那时候既没有可选项、也没有输入框（旧版备注只在选中后才出现），
        //   用户就被卡死在这一步，只能放弃面板、跑回聊天里打字。
        let missing = false;
        gate.questions.forEach((q) => { if (!answeredOf(q)) missing = true; });
        if (missing && gate.questions.length) {
          setInvalid(true);
          setErr('');
          return;
        }
        setInvalid(false);
        setPhase('sending');
        setErr('');
        // 进入临界区：从这一刻起到 finally 之前，任何再次点击都会被闸①挡掉
        sendLock.current = true;
        try {
          // ⭐【0.6.0】先把附件都等就绪：图片读成 base64、文件拿到 receiptId。
          //   只要有一个失败，整条不发 —— 半截附件发出去会让 AI 对着不存在的文件干活。
          const allEntries = [];
          gate.questions.forEach((q) => { for (const e of entriesOf(q.id)) allEntries.push(e); });
          if (allEntries.length) {
            const pending = allEntries.map((e) => (e.promise ? e.promise.catch(() => {}) : null)).filter(Boolean);
            if (pending.length) await Promise.all(pending);
            const failed = allEntries.filter((e) => e.status === 'error');
            if (failed.length) {
              throw new Error(t.attachFailed + '：' + failed.map((e) => e.name + '（' + (e.error || '') + '）').join('；'));
            }
            if (allEntries.some((e) => e.status !== 'ready')) throw new Error(t.attachWait);
          }
          const attachments = {};
          const snapshotAttach = {};
          gate.questions.forEach((q) => {
            const es = entriesOf(q.id);
            if (!es.length) return;
            attachments[q.id] = es.map((e) => ({
              name: e.name, size: e.size, kind: e.kind,
              mediaType: e.mediaType, data: e.data, receiptId: e.receiptId,
            }));
            // 回放快照只存展示需要的字段（不带 base64，免得把 store 撞大）
            snapshotAttach[q.id] = es.map((e) => ({
              name: e.name, size: e.size, kind: e.kind, previewUrl: e.previewUrl,
            }));
          });
          await submit(sessionId, buildPromptContent(gate, picked, notes, qNotes, overall, attachments));
          // ⭐【0.5.0】提交前存一份快照，供只读回放用（面板关掉重开也看得到）
          markSubmitted(sessionId, { picked, notes, qNotes, overall, attachments: snapshotAttach });
          setPhase('done');
          setPicked({});
          setNotes({});
          setQNotes({});
          setOverall('');
          attachRef.current = {};
          // ⭐【2026-10 新增】提交成功后**自动收起右侧栏**，把注意力还给 AI 的回复
          //   【为什么延迟 350ms 再收】先把"已提交"这个状态渲染出来，
          //   让用户看到提交确实成功了；立刻收栏会让人不确定自己到底点上没有。
          if (typeof collapse === 'function') {
            setTimeout(() => {
              try { collapse(sessionId); } catch (e) { /* 收起失败不影响已提交 */ }
            }, 350);
          }
        } catch (e) {
          setPhase('error');
          setErr(e && e.message ? e.message : String(e));   // 失败保留已填内容
        } finally {
          // 无论成功失败都要释放同步锁：失败后才能点"重试发送"
          sendLock.current = false;
        }
      };

      // ⭐【0.5.0】本轮已提交 → 整个面板转只读回放：不再渲染任何输入控件，
      //   底栏只留「已提交」完成条；快照存在 store 里，关掉面板再打开也能回放。
      const readonly = !!(submittedRow);
      const replay = readonly
        ? (row && row.submittedSnapshot ? row.submittedSnapshot : { picked, notes, qNotes, overall })
        : null;
      const replayAnswered = (q) => !!(replay && (
        (replay.picked[q.id] || []).length
        || String((replay.qNotes && replay.qNotes[q.id]) || '').trim()
        || (replay.attachments && replay.attachments[q.id] ? replay.attachments[q.id].length : 0)
      ));
      const answeredCount = readonly
        ? gate.questions.filter(replayAnswered).length
        : gate.questions.filter((q) => answeredOf(q)).length;
      const total = gate.questions.length;
      const incomplete = !readonly && invalid && answeredCount < total;
      const longSummary = (gate.summary || '').length > 180;
      const flagTone = readonly ? 'ok' : (phase === 'error' ? 'bad' : (incomplete ? 'warn' : ''));
      const flagText = readonly ? t.submitted
        : (phase === 'error' ? t.sendFail : (incomplete ? t.needPickShort : ''));

      return h('div', { className: 'wg-wrap', 'data-phase': phase },
        h('style', null, CSS_FINAL),
        // ⭐【0.6.0】隐藏的文件选择器：一题一个"添加附件"按钮共用它，
        //   点按钮时先把 qid 记到 filePickTarget，再触发 click。
        h('input', {
          type: 'file',
          multiple: true,
          ref: fileInputRef,
          className: 'wg-file-input',
          onChange: (ev) => {
            const qid = filePickTarget.current;
            const files = ev.target.files;
            if (qid && files && files.length) addFiles(qid, files);
          },
        }),
        h('div', { className: 'wg-head' },
          h('span', { className: 'wg-head-title' }, t.tab),
          total ? h('span', { className: 'wg-count' }, String(total)) : null,
          flagText ? h('span', { className: 'wg-flag', 'data-tone': flagTone || undefined }, flagText) : null),

        h('div', { className: 'wg-scroll' },
          h('section', { className: 'wg-block' },
            h('div', { className: 'wg-label' }, t.summary),
            h('div', { className: 'wg-sum', 'data-empty': gate.summary ? 'false' : 'true' },
              h('div', {
                className: 'wg-sum-text',
                'data-clamped': longSummary && !summaryOpen ? 'true' : 'false',
              }, gate.summary || t.noSummary),
              longSummary
                ? h('button', {
                  className: 'wg-more',
                  onClick: () => setSummaryOpen(!summaryOpen),
                }, summaryOpen ? t.collapse : t.expand)
                : null)),

          total === 0
            ? h('div', { className: 'wg-empty' },
              h('span', { className: 'wg-empty-ico' }),
              h('div', { className: 'wg-empty-title' }, t.empty),
              h('div', { className: 'wg-empty-hint' }, t.emptyHint))
            : h('section', { className: 'wg-block' },
              h('div', { className: 'wg-qhead' },
                h('div', { className: 'wg-label' }, t.questions),
                h('span', {
                  className: 'wg-progress',
                  'data-tone': incomplete ? 'warn' : undefined,
                }, answeredCount + ' / ' + total)),
              h('div', { className: 'wg-track', 'data-tone': incomplete ? 'warn' : undefined },
                h('i', { style: { width: (total ? Math.round((answeredCount / total) * 100) : 0) + '%' } })),
              gate.questions.map((q) => {
                const sel = picked[q.id] || [];
                const answered = readonly ? replayAnswered(q) : answeredOf(q);
                const bad = !readonly && invalid && !answered;
                return h('div', {
                  className: 'wg-q',
                  key: q.id,
                  'data-answered': answered ? 'true' : 'false',
                  'data-invalid': bad ? 'true' : 'false',
                  onPaste: readonly ? undefined : (ev) => handlePaste(q.id, ev),
                },
                  h('div', { className: 'wg-q-top' },
                    h('span', { className: 'wg-no' }, String(q.id).replace(/^q/i, '') || q.id),
                    h('span', { className: 'wg-q-title' }, q.title),
                    h('span', { className: 'wg-type' }, q.type === 'multi' ? t.selectMany : t.selectOne)),
                  q.prompt ? h('div', { className: 'wg-q-prompt' }, q.prompt) : null,
                  // ⭐【0.5.0】已提交 → 只读回放；否则才是可编辑的选项 + 备注
                  readonly
                    ? h('div', { className: 'wg-answers' }, replayRows(q), replayAttachRows(q))
                    : h('div', null,
                      h('div', { className: 'wg-opts' },
                        q.options.map((o) => {
                          const on = sel.includes(o.id);
                          return h('div', { key: o.id, className: 'wg-opt-wrap' },
                            h('button', {
                              className: 'wg-opt',
                              'data-on': on ? 'true' : 'false',
                              'data-type': q.type,
                              onClick: () => toggle(q, o.id),
                            },
                              h('span', { className: 'wg-mark' }),
                              h('span', { className: 'wg-opt-label' }, o.label)),
                            on ? h('div', { className: 'wg-note-wrap' },
                              h('input', {
                                className: 'wg-note',
                                placeholder: t.note,
                                value: (notes[q.id] && notes[q.id][o.id]) || '',
                                onChange: (e) => setNote(q.id, o.id, e.target.value),
                              })) : null,
                          );
                        })),
                      // ⭐ 整题备注：**始终显示**，不依赖有没有选中选项
                      //   这样“选项都不满意”时，用户也能写下自己的想法并提交。
                      h('div', { className: 'wg-qnote-wrap' },
                        h('textarea', {
                          className: 'wg-qnote',
                          placeholder: t.qnote,
                          rows: 2,
                          value: qNotes[q.id] || '',
                          onChange: (e) => setQNote(q.id, e.target.value),
                        })),
                      // ⭐【0.6.1】附件：点按钮选文件 / 在备注框里 Ctrl+V 粘贴
                      h('div', { className: 'wg-attach' },
                        h('div', { className: 'wg-attach-bar' },
                          h('button', {
                            className: 'wg-attach-add',
                            onClick: () => pickFiles(q.id),
                          }, t.attachAdd),
                          h('span', { className: 'wg-attach-hint' }, t.attachHint)),
                        entriesOf(q.id).length
                          ? h('div', { className: 'wg-attach-list' },
                            entriesOf(q.id).map((e) => h('div', {
                              key: e.id,
                              className: 'wg-attach-item',
                              'data-status': e.status,
                            },
                              e.kind === 'image' && e.previewUrl
                                ? h('img', { className: 'wg-attach-thumb', src: e.previewUrl, alt: '' })
                                : h('span', { className: 'wg-attach-ico' }, e.kind === 'image' ? 'IMG' : 'FILE'),
                              h('span', { className: 'wg-attach-name', title: e.name }, e.name),
                              h('span', { className: 'wg-attach-meta' },
                                e.status === 'error'
                                  ? (e.error || t.attachFailed)
                                  : e.status === 'ready'
                                    ? fmtBytes(e.size)
                                    : (e.status === 'uploading' && e.total
                                      ? Math.round((e.loaded / e.total) * 100) + '%'
                                      : t.attachBusy)),
                              h('button', {
                                className: 'wg-attach-del',
                                title: t.attachRemove,
                                onClick: () => removeAttach(q.id, e.id),
                              }, '\u00d7'))))
                          : null),
                      bad ? h('div', { className: 'wg-invalid' }, t.needPickOrNote) : null),
                );
              })),

          // ⭐【0.5.0】已提交时把「整体补充」也回放出来（原来只有输入框，提交完信息就没了）
          readonly && String((replay && replay.overall) || '').trim()
            ? h('section', { className: 'wg-block' },
              h('div', { className: 'wg-label' }, t.overallLabel),
              h('div', { className: 'wg-sum' }, String(replay.overall).trim()))
            : null,

          // ⭐【0.5.0】已提交 → 只读回放，不再出现“其他补充”的输入框
          readonly ? null
            : h('section', { className: 'wg-block' },
            h('button', {
              className: 'wg-more-row',
              onClick: () => setOverallOpen(!overallOpen),
            }, overallOpen ? t.overall : t.overallAdd),
            overallOpen ? h('textarea', {
              className: 'wg-overall',
              placeholder: t.overallHint,
              value: overall,
              rows: 3,
              onChange: (e) => setOverall(e.target.value),
            }) : null)),

        h('div', { className: 'wg-foot' },
          phase === 'error' && err
            ? h('div', { className: 'wg-error' },
              h('span', { className: 'wg-error-dot' }),
              h('div', { className: 'wg-error-body' },
                h('div', { className: 'wg-error-title' }, t.sendFail),
                h('div', { className: 'wg-error-msg' }, err)),
              h('button', { className: 'wg-retry', onClick: onSend }, t.retry))
            : null,
          // ⭐【0.5.0】已提交：底栏只留完成条，主按钮彻底不渲染（不是禁用）
          readonly
            ? h('div', { className: 'wg-done' }, t.submitted,
              h('span', { className: 'wg-done-sub' }, t.doneHint))
            : h('div', { className: 'wg-status', 'data-tone': incomplete ? 'warn' : undefined },
              h('span', { className: 'wg-status-text' },
                incomplete ? t.needPick
                  : (phase === 'sending' ? t.sending : (total ? t.footHint : '')))),
          readonly ? null : h('button', {
            className: 'wg-primary',
            disabled: phase === 'sending',
            onClick: onSend,
          }, phase === 'sending' ? t.sending : (phase === 'error' ? t.retrySend : t.submit))));
    }

    // ------------------------------------------------------------------
    // 聊天流里的工具卡片：gate_ask 只显示一行，不把 JSON 摊在聊天里
    // ------------------------------------------------------------------
    function GateToolView(props) {
      const { t, open } = props;
      return h('div', { className: 'wg-tv' },
        h('span', { className: 'wg-tv-ico' }, '\uD83D\uDCCB'),
        h('span', { className: 'wg-tv-text' }, t.toolview),
        h('button', { className: 'wg-tv-btn', onClick: () => { if (typeof open === 'function') open(); } }, t.open));
    }

    // ------------------------------------------------------------------
    // 常驻入口：会话页头右侧的「拍板」按钮
    //   tab 可以被用户关掉，这个按钮永远在；有待拍板时带琥珀角标
    // ------------------------------------------------------------------
    function GateLauncher(props) {
      const { t, open, sessionId } = props;
      const row = useSyncExternalStore(
        subscribe,
        () => gates.get(sessionId) || null,
        () => gates.get(sessionId) || null,
      );
      const pending = row && row.submittedKey !== row.key && row.gate
        ? (Array.isArray(row.gate.questions) ? row.gate.questions.length : 0)
        : 0;
      const submitted = !!(row && row.submittedKey && row.submittedKey === row.key);
      return h('button', {
        className: 'wg-launch',
        'data-pending': pending > 0 ? 'true' : 'false',
        title: t.launchedTip,
        onClick: () => { if (typeof open === 'function') open(); },
      },
        h('span', { className: 'wg-launch-ico' }, '\uD83D\uDCCB'),
        h('span', null, t.launcher),
        pending > 0 ? h('span', { className: 'wg-launch-badge' }, String(pending)) : null,
        pending === 0 && submitted ? h('span', { className: 'wg-launch-done' }, '\u2713') : null);
    }



    // ------------------------------------------------------------------
    // 正式样式（按 design/ui-spec.md 附录 A）
    //   语义层 --wg-* 集中映射主题 token，组件只引用 --wg-*；
    //   头/尾固定，中间 .wg-scroll 是唯一滚动容器（不再用 sticky 叠在滚动区里）。
    // ------------------------------------------------------------------
    const CSS_FINAL = `
.wg-wrap{
  --wg-surface: var(--dsw-alias-bg-base);
  --wg-raised:  var(--dsw-alias-bg-layer-1);
  --wg-sunken:  var(--dsw-alias-bg-layer-2);
  --wg-line:    var(--dsw-alias-border-l1);
  --wg-line-2:  var(--dsw-alias-border-l2);
  --wg-text:    var(--dsw-alias-label-primary);
  --wg-text-2:  var(--dsw-alias-label-secondary);
  --wg-text-3:  var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
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
  display:flex; flex-direction:column; height:100%; min-height:0;
  background:var(--wg-surface); color:var(--wg-text);
  font-size:13px; line-height:1.7; -webkit-font-smoothing:antialiased;
}
.wg-wrap,.wg-wrap *{box-sizing:border-box}
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
.wg-flag[data-tone="warn"]{color:var(--wg-warn)}
.wg-flag[data-tone="ok"]::before{content:"";width:8px;height:4px;margin-top:-2px;
  border-left:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg)}
.wg-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  padding:14px 16px 20px;scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--wg-text-3) 30%,transparent) transparent}
.wg-scroll::-webkit-scrollbar{width:10px}
.wg-scroll::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:8px;background-clip:content-box;
  background-color:color-mix(in srgb,var(--wg-text-3) 30%,transparent)}
.wg-block + .wg-block{margin-top:16px}
.wg-label{display:flex;align-items:center;gap:8px;margin:0 0 6px;
  font-size:12px;font-weight:600;line-height:18px;color:var(--wg-text-2);letter-spacing:0}
.wg-sum{position:relative;padding:10px 12px 11px 14px;border:1px solid var(--wg-line);
  border-radius:10px;background:var(--wg-raised);font-size:13px;line-height:1.75;
  white-space:pre-wrap;overflow-wrap:anywhere}
.wg-sum::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;
  border-radius:0 2px 2px 0;background:var(--wg-accent);opacity:.45}
.wg-sum[data-empty="true"]{background:transparent;color:var(--wg-text-3);font-size:12.5px;line-height:20px}
.wg-sum[data-empty="true"]::before{display:none}
.wg-sum-text[data-clamped="true"]{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.wg-more{margin-top:4px;padding:0;border:0;background:none;cursor:pointer;
  font:inherit;font-size:11.5px;line-height:16px;color:var(--wg-text-2)}
.wg-more:hover{color:var(--wg-text)}
.wg-qhead{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.wg-qhead .wg-label{margin:0}
.wg-progress{margin-left:auto;font-size:11px;font-weight:500;line-height:16px;color:var(--wg-text-3);
  font-variant-numeric:tabular-nums;transition:color 120ms ease-out}
.wg-progress[data-tone="warn"]{color:var(--wg-warn)}
.wg-track{height:2px;margin-bottom:12px;border-radius:2px;background:var(--wg-line);overflow:hidden}
.wg-track > i{display:block;height:100%;border-radius:2px;background:var(--wg-accent);
  transition:width 160ms ease-out,background-color 160ms ease-out}
.wg-track[data-tone="warn"] > i{background:var(--wg-warn)}
.wg-q{border:1px solid var(--wg-line);border-radius:10px;padding:12px 13px;background:transparent;
  transition:border-color 140ms ease-out,background-color 140ms ease-out}
.wg-q + .wg-q{margin-top:10px}
.wg-q[data-answered="true"]{border-color:var(--wg-ring-accent)}
.wg-q[data-invalid="true"]{border-color:var(--wg-ring-bad);background:var(--wg-tint-bad)}
.wg-q-top{display:flex;align-items:flex-start;gap:8px}
.wg-no{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
  min-width:20px;height:20px;margin-top:1px;padding:0 5px;
  border:1px solid var(--wg-line-2);border-radius:6px;background:var(--wg-surface);
  font-size:11px;font-weight:600;line-height:1;color:var(--wg-text-2);font-variant-numeric:tabular-nums}
.wg-q[data-answered="true"] .wg-no{color:var(--wg-accent);border-color:var(--wg-ring-accent);background:var(--wg-tint-accent)}
.wg-q[data-invalid="true"] .wg-no{color:var(--wg-bad);border-color:var(--wg-ring-bad);background:var(--wg-tint-bad)}
.wg-q-title{flex:1 1 auto;min-width:0;font-size:13.5px;font-weight:600;line-height:21px;color:var(--wg-text);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.wg-type{flex:0 0 auto;margin-top:2px;padding:0 5px;border-radius:4px;background:var(--wg-sunken);
  font-size:11px;line-height:16px;color:var(--wg-text-3);white-space:nowrap}
.wg-q-prompt{margin:2px 0 0 28px;font-size:12.5px;line-height:20px;color:var(--wg-text-2);overflow-wrap:anywhere}
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
.wg-note-wrap{position:relative;margin:6px 0 0 25px;padding-left:10px}
.wg-note-wrap::before{content:"";position:absolute;left:0;top:1px;bottom:3px;width:2px;border-radius:2px;
  background:color-mix(in srgb,var(--wg-accent) 22%,transparent)}
.wg-note{display:block;width:100%;height:32px;padding:0 9px;border:1px solid var(--wg-line);border-radius:6px;
  background:var(--wg-sunken);color:var(--wg-text);font:inherit;font-size:12.5px;line-height:30px}
.wg-note::placeholder{color:var(--wg-text-3)}
.wg-note:focus{outline:none;border-color:var(--wg-brand);background:var(--wg-surface);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--wg-brand) 16%,transparent)}
/* ⭐ 整题备注：始终显示的输入框（不依赖是否选中了选项） */
.wg-qnote-wrap{margin-top:8px}
.wg-qnote{display:block;width:100%;min-height:46px;padding:7px 9px;resize:vertical;
  border:1px dashed color-mix(in srgb,var(--wg-line) 70%,transparent);border-radius:6px;
  background:transparent;color:var(--wg-text);font:inherit;font-size:12.5px;line-height:18px}
.wg-qnote::placeholder{color:var(--wg-text-3)}
.wg-qnote:focus{outline:none;border-style:solid;border-color:var(--wg-brand);
  background:var(--wg-surface);box-shadow:0 0 0 3px color-mix(in srgb,var(--wg-brand) 16%,transparent)}
.wg-more-row{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 2px;
  border:0;background:none;cursor:pointer;text-align:left;
  font:inherit;font-size:12px;line-height:18px;color:var(--wg-text-2)}
.wg-more-row:hover{color:var(--wg-text)}
.wg-more-row::before{content:"+";font-size:13px;line-height:1;color:var(--wg-text-3)}
.wg-overall{display:block;width:100%;min-height:64px;margin-top:6px;padding:8px 10px;resize:vertical;
  border:1px solid var(--wg-line);border-radius:8px;background:var(--wg-surface);color:var(--wg-text);
  font:inherit;font-size:12.5px;line-height:20px}
.wg-overall::placeholder{color:var(--wg-text-3)}
.wg-overall:focus{outline:none;border-color:var(--wg-brand);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--wg-brand) 16%,transparent)}
.wg-foot{position:relative;flex:0 0 auto;display:flex;flex-direction:column;gap:6px;
  padding:10px 16px 12px;border-top:1px solid var(--wg-line);background:var(--wg-surface)}
.wg-foot::before{content:"";position:absolute;left:0;right:0;top:-16px;height:16px;pointer-events:none;
  background:linear-gradient(to bottom,transparent,var(--wg-surface))}
.wg-status{display:flex;align-items:center;gap:8px;min-height:16px;
  font-size:11.5px;line-height:16px;color:var(--wg-text-3)}
.wg-status[data-tone="warn"]{color:var(--wg-warn)}
.wg-status-text{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
.wg-done{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:8px;
  background:color-mix(in srgb,var(--wg-ok) 8%,transparent);
  border:1px solid color-mix(in srgb,var(--wg-ok) 28%,transparent);
  font-size:12.5px;font-weight:600;line-height:1;color:var(--wg-ok)}
.wg-done::before{content:"";flex:0 0 auto;width:9px;height:5px;margin-top:-2px;
  border-left:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg)}
.wg-done-sub{margin-left:auto;font-size:11px;font-weight:400;color:var(--wg-text-3)}
.wg-invalid{display:flex;align-items:center;gap:5px;margin-top:8px;
  font-size:11.5px;line-height:16px;color:var(--wg-bad)}
.wg-invalid::before{content:"";width:4px;height:4px;border-radius:50%;background:currentColor}
.wg-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:30px 16px 34px;text-align:center}
.wg-empty-ico{display:flex;align-items:center;justify-content:center;width:36px;height:36px;
  margin-bottom:4px;border-radius:50%;background:var(--wg-sunken)}
.wg-empty-ico::after{content:"";width:13px;height:7px;margin-top:-3px;
  border-left:1.6px solid var(--wg-text-3);border-bottom:1.6px solid var(--wg-text-3);transform:rotate(-45deg)}
.wg-empty-title{margin:0;font-size:13px;font-weight:600;line-height:20px;color:var(--wg-text)}
.wg-empty-hint{margin:0;max-width:238px;font-size:12px;line-height:19px;color:var(--wg-text-3)}
/* 17 · 面板外：页头入口与聊天流工具卡片（不在 .wg-wrap 内，直接用主题 token） */
.wg-launch{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;
  cursor:pointer;font:inherit;font-size:12px;line-height:1;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);
  transition:background-color 140ms ease-out,border-color 140ms ease-out,color 140ms ease-out}
.wg-launch:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.wg-launch[data-pending="true"]{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
.wg-launch-ico{font-size:13px}
.wg-launch-badge{min-width:16px;height:16px;padding:0 4px;border-radius:999px;font-size:10px;line-height:16px;
  text-align:center;background:var(--dsw-alias-state-warn-primary);color:#fff;font-variant-numeric:tabular-nums}
.wg-launch-done{font-size:11px;color:var(--dsw-alias-state-success-primary)}
.wg-launch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}

.wg-tv{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);
  transition:background-color 140ms ease-out}
.wg-tv:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wg-tv-ico{font-size:13px}
.wg-tv-text{flex:1;min-width:0;color:var(--dsw-alias-label-primary)}
.wg-tv-btn{height:22px;padding:0 10px;border-radius:999px;cursor:pointer;font:inherit;font-size:11px;
  border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}
.wg-tv-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wg-tv-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

/* 18 · 已提交只读回放（选项区整体换成这个，不再给输入控件） */
.wg-answers{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.wg-answer{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:19px;color:var(--wg-text)}
.wg-answer::before{content:"";flex:0 0 auto;width:9px;height:5px;margin-top:6px;
  border-left:1.5px solid var(--wg-ok);border-bottom:1.5px solid var(--wg-ok);transform:rotate(-45deg)}
.wg-answer-none{color:var(--wg-text-3)}
.wg-answer-none::before{width:5px;height:5px;margin-top:7px;border:0;border-radius:50%;
  background:var(--wg-text-3);transform:none}
.wg-answer-label{min-width:0;overflow-wrap:anywhere}
.wg-answer-note{margin-left:17px;font-size:12px;line-height:18px;color:var(--wg-text-3);overflow-wrap:anywhere}

/* 19 · 加载态 */
.wg-loading{margin-top:4px;font-size:11.5px;line-height:16px;color:var(--wg-text-3)}

/* 20 · 键盘可见焦点 */
.wg-more:focus-visible,.wg-more-row:focus-visible,.wg-retry:focus-visible,
.wg-q:focus-visible{outline:2px solid var(--wg-brand);outline-offset:2px;border-radius:4px}

/* 21 · 每题附件：按钮行 + 已选列表 */
.wg-attach{margin-top:8px}
.wg-attach-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wg-attach-add{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:6px;
  cursor:pointer;font:inherit;font-size:11.5px;line-height:1;
  border:1px dashed var(--wg-line-2);background:transparent;color:var(--wg-text-2)}
.wg-attach-add:hover{border-color:var(--wg-accent);color:var(--wg-text)}
.wg-attach-add:focus-visible{outline:2px solid var(--wg-brand);outline-offset:1px}
.wg-attach-add::before{content:"+";font-size:13px;line-height:1;color:var(--wg-text-3)}
.wg-attach-hint{font-size:11px;line-height:16px;color:var(--wg-text-3)}
.wg-attach-list{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.wg-attach-item{display:flex;align-items:center;gap:8px;min-height:28px;padding:3px 6px;
  border:1px solid var(--wg-line);border-radius:6px;background:var(--wg-raised);
  font-size:11.5px;line-height:16px}
.wg-attach-item[data-status="error"]{border-color:var(--wg-ring-bad);background:var(--wg-tint-bad)}
.wg-attach-item[data-status="uploading"] .wg-attach-meta,
.wg-attach-item[data-status="reading"] .wg-attach-meta{color:var(--wg-text-3)}
.wg-attach-thumb{flex:0 0 auto;width:24px;height:24px;border-radius:4px;object-fit:cover;
  border:1px solid var(--wg-line-2);background:var(--wg-sunken)}
.wg-attach-ico{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
  width:24px;height:24px;border-radius:4px;background:var(--wg-sunken);
  font-size:8px;font-weight:600;color:var(--wg-text-3);letter-spacing:0}
.wg-attach-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--wg-text)}
.wg-attach-meta{flex:0 0 auto;max-width:45%;color:var(--wg-text-3);font-variant-numeric:tabular-nums;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wg-attach-del{flex:0 0 auto;width:18px;height:18px;padding:0;border:0;border-radius:4px;
  background:transparent;cursor:pointer;color:var(--wg-text-3);font:inherit;font-size:13px;line-height:1}
.wg-attach-del:hover{background:var(--wg-hover);color:var(--wg-text)}
.wg-attach-del:focus-visible{outline:2px solid var(--wg-brand);outline-offset:1px}
.wg-attach-list-readonly{margin-top:8px}
.wg-file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}

/* 12 · 提交中冻结 */
.wg-wrap[data-phase="sending"] .wg-opt{pointer-events:none}
@media (prefers-reduced-motion: reduce){
  .wg-wrap *{transition-duration:1ms !important;animation:none !important}
}
`;

    // ------------------------------------------------------------------
    // 组装回传文本
    // ------------------------------------------------------------------
    // （放在面板里内联，见 onSend；保留题号与选项 id 是硬要求）

    // ------------------------------------------------------------------
    // 插件入口
    // ------------------------------------------------------------------
    const inject = ['slots', 'locale', 'sidebarRightTabs', 'sessions'];

    // ------------------------------------------------------------------
    // 发送器（模块级，便于测试）
    //   路径 1：sessions.binding(sessionId).session.prompt(...)  ← conversation.send 内部同款
    //   路径 2：会话作用域 conversation 服务（必须用 get，不能用属性）
    // ------------------------------------------------------------------
    async function sendToSession(sessions, sessionId, content) {
      // content 可以是字符串（纯文字）或 DSH 的内容块数组（文字 + 图片 + 文件收据）
      const parts = Array.isArray(content) ? content : [{ type: 'text', text: String(content == null ? '' : content) }];
      const hasAttachments = parts.some((p) => p && (p.type === 'image' || p.type === 'file'));
      let firstError = null;
      try {
        const binding = sessions && typeof sessions.binding === 'function'
          ? sessions.binding(sessionId)
          : undefined;
        const session = binding && binding.session;
        if (session && typeof session.prompt === 'function') {
          const res = await session.prompt(parts, 'queue');
          if (res && res.ok === false) {
            const msg = res.error && res.error.message ? res.error.message : 'unknown';
            throw new Error('发送失败：' + msg);
          }
          return true;
        }
      } catch (e) {
        if (e && e.message && e.message.indexOf('发送失败') === 0) throw e;
        firstError = e;
      }
      // 退路：conversation.send 只接受纯文本，带附件时不能用
      if (!hasAttachments) {
        try {
          const text = parts.map((p) => (p && p.type === 'text' ? p.text : '')).join('');
          const scope = sessions && typeof sessions.scope === 'function' ? sessions.scope(sessionId) : undefined;
          const conv = scope && typeof scope.get === 'function' ? scope.get('conversation') : undefined;
          if (conv && typeof conv.send === 'function') {
            await conv.send(text);
            return true;
          }
        } catch (e) {
          firstError = firstError || e;
        }
      }
      throw new Error('当前会话没有可用的发送通道' + (hasAttachments ? '（带附件的消息需要 session.prompt 通道）' : '') + (firstError ? '（' + (firstError.message || firstError) + '）' : ''));
    }

    function apply(ctx) {
      const t = makeT(ctx);

      // ⭐【0.5.0 修复“英文界面仍是中文”】
      //   makeT 的兜底表永远是中文，但以前从没把 en 字典真正注册给 locale 服务：
      //   locale/*.json 里只有 meta（给插件中心用），所以 bind(key) 拿不到值 →
      //   所有文案都落到中文兜底。这里把 zh/en 两张表注册进 NS，
      //   DSH 切成英文时才能拿到英文文案（中文仍是最终兜底，不会露出 key）。
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-decision: dictionaries');
      } catch (e) { /* 旧版本 locale 服务没有 register：退化成中文兜底，不影响使用 */ }

      // 【v0.2 修复】sidebarRight 不在客户端服务目录里，ctx.inject 根本不会触发；
      // 改成调用时用 ctx.get 懒取，拿不到就静默不弹（不报错）。
      const openGateTab = () => {
        try {
          const sr = ctx.get('sidebarRight');
          if (sr && typeof sr.openTab === 'function') sr.openTab(TAB_KIND);
        } catch (e) { /* 忽略 */ }
      };

      // 发送：统一走模块级 sendToSession（两条通道 + 明确错误）
      // content 可以是字符串也可以是内容块数组（0.6.0 起支持文字+图片+文件）
      const submit = (sessionId, content) => sendToSession(ctx.sessions, sessionId, content);

      /**
       * ⭐【0.6.0】附件上传：DSH 自带的客户端服务 `fileUpload`
       *   upload(sessionId, blob, name, signal, onProgress) → { ok, value: { receiptId, file } }
       *   图片不走这里（它们内联成 base64）；这里只处理普通文件。
       *   服务缺失时返回一个 ok:false 的结果，由面板显示成"该附件上传失败"。
       */
      const uploadAttachment = (sessionId, file, name, signal, onProgress) => {
        try {
          const svc = ctx.get('fileUpload');
          if (!svc || typeof svc.upload !== 'function') {
            return Promise.resolve({ ok: false, error: { message: '当前 DSH 未提供附件上传服务（fileUpload）' } });
          }
          return svc.upload(sessionId, file, name, signal, onProgress);
        } catch (e) {
          return Promise.resolve({ ok: false, error: { message: e && e.message ? e.message : String(e) } });
        }
      };

      /**
       * ⭐【2026-10 新增】收起右侧栏（用户点「提交拍板」后调用）
       *
       * 【为什么要收】提交完这一轮就该把注意力放回 AI 的回复上；
       *   右侧栏一直占着 1/3 屏，用户还得手动去关一次，很打断节奏。
       *
       * 【怎么收】`sidebarRight` 服务背后的实现类是 SidebarRightController，
       *   它按 session 提供 actions，而"展开/收起"就是 `actions.setExpanded(sessionId, false)`
       *   ——右侧栏自己的折叠按钮用的也是这一个方法，所以和手点效果一致。
       *   `actionsFor` 在被调用前还会做"这个 session 有没有被 adopt"的判断，
       *   session 不存在时返回 undefined（不会抛错）。
       *
       * 【为什么写这么多 try/catch】
       *   DSH 版本升级时这个内部面有可能改名。收起栏是**锦上添花**的动作，
       *   绝不能因为拿不到服务就把"提交成功"这个主流程搞挂 ——
       *   所以每一层都吞掉异常，最坏情况就是"没自动收起"，用户手动关一下即可。
       */
      const collapseSidebar = (sessionId) => {
        try {
          const sr = ctx.get('sidebarRight');
          if (!sr) return false;
          // ① 正规通道：拿到该 session 的 actions，把这一列设为不展开
          if (typeof sr.actionsFor === 'function') {
            const actions = sr.actionsFor(sessionId);
            if (actions && typeof actions.setExpanded === 'function') {
              actions.setExpanded(sessionId, false);
              return true;
            }
          }
          // ② 退路：万一 controller 上直接挂了同名/近名方法
          for (const fn of ['collapse', 'hide', 'setExpanded']) {
            if (typeof sr[fn] === 'function') {
              sr[fn](sessionId, false);
              return true;
            }
          }
        } catch (e) {
          /* 收起失败不影响提交结果，静默忽略 */
        }
        return false;
      };

      // 1) 注册 tab 类型
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        title: () => t.tab,
      }), 'task-decision: tab type');

      // 2) 注册 tab 内容
      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
        locale: NS,
        inject: () => ({ t, submit, collapse: collapseSidebar, upload: uploadAttachment }),
      }, GatePanel));

      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key: 'gate_ask',
        locale: NS,
        inject: () => ({ t, open: openGateTab }),
      }, GateToolView));

      // 3) 页头常驻入口：tab 被关掉后还能从这里重新打开
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'task-decision-launcher',
        order: 59,
        locale: NS,
        inject: () => ({ t, open: openGateTab }),
      }, GateLauncher));

      // 4) 页头探针：解析本轮标记块
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'task-decision-probe',
        order: 60,
        inject: () => ({ t, onGate: () => openGateTab() }),
      }, GateProbe));
    }

    // 【调试出口】只读，供本地测试校验解析与回传格式
    try {
      window.__GATE_DEBUG__ = { extractGate, parseToolGate, normalizeGate, buildReturn, buildPromptContent, fmtBytes, setGate, getGate, markSubmitted, sendToSession, makeT };
    } catch (e) { /* 没有 window 也不影响插件 */ }

    return { inject, apply };
  },
});
