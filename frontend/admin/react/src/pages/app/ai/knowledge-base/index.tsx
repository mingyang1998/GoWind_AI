import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Table, Modal, Input, Select, Tag, Switch, Space, Typography, Popconfirm, Empty, message, Alert, Upload, UploadProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PaperClipOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { extractText } from '../chat/fileExtract';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

interface KbEntry {
  id: string; name: string; category: string; content: string;
  tags: string[]; enabled: boolean; updatedAt: number;
}
interface Match {
  entry: KbEntry; matchedTags: string[]; nameHit: boolean; score: number;
}

const LS_KB = 'gwa-ai-kb';
const LS_ENABLED = 'gwa-ai-kb:enabled';

const CATEGORIES = ['漏洞', '合规', '资产', '基线', '事件', '其他'];

// 网安方向默认种子（与交换机/防火墙分析任务对齐，首次进入自动播种，用户可改可删）
const DEFAULT_SEED: Omit<KbEntry, 'id' | 'updatedAt'>[] = [
  { name: 'IP-MAC 绑定基线', category: '基线', tags: ['ip source binding', 'source binding', 'ip-mac', 'ip source', 'dhcp snooping', '绑定'], content: '接入交换机应配置 ip source binding 或 dhcp snooping binding 实现 IP-MAC 绑定。running-config 中无相关配置即视为未做绑定。', enabled: true },
  { name: '高危端口封堵基线', category: '基线', tags: ['445', '3389', '135', '139', '137', '138', 'telnet', 'ftp'], content: '接入层 ACL 应封堵 135/137/138/139/445/3389 等高危端口（SMB/RDP/NetBIOS/Telnet/FTP）。', enabled: true },
  { name: '存活 IP 资产台账', category: '资产', tags: ['存活', '存活_ip', '存活地址', 'scan', '存活探测'], content: '漏扫/存活探测得到的在网 IP 清单，作为资产对比基准。', enabled: true },
  { name: '防火墙扫描覆盖', category: '合规', tags: ['10.216.246.250', '扫描源', '存活地址', '覆盖', '扫描范围'], content: '防火墙需确保扫描源(如 10.216.246.250)能扫描到全部存活地址。', enabled: true },
];

function loadKb(): KbEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KB) || 'null');
    if (Array.isArray(v)) return v;
    if (v === null) {
      // 首次进入：播种默认种子
      const seed: KbEntry[] = DEFAULT_SEED.map((s) => ({ ...s, id: uid(), updatedAt: Date.now() }));
      localStorage.setItem(LS_KB, JSON.stringify(seed));
      return seed;
    }
    return [];
  } catch { return []; }
}
function saveKb(k: KbEntry[]) { localStorage.setItem(LS_KB, JSON.stringify(k)); }
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

const EMPTY: Omit<KbEntry, 'id' | 'updatedAt'> = { name: '', category: '基线', content: '', tags: [], enabled: true };

// 常规搜索（非向量）：标签命中 + 名称命中，按命中数排序
function searchKb(text: string, entries: KbEntry[]): Match[] {
  const lower = text.toLowerCase();
  return entries
    .filter((e) => e.enabled)
    .map((e) => {
      const matchedTags = (e.tags || []).filter((t) => t && lower.includes(t.toLowerCase()));
      const nameTokens = e.name.split(/[\s/（）()]+/).filter((t) => t.length > 1);
      const nameHit = nameTokens.some((t) => lower.includes(t.toLowerCase()));
      return { entry: e, matchedTags, nameHit, score: matchedTags.length + (nameHit ? 1 : 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export default function AiKnowledgeBasePage() {
  const [entries, setEntries] = useState<KbEntry[]>(() => loadKb());
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(LS_ENABLED) !== 'off');
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [draft, setDraft] = useState<Omit<KbEntry, 'id' | 'updatedAt'> | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => saveKb(entries), [entries]);
  useEffect(() => { localStorage.setItem(LS_ENABLED, enabled ? 'on' : 'off'); }, [enabled]);

  function openAdd() { setDraft({ ...EMPTY }); setEditing(null); setTagInput(''); }
  function openEdit(e: KbEntry) { setEditing(e); setDraft({ name: e.name, category: e.category, content: e.content, tags: [...e.tags], enabled: e.enabled }); setTagInput(''); }
  function close() { setDraft(null); setEditing(null); setTagInput(''); }
  function submit() {
    if (!draft) return;
    if (!draft.name.trim()) { message.warning('请填写名称'); return; }
    if (editing) { setEntries((p) => p.map((e) => e.id === editing.id ? { ...e, ...draft, updatedAt: Date.now() } : e)); message.success('已更新'); }
    else { setEntries((p) => [{ ...draft, id: uid(), updatedAt: Date.now() }, ...p]); message.success('已添加'); }
    close();
  }
  function remove(id: string) { setEntries((p) => p.filter((e) => e.id !== id)); message.success('已删除'); }
  function toggleEntry(id: string, en: boolean) { setEntries((p) => p.map((e) => e.id === id ? { ...e, enabled: en, updatedAt: Date.now() } : e)); }
  function addTag() { const t = tagInput.trim(); if (!t || !draft) return; if (!draft.tags.includes(t)) setDraft({ ...draft, tags: [...draft.tags, t] }); setTagInput(''); }

  // 上传文件 → 解析 → 常规搜索对比
  const onFile: UploadProps['beforeUpload'] = async (file) => {
    if (!enabled) { message.warning('知识库对比已关闭，请先开启右上开关'); return false; }
    setAnalyzing(true); setMatches(null);
    try {
      const { name, content } = await extractText(file as unknown as File);
      setFileName(`${name}（${(content.length / 1024).toFixed(1)}KB 文本）`);
      const result = searchKb(content, entries);
      setMatches(result);
      message.success(`解析完成，对比命中 ${result.length} 条知识条目`);
    } catch (err) { message.error((err as Error).message); }
    finally { setAnalyzing(false); }
    return false; // 阻止 antd 自动上传
  };

  const columns: ColumnsType<KbEntry> = [
    { title: '名称', dataIndex: 'name', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '分类', dataIndex: 'category', width: 80, render: (c: string) => <Tag color="blue">{c}</Tag> },
    { title: '标签(对比命中关键词)', dataIndex: 'tags', render: (t: string[]) => t?.map((x) => <Tag key={x}>{x}</Tag>) || <Text type="secondary">-</Text> },
    { title: '启用', dataIndex: 'enabled', width: 80, render: (v: boolean, r: KbEntry) => <Switch size="small" checked={v} onChange={(n) => toggleEntry(r.id, n)} /> },
    { title: '更新', dataIndex: 'updatedAt', width: 150, render: (t: number) => new Date(t).toLocaleString('zh-CN', { hour12: false }) },
    { title: '操作', width: 110, render: (_: unknown, r: KbEntry) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="删除该条目？" onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    ) },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }} size="middle">
        <Title level={4} style={{ margin: 0 }}>知识库（网络安全方向）</Title>
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已启用' : '已关闭'}</Tag>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>知识库对比总开关：</span>
        <Switch checked={enabled} onChange={setEnabled} checkedChildren="开" unCheckedChildren="关" />
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增条目</Button>
      </Space>
      <Paragraph type="secondary">管理网安知识条目（基线/漏洞/资产/合规等）。上传配置文件或资产文件，按标签/关键词做<b>常规搜索对比</b>（非向量），列出命中的知识条目。开关关闭时不做对比。</Paragraph>

      {!enabled && <Alert type="warning" showIcon banner message="知识库对比已关闭——上传文件不会触发对比分析。" style={{ marginBottom: 12 }} />}

      <Table<KbEntry> columns={columns} dataSource={entries} rowKey="id" size="small" pagination={{ pageSize: 8 }} />

      {/* 对比分析区 */}
      <div style={{ marginTop: 24, padding: 16, border: '1px dashed var(--color-border-tertiary)', borderRadius: 8 }}>
        <Title level={5} style={{ marginTop: 0 }}>对比分析：上传文件 → 与知识库常规搜索对比</Title>
        <Space style={{ marginBottom: 12 }}>
          <Upload beforeUpload={onFile} accept=".txt,.md,.csv,.json,.log,.cfg,.ini,.docx,.xlsx,text/*" showUploadList={false} disabled={!enabled || analyzing}>
            <Button icon={<PaperClipOutlined />} loading={analyzing} disabled={!enabled}>选择配置/资产文件</Button>
          </Upload>
          {fileName && <Text type="secondary">已解析：{fileName}</Text>}
          <Button icon={<SearchOutlined />} onClick={() => { if (fileName) message.info('请重新上传文件以刷新对比'); }} disabled={!matches}>刷新对比</Button>
        </Space>
        {!matches ? (
          <Empty description={enabled ? '上传文件后将显示命中的知识条目' : '对比已关闭'} style={{ marginTop: 24 }} />
        ) : matches.length === 0 ? (
          <Alert type="info" showIcon message="未命中任何知识库条目（文件中未出现知识库标签/关键词）" />
        ) : (
          <>
            <Paragraph><Text strong>命中 {matches.length} 条知识条目（按命中数排序）：</Text></Paragraph>
            {matches.map((m, i) => (
              <div key={m.entry.id} style={{ marginBottom: 12, padding: 10, background: 'var(--color-background-secondary)', borderRadius: 6 }}>
                <Space wrap>
                  <Tag color="geekblue">#{i + 1}</Tag>
                  <Text strong>{m.entry.name}</Text>
                  <Tag color="blue">{m.entry.category}</Tag>
                  <Tag color="green">命中 {m.score}</Tag>
                  {m.nameHit && <Tag>名称命中</Tag>}
                  {m.matchedTags.map((t) => <Tag color="orange" key={t}>📎 {t}</Tag>)}
                </Space>
                <Paragraph style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>{m.entry.content}</Paragraph>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 新增/编辑 */}
      <Modal title={editing ? '编辑知识条目' : '新增知识条目'} open={!!draft} onOk={submit} onCancel={close} width={680} okText="保存" cancelText="取消">
        {draft && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>名称 *</Text>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginTop: 4 }} placeholder="如：IP-MAC 绑定基线" />
            </div>
            <div>
              <Text strong>分类</Text>
              <Select value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} style={{ width: '100%', marginTop: 4 }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </div>
            <div>
              <Text strong>对比命中关键词/标签</Text>
              <div style={{ marginTop: 4 }}>
                <Space.Compact>
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onPressEnter={addTag} style={{ width: 260 }} placeholder="回车添加（对比时按这些词在文件中搜索）" />
                  <Button onClick={addTag}>添加</Button>
                </Space.Compact>
              </div>
            </div>
            {draft.tags.length > 0 && <div>{draft.tags.map((t) => <Tag key={t} closable onClose={() => setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })}>{t}</Tag>)}</div>}
            <div>
              <Text strong>知识内容</Text>
              <TextArea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} style={{ marginTop: 4 }} rows={4} placeholder="该条目的网安知识描述/检查要点" />
            </div>
          </Space>
        )}
      </Modal>
    </Card>
  );
}
