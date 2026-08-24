import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  total: string;
  totalValue: number;
  icon: ReactNode;
}

/**
 * 统计卡片组件
 */
export const StatsCard = ({ title, value, total, totalValue, icon }: StatsCardProps) => {
  return (
    <div className="h-full rounded-xl border border-white/5 bg-[color:var(--ant-color-bg-container)] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[color:var(--ant-color-text-secondary)] mb-2">
            {title}
          </div>
          <div className="text-2xl font-semibold text-[color:var(--ant-color-text)] mb-4">
            {value.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--ant-color-text-tertiary)]">{total}</span>
            <span className="text-[color:var(--ant-color-text-secondary)] font-medium">
              {totalValue.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center w-11 h-11 rounded-lg bg-blue-500/10 ml-3">
          {icon}
        </div>
      </div>
    </div>
  );
};
