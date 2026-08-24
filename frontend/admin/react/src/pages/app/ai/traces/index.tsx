import { useEffect, useMemo, useState } from 'react';
import { Card, Input, Table, Tag, Typography, Empty, Space, Select, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores';

const { Text, Paragraph } = Typography;

interface Usage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; }
interface Msg {
  id: string; role: 'system' | 'user' | 'assistant'; content: string;
  model?: string; latencyMs?: number; usage?: Usage; finish?: string; error?: string;
}
interface Conv { id: string; title: string; msgs: Msg[]; updatedAt: number; }
interface TraceRow {
  key: string; convId: string; convTitle: string; time: number;
  model: string; status: 'ok' | 'error'; latencyMs?: number;
  promptTokens?: number; completionTokens?: number; finish?: string;
  error?: string; prompt: string; response: string; source: '本地' | '后端';
}

interface BackendTrace {
  id: number; created_at: string; provider_kind: string; model: string; status: string;
  latency_ms: number; prompt_tokens: number; completion_tokens: number; total_tokens: number;
  finish: string; error: string; prompt_preview: string; response_preview: string;
}

const LS_CONV = 'gwa-ai-chat:conversations';

function loadConvs(): Conv[] {
  try { const v = JSON.parse(localStorage.getItem(LS_CONV) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function fmtTime(ts: number) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }); } catch { return String(ts); }
}

export default function AiTracesPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error'>('all');
  const [backendRows, setBackendRows] = useState<TraceRow[]>([]);

  const localRows: TraceRow[] = useMemo(() => {
    const convs = loadConvs();
    const out: TraceRow[] = [];
    for (const c of convs) {
      for (let i = 0; i < c.msgs.length; i++) {
        const m = c.msgs[i];
        if (m.role !== 'assistant') continue;
        const prev = c.msgs[i - 1];
        out.push({
          key: 'l-' + m.id, convId: c.id, convTitle: c.title || '新对话', time: c.updatedAt,
          model: m.model || '-', status: m.error ? 'error' : 'ok',
          latencyMs: m.latencyMs, promptTokens: m.usage?.prompt_tokens, completionTokens: m.usage?.completion_tokens,
          finish: m.finish, error: m.error, prompt: prev?.content || '', response: m.content, source: '本地',
        });
      }
    }
    return out.sort((a, b) => b.time - a.time);
  }, []);

  async function fetchBackend() {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch('/admin/v1/ai/traces?limit=100', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const data: BackendTrace[] = await res.json();
      setBackendRows(data.map((t) => ({
        key: 'b-' + t.id, convId: '', convTitle: '(后端)',
        time: new Date(t.created_at).getTime(),
        model: t.model || '-', status: (t.status === 'error' ? 'error' : 'ok') as 'ok' | 'error',
        latencyMs: t.latency_ms, promptTokens: t.prompt_tokens, completionTokens: t.completion_tokens,
        finish: t.finish, error: t.error, prompt: t.prompt_preview || '', response: t.response_preview || '',
        source: '后端',
      })).sort((a, b) => b.time - a.time));
    } catch { /* 后端未就绪时静默 */ }
  }
  useEffect(() => { void fetchBackend(); }, []);

  const rows: TraceRow[] = useMemo(() => [...backendRows, ...localRows].sort((a, b) => b.time - a.time), [backendRows, localRows]);

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!keyword.trim()) return true;
    const k = keyword.toLowerCase();
    return r.model.toLowerCase().includes(k) || r.convTitle.toLowerCase().includes(k) ||
      r.prompt.toLowerCase().includes(k) || r.response.toLowerCase().includes(k) ||
      (r.error || '').toLowerCase().includes(k);
  });

  const columns: ColumnsType<TraceRow> = [
    { title: '时间', dataIndex: 'time', width: 180, render: (t: number) => fmtTime(t) },
    { title: '来源', dataIndex: 'source', width: 70, render: (s: string) => <Tag color={s === '后端' ? 'geekblue' : 'default'}>{s}</Tag> },
    { title: '对话', dataIndex: 'convTitle', width: 130, ellipsis: true },
    { title: '模型', dataIndex: 'model', width: 150, render: (m: string) => <Tag>{m}</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => s === 'ok' ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
    { title: '耗时', dataIndex: 'latencyMs', width: 100, sorter: (a, b) => (a.latencyMs || 0) - (b.latencyMs || 0), render: (v?: number) => v != null ? `${v} ms` : '-' },
    { title: '入 token', dataIndex: 'promptTokens', width: 90, render: (v?: number) => v ?? '-' },
    { title: '出 token', dataIndex: 'completionTokens', width: 90, render: (v?: number) => v ?? '-' },
    { title: 'finish', dataIndex: 'finish', width: 100, render: (v?: string) => v ? <Tag>{v}</Tag> : '-' },
  ];

  const totalLatency = rows.reduce((s, r) => s + (r.latencyMs || 0), 0);
  const totalOut = rows.reduce((s, r) => s + (r.completionTokens || 0), 0);
  const errCount = rows.filter((r) => r.status === 'error').length;

  return (
    <Card>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search placeholder="按 模型/对话/内容/错误 搜索" allowClear style={{ width: 320 }} onChange={(e) => setKeyword(e.target.value)} />
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}
          options={[{ value: 'all', label: '全部状态' }, { value: 'ok', label: '成功' }, { value: 'error', label: '失败' }]} />
        <Button icon={<ReloadOutlined />} onClick={() => void fetchBackend()}>从后端刷新</Button>
        <Text type="secondary">共 {rows.length} 次 · 后端 {backendRows.length} · 本地 {localRows.length} · 成功 {rows.length - errCount} · 失败 {errCount} · 出 token {totalOut}</Text>
      </Space>

      {filtered.length === 0 ? (
        <Empty description="暂无 AI 调用记录，去「AI 对话」页发起一次对话后再来看" style={{ marginTop: 60 }} />
      ) : (
        <Table<TraceRow>
          columns={columns}
          dataSource={filtered}
          size="small"
          pagination={{ pageSize: 15 }}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ maxWidth: 900 }}>
                <Paragraph><Text strong>Prompt：</Text>{r.prompt || <Text type="secondary">（无）</Text>}</Paragraph>
                <Paragraph><Text strong>Response：</Text>{r.response || <Text type="secondary">（空）</Text>}</Paragraph>
                {r.error && <Paragraph type="danger"><Text strong>错误：</Text>{r.error}</Paragraph>}
              </div>
            ),
          }}
        />
      )}
      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        当前追踪数据来自浏览器本地存储（AI 对话页的每条回复自带 model/耗时/token/finish 观测字段）。Phase 2 将把 LLM 调用改走后端代理，落库 sys_ai_call_traces 并接入 OpenTelemetry span，实现跨租户、可溯源、持久化的全链路追踪。
      </Paragraph>
    </Card>
  );
}
