import type { AppRouteObject } from '@/core/router/types';
import { createLazyRoute } from '@/core/router';

/**
 * AI 能力路由（参考 goclaw 能力模型）
 * - AI 对话：OpenAI 兼容协议 + Ollama，流式输出、历史可查、可观测
 * - MCP / Skill / OpenAI 协议 / Ollama 协议：配置与治理（Phase 2 落地功能）
 */
export const aiRoutes: AppRouteObject[] = [
  {
    name: 'ai',
    path: 'ai',
    meta: {
      title: 'AI 能力',
      icon: 'lucide:sparkles',
      order: 100,
    },
    children: [
      {
        name: 'ai-chat',
        path: 'chat',
        element: createLazyRoute(() => import('@/pages/app/ai/chat')),
        meta: {
          title: 'AI 对话',
          icon: 'lucide:bot',
          order: 1,
        },
      },
      {
        name: 'ai-traces',
        path: 'traces',
        element: createLazyRoute(() => import('@/pages/app/ai/traces')),
        meta: {
          title: 'AI 调用追踪',
          icon: 'lucide:activity',
          order: 2,
        },
      },
      {
        name: 'ai-mcp',
        path: 'mcp',
        element: createLazyRoute(() => import('@/pages/app/ai/mcp')),
        meta: {
          title: 'MCP',
          icon: 'lucide:plug',
          order: 2,
        },
      },
      {
        name: 'ai-skill',
        path: 'skill',
        element: createLazyRoute(() => import('@/pages/app/ai/skill')),
        meta: {
          title: 'Skill',
          icon: 'lucide:blocks',
          order: 3,
        },
      },
      {
        name: 'ai-openai',
        path: 'openai',
        element: createLazyRoute(() => import('@/pages/app/ai/openai')),
        meta: {
          title: 'OpenAI 协议',
          icon: 'lucide:brain-circuit',
          order: 4,
        },
      },
      {
        name: 'ai-ollama',
        path: 'ollama',
        element: createLazyRoute(() => import('@/pages/app/ai/ollama')),
        meta: {
          title: 'Ollama 协议',
          icon: 'lucide:server',
          order: 5,
        },
      },
      {
        name: 'ai-kb',
        path: 'knowledge-base',
        element: createLazyRoute(() => import('@/pages/app/ai/knowledge-base')),
        meta: {
          title: '知识库',
          icon: 'lucide:library',
          order: 6,
        },
      },
    ],
  },
];

export default aiRoutes;
