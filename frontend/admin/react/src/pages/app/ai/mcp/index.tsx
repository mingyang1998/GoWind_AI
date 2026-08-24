import { useEffect, useState } from 'react';
import { Card, Button, Table, Modal, Input, Select, Tag, Space, Typography, Popconfirm, Empty, message, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text, Paragraph, Title } = Typography;

interface McpServer {
  id: string; name: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  command: string; // stdio: 启动命令
  url: string;     // sse / streamable-http: 端点
  enabled: boolean; updatedAt: number;
}

const LS_KEY = 'gwa-ai-mcp-servers';

function loadServers(): McpServer[] {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveServers(s: McpServer[]) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const EMPTY: Omit<McpServer, 'id' | 'updatedAt'> = {
  name: '', transport: 'stdio', command: '', url: '', enabled: true,
};

const PRESETS = [
  { name: 'filesystem', transport: 'stdio' as const, command: 'npx -y @modelcontextprotocol/server-filesystem /tmp' },
  { name: 'fetch', transport: 'stdio' as const, command: 'npx -y @modelcontextprotocol/server-fetch' },
  { name: 'git', transport: 'stdio' as const, command: 'npx -y @modelcontextprotocol/server-git' },
];

export default function AiMcpPage() {
  const [servers, setServers] = useState<McpServer[]>(() => loadServers());
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [draft, setDraft] = useState<Omit<McpServer, 'id' | 'updatedAt'> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => saveServers(servers), [servers]);

  function openAdd() { setDraft({ ...EMPTY }); setEditing(null); }
  function openEdit(s: McpServer) {
    setEditing(s);
    setDraft({ name: s.name, transport: s.transport, command: s.command, url: s.url, enabled: s.enabled });
  }
  function close() { setDraft(null); setEditing(null); }
  function submit() {
    if (!draft) return;
    if (!draft.name.trim()) { message.warning('请填写名称'); return; }
    if (draft.transport === 'stdio' && !draft.command.trim()) { message.warning('stdio 类型需填写启动命令'); return; }
    if (draft.transport !== 'stdio' && !draft.url.trim()) { message.warning('SSE/HTTP 类型需填写端点 URL'); return; }
    if (editing) {
      setServers((p) => p.map((s) => s.id === editing.id ? { ...s, ...draft, updatedAt: Date.now() } : s));
      message.success('已更新');
    } else {
      setServers((p) => [{ ...draft, id: uid(), updatedAt: Date.now() }, ...p]);
      message.success('已添加');
    }
    close();
  }
  function remove(id: string) { setServers((p) => p.filter((s) => s.id !== id)); message.success('已删除'); }
  function applyPreset(p: typeof PRESETS[0]) { setDraft({ name: p.name, transport: p.transport, command: p.command, url: '', enabled: true }); }

  async function testConn(s: McpServer) {
    if (s.transport === 'stdio') { message.warning('stdio 类型需后端代理启动本地进程，浏览器无法直连测试'); return; }
    setTesting(s.id);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(s.url, { signal: ctrl.signal });
      clearTimeout(t);
      message.success(`连接成功（HTTP ${res.status}）`);
    } catch (e) {
      message.error(`连接失败：${(e as Error).message}（可能是 CORS 限制，实际调用需后端代理）`);
    } finally { setTesting(null); }
  }

  const columns: ColumnsType<McpServer> = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '传输', dataIndex: 'transport', width: 140, render: (v: string) => {
      const color = v === 'stdio' ? 'blue' : v === 'sse' ? 'green' : 'purple';
      return <Tag color={color}>{v}</Tag>;
    } },
    { title: '命令 / 端点', render: (_: unknown, r: McpServer) => (
      <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>{r.transport === 'stdio' ? r.command : r.url}</Text>
    ) },
    { title: '启用', dataIndex: 'enabled', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: (t: number) => new Date(t).toLocaleString('zh-CN', { hour12: false }) },
    { title: '操作', width: 180, render: (_: unknown, r: McpServer) => (
      <Space>
        <Button size="small" icon={<ThunderboltOutlined />} loading={testing === r.id} onClick={() => testConn(r)}>测试</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="删除该 server？" onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    ) },
  ];

  return (
    <Card>
      <Title level={4}>MCP Server 注册表 <Tag color="success">可用</Tag></Title>
      <Paragraph type="secondary">管理外部 MCP Server 配置（stdio / SSE / streamable-http 三种传输）。当前为注册与连通性测试；实际工具调用需后端代理（Phase 2）。</Paragraph>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="stdio 类型需后端启动本地进程，浏览器只能登记配置、无法直接调用；SSE/HTTP 类型可测连通性，但跨域调用仍需后端中转。Phase 2 将在后端实现 MCP 客户端 + 工具发现 + 审计。"
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加 Server</Button>
        <Text type="secondary">快速预设：</Text>
        {PRESETS.map((p) => <Button key={p.name} size="small" onClick={() => { openAdd(); applyPreset(p); }}>{p.name}</Button>)}
        <Text type="secondary">共 {servers.length} 个 · 启用 {servers.filter((s) => s.enabled).length}</Text>
      </Space>

      {servers.length === 0 ? (
        <Empty description="暂无 MCP Server，点「添加 Server」或选一个预设" style={{ marginTop: 60 }} />
      ) : (
        <Table<McpServer> columns={columns} dataSource={servers} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      )}

      <Modal title={editing ? '编辑 MCP Server' : '添加 MCP Server'} open={!!draft} onOk={submit} onCancel={close} width={640} okText="保存" cancelText="取消">
        {draft && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>名称 *</Text>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginTop: 4 }} placeholder="如：filesystem" />
            </div>
            <div>
              <Text strong>传输类型</Text>
              <Select value={draft.transport} onChange={(v) => setDraft({ ...draft, transport: v })} style={{ width: '100%', marginTop: 4 }}
                options={[
                  { value: 'stdio', label: 'stdio（本地子进程，如 npx ...）' },
                  { value: 'sse', label: 'SSE（http(s)://.../sse）' },
                  { value: 'streamable-http', label: 'streamable-http（http(s)://.../mcp）' },
                ]} />
            </div>
            {draft.transport === 'stdio' ? (
              <div>
                <Text strong>启动命令</Text>
                <Input value={draft.command} onChange={(e) => setDraft({ ...draft, command: e.target.value })} style={{ marginTop: 4, fontFamily: 'monospace' }} placeholder="npx -y @modelcontextprotocol/server-filesystem /tmp" />
              </div>
            ) : (
              <div>
                <Text strong>端点 URL</Text>
                <Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} style={{ marginTop: 4 }} placeholder="http://localhost:3001/sse" />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </Card>
  );
}
