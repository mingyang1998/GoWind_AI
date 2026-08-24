import {
  useDashboardOverview,
  useLoginStatusDistribution,
  useLoginTrend,
  useOperationActionDistribution,
} from '@/api/hooks/dashboard';
import ContentContainer from '@/layouts/components/PageContainer/ContentContainer';
import { Row, Col, Spin } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  LoginOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/core/i18n';
import { SourceDonutChart, SourcePieChart, StatsCard, TrendChart } from './components';

const Dashboard = () => {
  const { t } = useI18n('dashboard');

  // 概览卡：数值来自后端 GetOverview。加载中时整体返回 Spin。
  const overviewQuery = useDashboardOverview();
  const trendQuery = useLoginTrend(7);
  const actionDistQuery = useOperationActionDistribution();
  const statusDistQuery = useLoginStatusDistribution();

  if (overviewQuery.isLoading) {
    return (
      <ContentContainer heightMode="auto" scrollable padding="16px">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      </ContentContainer>
    );
  }

  const d = overviewQuery.data;
  const iconPool = [
    <UserOutlined style={{ fontSize: 24, color: 'var(--ant-color-primary)' }} />,
    <TeamOutlined style={{ fontSize: 24, color: 'var(--ant-color-warning)' }} />,
    <LoginOutlined style={{ fontSize: 24, color: 'var(--ant-color-warning)' }} />,
    <AuditOutlined style={{ fontSize: 24, color: 'var(--ant-color-success)' }} />,
  ];
  const values = [
    d?.userCount ?? 0,
    d?.roleCount ?? 0,
    d?.todayLoginCount ?? 0,
    d?.todayOperationCount ?? 0,
  ];
  const titleKeys = [
    'stats.userCount',
    'stats.roleCount',
    'stats.todayLoginCount',
    'stats.todayOperationCount',
  ];

  return (
    <ContentContainer heightMode="auto" scrollable padding="16px">
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {values.map((v, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <StatsCard
              title={t(titleKeys[i]!)}
              value={v}
              total={t('stats.total')}
              totalValue={v}
              icon={iconPool[i]}
            />
          </Col>
        ))}
      </Row>

      {/* 登录趋势图 */}
      <TrendChart data={trendQuery.data} />

      {/* 第三行：操作类型分布 + 登录状态分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <SourceDonutChart data={actionDistQuery.data} />
        </Col>
        <Col xs={24} lg={12}>
          <SourcePieChart data={statusDistQuery.data} />
        </Col>
      </Row>
    </ContentContainer>
  );
};

export default Dashboard;
