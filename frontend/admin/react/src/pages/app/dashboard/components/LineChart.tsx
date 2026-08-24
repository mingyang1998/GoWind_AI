import ReactECharts from 'echarts-for-react';
import { theme } from 'antd';
import { useMemo } from 'react';
import type { LoginTrendResponse } from '@/api/generated/admin/service/v1';

interface LineChartProps {
  data?: LoginTrendResponse;
}

/**
 * 登录趋势折线图组件。
 * 数据由父组件从后端 GetLoginTrend 拉取后通过 prop 下发；
 * 后端已按日补零、升序返回 points。
 */
export const LineChart = ({ data }: LineChartProps) => {
  const { token } = theme.useToken();

  const option = useMemo(() => {
    const points = data?.points ?? [];
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20,20,30,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e2e8f0' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((p) => p.date),
        axisLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.06)',
          },
        },
        axisTick: {
          lineStyle: {
            color: 'rgba(255,255,255,0.06)',
          },
        },
        axisLabel: {
          color: token.colorTextSecondary,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: token.colorTextSecondary,
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.05)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59,130,246,0.25)' },
                { offset: 1, color: 'rgba(59,130,246,0)' },
              ],
            },
          },
          lineStyle: {
            width: 2.5,
            color: token.colorPrimary,
          },
          itemStyle: {
            color: token.colorPrimary,
            borderColor: token.colorBgContainer,
            borderWidth: 2,
          },
          data: points.map((p) => p.count),
        },
      ],
    };
  }, [data, token]);

  return <ReactECharts option={option} style={{ height: 300 }} />;
};
