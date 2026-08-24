import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Input, Select, Empty, Tag, Alert, Typography, message } from 'antd';
import { PlusOutlined, SettingOutlined, DeleteOutlined, SendOutlined, PaperClipOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores';
import { extractText } from './fileExtract';
import { Markdown } from './Markdown';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Usage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; }
interface Msg {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachedName?: string;     // 附件文件名（仅展示用 chip，内容不渲染进气泡）
  attachedContent?: string;  // 附件解析出的文本（发给 LLM，但不在气泡里显示，避免撑爆界面）
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  usage?: Usage;
  finish?: string;
  error?: string;
}

// 给 LLM 的完整内容：若有附件，把附件文本拼进 user 消息（界面只显示 content，不显示这段）
function llmContent(m: Msg): string {
  if (!m.attachedContent) return m.content;
  return `${m.content}\n\n附文件 ${m.attachedName || ''}：\n\`\`\`\n${m.attachedContent}\n\`\`\``;
}

interface Conv { id: string; title: string; msgs: Msg[]; updatedAt: number; }
interface Provider {
  kind: 'openai' | 'ollama';
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  system: string;
}

const LS_CONV = 'gwa-ai-chat:conversations';
// bump 到 v3：切到阿里百炼 qwen3.7-max-preview，绕过 v2 存的本地 Ollama 默认
const LS_PROV = 'gwa-ai-chat:provider:v4';

const DEFAULT_PROVIDER: Provider = {
  kind: 'openai',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: 'sk-770a9633accb4adea2880523e53d89ba',
  model: 'qwen3.7-max-2026-05-17',
  temperature: 0.7,
  system: '',
};

const PRESET_OLLAMA: Partial<Provider> = {
  kind: 'ollama',
  baseURL: 'http://localhost:11434/v1',
  model: 'gemma3:1b',
  apiKey: 'ollama',
};

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? { ...fallback, ...JSON.parse(v) } as T : fallback; }
  catch { return fallback; }
}
function save(k: string, v: unknown) { localStorage.setItem(k, JSON.stringify(v)); }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function AiChatPage() {
  const [provider, setProvider] = useState<Provider>(() => load(LS_PROV, DEFAULT_PROVIDER));
  const [convs, setConvs] = useState<Conv[]>(() => {
    // 注意：不能用下面的 load() 读数组——它的 {...fallback, ...parsed} 会把数组展成对象
    try {
      const v = JSON.parse(localStorage.getItem(LS_CONV) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string | null>(convs[0]?.id ?? null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => save(LS_PROV, provider), [provider]);
  useEffect(() => save(LS_CONV, convs), [convs]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [convs, activeId]);

  const active = convs.find((c) => c.id === activeId) ?? null;

  function newChat() {
    const c: Conv = { id: uid(), title: '新对话', msgs: [], updatedAt: Date.now() };
    setConvs((p) => [c, ...p]);
    setActiveId(c.id);
    setInput('');
  }

  // 文件附件：解析为纯文本(.txt/.md/.csv/.json/.log/代码 + .docx/.xlsx)，发送时拼进 prompt
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attached, setAttached] = useState<{ name: string; content: string; size: number } | null>(null);
  const [parsing, setParsing] = useState(false);
  const MAX_FILE_BYTES = 1024 * 1024; // 1MB 上限，避免撑爆上下文

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { message.warning(`文件过大（${(f.size/1024).toFixed(1)}KB），上限 1MB`); return; }
    setParsing(true);
    try {
      const { name, content, size } = await extractText(f);
      if (!content.trim()) { message.warning('解析出的内容为空'); return; }
      setAttached({ name, content, size });
      message.success(`已解析 ${name}（${(size/1024).toFixed(1)}KB → ${(content.length/1024).toFixed(1)}KB 文本）`);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  function delChat(id: string) {
    setConvs((p) => p.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function patchConv(id: string, fn: (c: Conv) => Conv) {
    setConvs((p) => p.map((c) => (c.id === id ? fn(c) : c)));
  }

  async function send() {
    if ((!input.trim() && !attached) || streaming) return;
    if (!provider.baseURL) { message.warning('请先在设置中填写 baseURL'); setShowSettings(true); return; }

    // 组装用户消息：显示内容 = 用户问题；附件内容单独存 attachedContent（发给 LLM 但不渲染进气泡）
    const typed = input.trim();
    const displayContent = typed || (attached ? '请分析以下附件' : '');
    const title = (typed ? typed.slice(0, 24) : (attached ? '📎 ' + attached.name : '新对话')).slice(0, 24);

    // 确保有活动对话；没有就当场建一个并以其为目标继续发送（不 return）
    let convId = active?.id;
    let baseMsgs: Msg[] = active?.msgs ?? [];
    if (!convId) {
      const c: Conv = { id: uid(), title, msgs: [], updatedAt: Date.now() };
      setConvs((p) => [c, ...p]);
      setActiveId(c.id);
      convId = c.id;
      baseMsgs = [];
    }
    const targetId = convId!;

    const userMsg: Msg = {
      id: uid(), role: 'user', content: displayContent,
      ...(attached ? { attachedName: attached.name, attachedContent: attached.content } : {}),
    };
    const assistantMsg: Msg = { id: uid(), role: 'assistant', content: '', reasoning: '', model: provider.model };
    const history = [...baseMsgs, userMsg];
    patchConv(targetId, (c) => ({ ...c, msgs: [...c.msgs, userMsg, assistantMsg], title: c.msgs.length === 0 ? title : c.title, updatedAt: Date.now() }));
    setInput('');
    setAttached(null);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const started = performance.now();

    const messages = [
      ...(provider.system ? [{ role: 'system', content: provider.system }] : []),
      ...history.map((m) => ({ role: m.role, content: llmContent(m) })),
    ];

    try {
      const res = await fetch(`${provider.baseURL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          stream: true,
          temperature: provider.temperature,
          ...(provider.kind === 'openai' ? { stream_options: { include_usage: true } } : {}),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let usage: Usage | undefined;
      let finish = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const ln of lines) {
          const line = ln.trim();
          if (!line || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            const reasoningDelta = json.choices?.[0]?.delta?.reasoning_content ?? '';
            if (reasoningDelta) {
              assistantMsg.reasoning = (assistantMsg.reasoning || '') + reasoningDelta;
              patchConv(targetId, (c) => ({ ...c, msgs: c.msgs.map((m) => m.id === assistantMsg.id ? { ...m, reasoning: assistantMsg.reasoning } : m) }));
            }
            if (delta) {
              assistantMsg.content += delta;
              patchConv(targetId, (c) => ({ ...c, msgs: c.msgs.map((m) => m.id === assistantMsg.id ? { ...m, content: assistantMsg.content } : m) }));
            }
            if (json.choices?.[0]?.finish_reason) finish = json.choices[0].finish_reason;
            if (json.usage) usage = json.usage;
          } catch { /* skip partial */ }
        }
      }

      const latencyMs = Math.round(performance.now() - started);
      patchConv(targetId, (c) => ({ ...c, msgs: c.msgs.map((m) => m.id === assistantMsg.id ? { ...m, latencyMs, usage, finish, model: provider.model } : m) }));
    } catch (e) {
      const err = e as Error;
      patchConv(targetId, (c) => ({ ...c, msgs: c.msgs.map((m) => m.id === assistantMsg.id ? { ...m, error: err.name === 'AbortError' ? '已停止' : err.message, latencyMs: Math.round(performance.now() - started) } : m) }));
    } finally {
      void recordTraceToBackend(userMsg.content, assistantMsg);
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }

  // 把这次调用记录到后端追踪表（走 Vite 代理 /admin → 后端，带 JWT）。失败静默，不阻塞对话。
  async function recordTraceToBackend(prompt: string, m: Msg) {
    try {
      const token = useAuthStore.getState().accessToken;
      await fetch('/admin/v1/ai/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          provider_kind: provider.kind,
          base_url: provider.baseURL,
          model: m.model || provider.model,
          prompt,
          response: m.content,
          reasoning: m.reasoning || '',
          prompt_tokens: m.usage?.prompt_tokens || 0,
          completion_tokens: m.usage?.completion_tokens || 0,
          total_tokens: m.usage?.total_tokens || 0,
          latency_ms: m.latencyMs || 0,
          status: m.error ? 'error' : 'ok',
          finish: m.finish || '',
          error: m.error || '',
          span_id: m.id,
        }),
      });
    } catch { /* 静默：后端未就绪时不影响对话 */ }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 12 }}>
      {/* 对话历史 */}
      <div style={{ width: 240, borderRight: '1px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={newChat} style={{ flex: 1 }}>新对话</Button>
          <Button icon={<SettingOutlined />} size="small" onClick={() => setShowSettings(true)} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
          {convs.length === 0 ? <Empty description="暂无对话" style={{ marginTop: 40 }} /> : convs.map((c) => (
            <div key={c.id} onClick={() => setActiveId(c.id)} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 6, marginBottom: 4, background: c.id === activeId ? 'var(--color-background-secondary)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.title || '新对话'}</span>
              <DeleteOutlined style={{ color: 'var(--color-text-tertiary)' }} onClick={(e) => { e.stopPropagation(); delChat(c.id); }} />
            </div>
          ))}
        </div>
      </div>

      {/* 对话区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 当前服务状态栏 */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Tag color={provider.kind === 'ollama' ? 'green' : 'blue'}>{provider.kind === 'ollama' ? 'Ollama 本地' : 'OpenAI 兼容'}</Tag>
          <Tag>{provider.model || '未设置模型'}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{provider.baseURL}</Text>
          <Button size="small" type="link" icon={<SettingOutlined />} onClick={() => setShowSettings(true)} style={{ marginLeft: 'auto' }}>服务设置</Button>
        </div>
        {provider.kind === 'openai' && !provider.apiKey && (
          <Alert type="warning" showIcon banner message="未配置 API Key，调用会返回 401。点右上「服务设置」填写 Key，或改用「Ollama 协议」本地模型。" />
        )}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {!active || active.msgs.length === 0 ? (
            <Empty description="开始一段新的 AI 对话" style={{ marginTop: 80 }} />
          ) : active.msgs.map((m) => (
            <div key={m.id} style={{ marginBottom: 16, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%' }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-background-secondary)', color: m.role === 'user' ? '#fff' : 'inherit', wordBreak: 'break-word', maxHeight: 420, overflowY: 'auto' }}>
                  {m.attachedName && (
                    <div style={{ marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: m.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--color-fill-tertiary)', borderRadius: 10, fontSize: 12 }}>
                      <PaperClipOutlined /> {m.attachedName}
                    </div>
                  )}
                  {m.role === 'assistant' && m.reasoning && (
                    <details style={{ marginBottom: 8, fontSize: 12, opacity: 0.75, borderTop: '1px solid var(--color-border-tertiary)', paddingTop: 6 }}>
                      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>思考过程（{m.reasoning.length} 字）</summary>
                      <div style={{ padding: '6px 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.reasoning}</div>
                    </details>
                  )}
                  {m.role === 'assistant'
                    ? (m.content
                        ? <Markdown content={m.content} />
                        : (streaming ? (m.reasoning ? '' : '思考中…') : ''))
                    : <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</span>}
                  {m.error && <Text type="danger" style={{ display: 'block', marginTop: 6 }}>错误：{m.error}</Text>}
                </div>
                {/* 可观测面板 */}
                {(m.role === 'assistant' && (m.latencyMs || m.usage || m.model)) && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.model && <Tag>{m.model}</Tag>}
                    {m.latencyMs != null && <Tag color="blue">{m.latencyMs} ms</Tag>}
                    {m.usage?.completion_tokens != null && <Tag color="green">out {m.usage.completion_tokens}</Tag>}
                    {m.usage?.prompt_tokens != null && <Tag color="orange">in {m.usage.prompt_tokens}</Tag>}
                    {m.finish && <Tag>finish: {m.finish}</Tag>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-tertiary)', padding: 12 }}>
          {attached && (
            <div style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--color-background-secondary)', borderRadius: 16, fontSize: 12 }}>
              <PaperClipOutlined />
              <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attached.name}</span>
              <Text type="secondary">{(attached.size/1024).toFixed(1)}KB</Text>
              <CloseOutlined style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={() => setAttached(null)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.log,.py,.go,.js,.ts,.tsx,.yaml,.yml,.xml,.html,.css,.sh,.bat,.ini,.cfg,.docx,.xlsx,.xls,text/*" style={{ display: 'none' }} onChange={onFilePick} />
            <Button icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} disabled={streaming || parsing} loading={parsing} title="上传文件解析为文本（.txt/.md/.csv/.json/代码/.docx/.xlsx），内容拼进对话让 AI 分析" />
            <TextArea value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }} placeholder={attached ? '可补充问题，或直接发送分析附件' : '输入消息，Enter 发送，Shift+Enter 换行；或点左侧📎上传 .docx/.xlsx/文本文件'} autoSize={{ minRows: 1, maxRows: 6 }} disabled={streaming} />
            {streaming ? <Button danger onClick={stop}>停止</Button> : <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={!input.trim() && !attached}>发送</Button>}
          </div>
        </div>
      </div>

      {/* 设置抽屉 */}
      <Drawer title="AI 服务设置" open={showSettings} onClose={() => setShowSettings(false)} width={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text strong>服务类型</Text>
            <Select value={provider.kind} onChange={(v) => setProvider((p) => ({ ...p, kind: v, ...(v === 'ollama' ? PRESET_OLLAMA : {}) }))} style={{ width: '100%', marginTop: 6 }}
              options={[{ value: 'openai', label: 'OpenAI 兼容（OpenAI / DeepSeek / 通义等）' }, { value: 'ollama', label: 'Ollama（本地，OpenAI 兼容端点）' }]} />
          </div>
          <div>
            <Text strong>Base URL</Text>
            <Input value={provider.baseURL} onChange={(e) => setProvider((p) => ({ ...p, baseURL: e.target.value }))} style={{ marginTop: 6 }} placeholder="https://api.openai.com/v1 或 http://localhost:11434/v1" />
          </div>
          <div>
            <Text strong>API Key</Text>
            <Input.Password value={provider.apiKey} onChange={(e) => setProvider((p) => ({ ...p, apiKey: e.target.value }))} style={{ marginTop: 6 }} placeholder="Ollama 可填任意值" />
          </div>
          <div>
            <Text strong>模型</Text>
            <Input value={provider.model} onChange={(e) => setProvider((p) => ({ ...p, model: e.target.value }))} style={{ marginTop: 6 }} placeholder="gpt-4o-mini / qwen2.5:7b / deepseek-chat" />
          </div>
          <div>
            <Text strong>Temperature: {provider.temperature}</Text>
            <input type="range" min={0} max={2} step={0.1} value={provider.temperature} onChange={(e) => setProvider((p) => ({ ...p, temperature: Number(e.target.value) }))} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div>
            <Text strong>System Prompt（可选）</Text>
            <TextArea value={provider.system} onChange={(e) => setProvider((p) => ({ ...p, system: e.target.value }))} style={{ marginTop: 6 }} rows={3} />
          </div>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            Ollama 的 OpenAI 兼容端点为 <Text code>http://localhost:11434/v1</Text>，Key 任意。对话历史与观测数据本地存储于浏览器 localStorage（Phase 2 将迁至后端持久化 + 链路追踪）。
          </Paragraph>
        </div>
      </Drawer>
    </div>
  );
}
