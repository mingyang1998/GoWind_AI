<script lang="ts" setup>
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { List } from 'ant-design-vue';

const ListItem = List.Item;
const ListItemMeta = List.Item.Meta;

interface AccountBindItem {
  key: string; // 唯一标识（建议用平台标识符）
  title: string;
  description: string; // 动态生成建议：根据 status + boundTime + isPrimary
  extra: string; // 按钮文案（绑定/解绑/管理）
  avatar: string; // Iconify 格式图标
  color: string; // 图标颜色，统一使用主题感知前景色，避免硬编码品牌色在暗黑下不可见
  status: 'bound' | 'pending' | 'unbound'; // 核心状态
  boundTime?: string; // ISO 8601 格式，如 '2024-01-15T08:30:00Z'
  isPrimary?: boolean; // 是否主账号（仅 status='bound' 时有效）
  disabled?: boolean; // 按钮是否禁用（如主账号不可解绑）
  platform?: string; // 平台英文标识（便于后端识别）
  required?: boolean; // 是否必填项（如手机号/邮箱）
}

// 图标颜色统一使用主题感知前景色（亮/暗模式自动切换），不再使用各平台硬编码品牌色。
// 平台识别由 title 文字提供，图标同色不影响信息传达。
const ICON_COLOR = 'hsl(var(--foreground))';

const accountBindList: AccountBindItem[] = [
  // ========== 核心绑定项（必填）==========
  {
    key: 'email',
    title: '邮箱账号',
    description: '已绑定 · 用于接收通知和找回密码',
    extra: '修改',
    avatar: 'ri:mail-fill',
    color: ICON_COLOR,
    status: 'bound',
    boundTime: '2023-09-01T10:00:00Z',
    isPrimary: true,
    required: true,
    platform: 'email',
  },
  {
    key: 'phone',
    title: '手机号',
    description: '已绑定 · 138****5678（用于安全验证）',
    extra: '修改',
    avatar: 'ri:smartphone-fill',
    color: ICON_COLOR,
    status: 'bound',
    boundTime: '2023-09-01T10:05:00Z',
    isPrimary: true,
    required: true,
    platform: 'phone',
  },

  // ========== 第三方账号绑定 ==========
  {
    key: 'github',
    title: 'GitHub 账号',
    description: '已绑定（主账号）· 绑定时间：2023-10-15',
    extra: '管理',
    avatar: 'fa-brands:github',
    color: ICON_COLOR,
    status: 'bound',
    boundTime: '2023-10-15T09:20:00Z',
    isPrimary: true,
    disabled: true,
    platform: 'github',
  },
  {
    key: 'wechat',
    title: '微信账号',
    description: '已绑定 · 绑定时间：2024-01-20',
    extra: '解绑',
    avatar: 'ri:wechat-fill',
    color: ICON_COLOR,
    status: 'bound',
    boundTime: '2024-01-20T14:35:00Z',
    isPrimary: false,
    platform: 'wechat',
  },
  {
    key: 'weibo',
    title: '新浪微博',
    description: '未绑定账号，绑定后可快速登录',
    extra: '立即绑定',
    avatar: 'ri:weibo-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'weibo',
  },
  {
    key: 'dingtalk',
    title: '钉钉',
    description: '未绑定账号，企业协作更便捷',
    extra: '绑定',
    avatar: 'ri:dingding-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'dingtalk',
  },

  // ========== 其他平台 ==========
  {
    key: 'qq',
    title: 'QQ 账号',
    description: '未绑定账号，支持 QQ 快速登录',
    extra: '绑定',
    avatar: 'ri:qq-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'qq',
  },
  {
    key: 'alipay',
    title: '支付宝',
    description: '未绑定账号，支付验证更安全',
    extra: '绑定',
    avatar: 'ri:alipay-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'alipay',
  },
  {
    key: 'google',
    title: 'Google 账号',
    description: '未绑定账号，国际服务支持',
    extra: '绑定',
    avatar: 'ri:google-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'google',
  },
  {
    key: 'apple',
    title: 'Apple ID',
    description: '未绑定账号，iOS/macOS 设备同步',
    extra: '绑定',
    avatar: 'ri:apple-fill',
    color: ICON_COLOR,
    status: 'unbound',
    platform: 'apple',
  },

  // ========== 特殊状态示例 ==========
  {
    key: 'twitter',
    title: 'Twitter',
    description: '绑定申请审核中...',
    extra: '审核中',
    avatar: 'ri:twitter-fill',
    color: ICON_COLOR,
    status: 'pending',
    disabled: true,
    platform: 'twitter',
  },
];
</script>

<template>
  <Page :title="$t('page.user.profile.tab.accountBind')">
    <List>
      <template v-for="item in accountBindList" :key="item.key">
        <ListItem>
          <ListItemMeta>
            <template #avatar>
              <IconifyIcon
                v-if="item.avatar"
                class="avatar"
                :icon="item.avatar"
                :color="item.color"
              />
            </template>
            <template #title>
              {{ item.title }}
              <a-button
                type="link"
                size="small"
                v-if="item.extra"
                class="extra"
              >
                {{ item.extra }}
              </a-button>
            </template>
            <template #description>
              <div>{{ item.description }}</div>
            </template>
          </ListItemMeta>
        </ListItem>
      </template>
    </List>
  </Page>
</template>

<style lang="less" scoped>
.avatar {
  font-size: 40px !important;
}

.extra {
  float: right;
  margin-top: 10px;
  margin-right: 30px;
  cursor: pointer;
}
</style>
