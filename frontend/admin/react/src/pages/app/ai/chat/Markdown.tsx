// Markdown 渲染组件：把 AI 回复的 Markdown（标题/加粗/表格/代码/列表）渲染成 HTML。
// 用已装的 marked（支持 GFM 表格）。样式自注入，适配明暗主题 CSS 变量。
import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

const MD_STYLE = `
.ai-md { font-size: 14px; line-height: 1.6; word-break: break-word; }
.ai-md > :first-child { margin-top: 0; }
.ai-md > :last-child { margin-bottom: 0; }
.ai-md h1, .ai-md h2, .ai-md h3, .ai-md h4, .ai-md h5, .ai-md h6 { margin: 0.7em 0 0.35em; line-height: 1.3; font-weight: 600; }
.ai-md h1 { font-size: 1.4em; } .ai-md h2 { font-size: 1.25em; } .ai-md h3 { font-size: 1.12em; } .ai-md h4 { font-size: 1em; }
.ai-md p { margin: 0.45em 0; }
.ai-md ul, .ai-md ol { margin: 0.45em 0; padding-left: 1.5em; }
.ai-md li { margin: 0.2em 0; }
.ai-md li > ul, .ai-md li > ol { margin: 0.2em 0; }
.ai-md code { background: var(--color-fill-tertiary, rgba(0,0,0,0.06)); padding: 0.12em 0.38em; border-radius: 3px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.88em; }
.ai-md pre { background: var(--color-fill-quaternary, rgba(0,0,0,0.04)); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 0.5em 0; }
.ai-md pre code { background: none; padding: 0; font-size: 0.85em; }
.ai-md table { border-collapse: collapse; margin: 0.6em 0; font-size: 0.9em; display: block; overflow-x: auto; max-width: 100%; }
.ai-md th, .ai-md td { border: 1px solid var(--color-border-tertiary, #d0d0d0); padding: 4px 9px; text-align: left; }
.ai-md th { background: var(--color-fill-secondary, rgba(0,0,0,0.03)); font-weight: 600; }
.ai-md tr:nth-child(even) td { background: var(--color-fill-quaternary, rgba(0,0,0,0.02)); }
.ai-md blockquote { border-left: 3px solid var(--color-border, #bbb); margin: 0.5em 0; padding: 0.2em 0 0.2em 1em; color: var(--color-text-secondary); }
.ai-md a { color: var(--color-primary, #1677ff); text-decoration: none; }
.ai-md a:hover { text-decoration: underline; }
.ai-md hr { border: none; border-top: 1px solid var(--color-border-tertiary, #ddd); margin: 0.8em 0; }
.ai-md img { max-width: 100%; }
`;

let injected = false;
function ensureStyle() {
  if (injected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.setAttribute('data-ai-md', '');
  s.textContent = MD_STYLE;
  document.head.appendChild(s);
  injected = true;
}

export function Markdown({ content }: { content: string }) {
  ensureStyle();
  const html = useMemo(() => {
    try { return marked.parse(content || '') as string; }
    catch { return content; }
  }, [content]);
  return <div className="ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
