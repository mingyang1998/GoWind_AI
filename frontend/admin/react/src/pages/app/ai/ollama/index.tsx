import { Card, Tag, Typography, Input, Button, Space, message, Alert } from 'antd';
import { useEffect, useState } from 'react';

const { Title, Paragraph, Text } = Typography;

const LS_PROV = 'gwa-ai-chat:provider:v4';

export default function AiOllamaPage() {
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('11434');
  const [model, setModel] = useState('gemma3:1b');

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS_PROV) || '{}');
      if (v.kind === 'ollama' && v.baseURL) {
        const m = v.baseURL.match(/^https?:\/\/([^:/]+)(?::(\d+))?\/v1/);
        if (m) { setHost(m[1]); if (m[2]) setPort(m[2]); }
      }
      if (v.model) setModel(v.model);
    } catch { /* ignore */ }
  }, []);

  function save() {
    const baseURL = `http://${host}:${port}/v1`;
    try {
      const cur = JSON.parse(localStorage.getItem(LS_PROV) || '{}');
      localStorage.setItem(LS_PROV, JSON.stringify({ ...cur, kind: 'ollama', baseURL, apiKey: 'ollama', model, temperature: cur.temperature ?? 0.7, system: cur.system ?? '' }));
      message.success('已保存。请确保本机已运行 ollama serve');
    } catch { message.error('保存失败'); }
  }

  return (
    <Card>
      <Title level={4}>
        Ollama 协议（本地） <Tag color="success">可用</Tag>
      </Title>
      <Paragraph type="secondary">
        Ollama 提供 OpenAI 兼容端点 <Text code>{'{host}:{port}/v1'}</Text>，Key 任意。保存后可直接在「AI 对话」页使用，无需联网。
      </Paragraph>
      <Alert
        type="info"
        showIcon
        message="启动本地 Ollama"
        description={<span>命令行运行 <Text code>ollama serve</Text> 并拉模型 <Text code>ollama pull {model}</Text>。若从 WSL2 访问宿主机 Ollama，host 填 <Text code>host.docker.internal</Text> 或本机局域网 IP。</span>}
        style={{ marginBottom: 16 }}
      />
      <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: 520 }}>
        <Space>
          <div>
            <Text strong>Host</Text>
            <Input value={host} onChange={(e) => setHost(e.target.value)} style={{ marginTop: 6, width: 260 }} />
          </div>
          <div>
            <Text strong>Port</Text>
            <Input value={port} onChange={(e) => setPort(e.target.value)} style={{ marginTop: 6, width: 120 }} />
          </div>
        </Space>
        <div>
          <Text strong>模型</Text>
          <Input value={model} onChange={(e) => setModel(e.target.value)} style={{ marginTop: 6 }} placeholder="gemma3:1b（推荐，小）/ qwen3.5:latest（需≥7GB内存）" />
        </div>
        <Button type="primary" onClick={save}>保存并设为当前服务</Button>
      </Space>
    </Card>
  );
}
