import { Card, theme } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import type { ActionDistributionResponse } from '@/api/generated/admin/service/v1';
import { useI18n } from '@/core/i18n';

interface SourceDonutChartProps {
  data?: ActionDistributionResponse;
}

/**
 * 操作类型分布环形图。
 * 后端返回 action 枯举名（CREATE/UPDATE/...），legend 直接展示枯举名。
 */
export const SourceDonutChart = ({ data }: SourceDonutChartProps) => {
  const { token } = theme.useToken();
  const { t } = useI18n('dashboard');

  // 科技风暗色系调色板（靛蓝、翠绿、紫罗兰、琥珀）
  const palette = ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b'];

  const option = useMemo(() => {
    const items = data?.items ?? [];
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: 'rgba(20,20,30,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e2e8f0' },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        data: items.map((it) => it.label),
        textStyle: {
          color: '#94a3b8',
          fontSize: 12,
        },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
      },
      series: [
        {
          name: t('charts.operationActionDistribution'),
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: token.colorBgContainer,
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
            },
            scaleSize: 8,
          },
          labelLine: {
            show: false,
          },
          data: items.map((it, i) => ({
            value: it.count,
            name: it.label,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };
  }, [data, token, t]);

  return (
    <Card title={t('charts.operationActionDistribution')} style={{ height: '100%' }}>
      <ReactECharts option={option} style={{ height: 280 }} />
    </Card>
  );
};
