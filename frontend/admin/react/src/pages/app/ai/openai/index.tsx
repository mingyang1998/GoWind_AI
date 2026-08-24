import { Card, Tag, Typography, Input, Button, Space, message } from 'antd';
import { useEffect, useState } from 'react';

const { Title, Paragraph, Text } = Typography;

const LS_PROV = 'gwa-ai-chat:provider:v4';

export default function AiOpenAiPage() {
  const [cfg, setCfg] = useState({ baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: 'sk-770a9633accb4adea2880523e53d89ba', model: 'qwen3.7-max-2026-05-17' });

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS_PROV) || '{}');
      if (v.baseURL || v.model) setCfg({ baseURL: v.baseURL || cfg.baseURL, apiKey: v.apiKey || '', model: v.model || cfg.model });
    } catch { /* ignore */ }
  }, []);

  function save() {
    try {
      const cur = JSON.parse(localStorage.getItem(LS_PROV) || '{}');
      localStorage.setItem(LS_PROV, JSON.stringify({ ...cur, kind: 'openai', ...cfg, temperature: cur.temperature ?? 0.7, system: cur.system ?? '' }));
      message.success('已保存为 AI 对话的当前服务（OpenAI 兼容）');
    } catch { message.error('保存失败'); }
  }

  return (
    <Card>
      <Title level={4}>
        OpenAI 兼容协议 <Tag color="success">可用</Tag>
      </Title>
      <Paragraph type="secondary">
        配置任意 OpenAI 兼容端点（OpenAI / DeepSeek / 通义百炼 / OpenRouter / Groq / 智谱等）。保存后可直接在「AI 对话」页使用。
      </Paragraph>
      <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: 520 }}>
        <div>
          <Text strong>Base URL</Text>
          <Input value={cfg.baseURL} onChange={(e) => setCfg({ ...cfg, baseURL: e.target.value })} style={{ marginTop: 6 }} />
        </div>
        <div>
          <Text strong>API Key</Text>
          <Input.Password value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} style={{ marginTop: 6 }} />
        </div>
        <div>
          <Text strong>模型</Text>
          <Input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} style={{ marginTop: 6 }} />
        </div>
        <Button type="primary" onClick={save}>保存并设为当前服务</Button>
      </Space>
      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        常见预设：DeepSeek <Text code>https://api.deepseek.com/v1</Text>（deepseek-chat）、通义 <Text code>https://dashscope.aliyuncs.com/compatible-mode/v1</Text>、OpenRouter <Text code>https://openrouter.ai/api/v1</Text>。
      </Paragraph>
    </Card>
  );
}
