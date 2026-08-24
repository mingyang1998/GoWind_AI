import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Table, Modal, Input, Select, Tag, Space, Typography, Popconfirm, Empty, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

interface Skill {
  id: string; name: string; description: string; content: string;
  tags: string[]; version: string; enabled: boolean; updatedAt: number;
}

const LS_KEY = 'gwa-ai-skills';

function loadSkills(): Skill[] {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveSkills(s: Skill[]) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const EMPTY: Omit<Skill, 'id' | 'updatedAt'> = {
  name: '', description: '', content: '', tags: [], version: '0.1.0', enabled: true,
};

export default function AiSkillPage() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkills());
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Skill | null>(null);
  const [draft, setDraft] = useState<Omit<Skill, 'id' | 'updatedAt'> | null>(null);
  const [viewing, setViewing] = useState<Skill | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => saveSkills(skills), [skills]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return skills;
    return skills.filter((s) =>
      s.name.toLowerCase().includes(k) || s.description.toLowerCase().includes(k) ||
      s.tags.some((t) => t.toLowerCase().includes(k)) || s.content.toLowerCase().includes(k)
    );
  }, [skills, keyword]);

  function openAdd() {
    setDraft({ ...EMPTY });
    setTagInput('');
    setEditing(null);
  }
  function openEdit(s: Skill) {
    setEditing(s);
    setDraft({ name: s.name, description: s.description, content: s.content, tags: [...s.tags], version: s.version, enabled: s.enabled });
    setTagInput('');
  }
  function close() { setDraft(null); setEditing(null); setTagInput(''); }

  function submit() {
    if (!draft) return;
    if (!draft.name.trim()) { message.warning('请填写技能名称'); return; }
    if (editing) {
      setSkills((p) => p.map((s) => s.id === editing.id ? { ...s, ...draft, updatedAt: Date.now() } : s));
      message.success('已更新');
    } else {
      setSkills((p) => [{ ...draft, id: uid(), updatedAt: Date.now() }, ...p]);
      message.success('已添加');
    }
    close();
  }

  function remove(id: string) {
    setSkills((p) => p.filter((s) => s.id !== id));
    message.success('已删除');
  }
  function toggle(id: string, enabled: boolean) {
    setSkills((p) => p.map((s) => s.id === id ? { ...s, enabled, updatedAt: Date.now() } : s));
  }
  function addTag() {
    const t = tagInput.trim();
    if (!t || !draft) return;
    if (!draft.tags.includes(t)) setDraft({ ...draft, tags: [...draft.tags, t] });
    setTagInput('');
  }

  const columns: ColumnsType<Skill> = [
    { title: '名称', dataIndex: 'name', width: 180, render: (v: string, r: Skill) => <a onClick={() => setViewing(r)}>{v}</a> },
    { title: '标签', dataIndex: 'tags', width: 200, render: (t: string[]) => t?.map((x) => <Tag key={x}>{x}</Tag>) || <Text type="secondary">-</Text> },
    { title: '版本', dataIndex: 'version', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: '启用', dataIndex: 'enabled', width: 80, render: (v: boolean, r: Skill) => <Select size="small" value={v} onChange={(n) => toggle(r.id, n)} options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: (t: number) => new Date(t).toLocaleString('zh-CN', { hour12: false }) },
    { title: '操作', width: 120, render: (_: unknown, r: Skill) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)} />
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="删除该技能？" onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    ) },
  ];

  return (
    <Card>
      <Title level={4}>Skill 技能库 <Tag color="success">可用</Tag></Title>
      <Paragraph type="secondary">管理可复用技能（SKILL.md + 元数据）。技能可被 AI 智能体检索与加载。当前存浏览器本地；Phase 2 将迁后端 + pgvector 向量检索。</Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="按 名称/描述/标签/内容 搜索" allowClear style={{ width: 320 }} onChange={(e) => setKeyword(e.target.value)} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加技能</Button>
        <Text type="secondary">共 {skills.length} 条 · 启用 {skills.filter((s) => s.enabled).length}</Text>
      </Space>

      {filtered.length === 0 ? (
        <Empty description={skills.length === 0 ? '暂无技能，点「添加技能」创建第一个' : '无匹配结果'} style={{ marginTop: 60 }} />
      ) : (
        <Table<Skill> columns={columns} dataSource={filtered} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      )}

      {/* 新增/编辑 */}
      <Modal title={editing ? '编辑技能' : '添加技能'} open={!!draft} onOk={submit} onCancel={close} width={720} okText="保存" cancelText="取消">
        {draft && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>名称 *</Text>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginTop: 4 }} placeholder="如：weather-query" />
            </div>
            <div>
              <Text strong>描述</Text>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ marginTop: 4 }} placeholder="一句话说明技能用途" />
            </div>
            <Space>
              <div>
                <Text strong>版本</Text>
                <Input value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} style={{ marginTop: 4, width: 140 }} placeholder="0.1.0" />
              </div>
              <div>
                <Text strong>标签</Text>
                <div style={{ marginTop: 4 }}>
                  <Space.Compact>
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onPressEnter={addTag} style={{ width: 160 }} placeholder="回车添加" />
                    <Button onClick={addTag}>添加</Button>
                  </Space.Compact>
                </div>
              </div>
            </Space>
            {draft.tags.length > 0 && <div>{draft.tags.map((t) => <Tag key={t} closable onClose={() => setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })}>{t}</Tag>)}</div>}
            <div>
              <Text strong>SKILL.md 内容</Text>
              <TextArea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} style={{ marginTop: 4, fontFamily: 'monospace' }} rows={10} placeholder="# Skill: weather-query&#10;使用 open-meteo 查询天气..." />
            </div>
          </Space>
        )}
      </Modal>

      {/* 查看 */}
      <Modal title={viewing?.name} open={!!viewing} onCancel={() => setViewing(null)} footer={null} width={760}>
        {viewing && (
          <div>
            {viewing.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            <Tag>{viewing.version}</Tag>
            <Tag color={viewing.enabled ? 'green' : 'default'}>{viewing.enabled ? '启用' : '停用'}</Tag>
            <Paragraph style={{ marginTop: 12 }}>{viewing.description || <Text type="secondary">（无描述）</Text>}</Paragraph>
            <Paragraph><Text strong>SKILL.md：</Text></Paragraph>
            <pre style={{ background: 'var(--color-background-secondary)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'auto', fontFamily: 'monospace' }}>{viewing.content || '（空）'}</pre>
          </div>
        )}
      </Modal>
    </Card>
  );
}
