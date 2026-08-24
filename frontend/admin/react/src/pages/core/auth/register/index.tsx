import React from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const { t } = useTranslation('auth');
  const { register, registerLoading } = useAuthStore();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const handleSubmit = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    // 验证密码一致性
    if (values.password !== values.confirmPassword) {
      message.error(t('passwordMismatch'));
      return;
    }

    try {
      await register({
        username: values.username,
        password: values.password,
      });

      message.success(t('registerSuccess'));

      // 注册成功后跳转到登录页
      setTimeout(() => {
        navigate('/auth/login');
      }, 300);
    } catch (error: any) {
      // 错误已在 store 中处理
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* 标题 */}
      <div className="mb-11">
        <h2 className="text-[34px] font-extrabold tracking-[-0.5px] mb-2.5 text-[color:var(--ant-color-text)]">
          {t('registerTitle')}
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-400">
          {t('registerDescription')}
        </p>
      </div>

      {/* 注册表单 */}
      <Form
        name="register"
        onFinish={handleSubmit}
        size="large"
        className="login-form"
      >
        <Form.Item
          name="username"
          className="login-form-item"
          rules={[
            {
              required: true,
              message: t('usernameRequired'),
            },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder={t('usernamePlaceholder')}
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          className="login-form-item"
          rules={[
            {
              required: true,
              message: t('passwordRequired'),
            },
            {
              min: 6,
              message: t('passwordMinLength'),
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordPlaceholder')}
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          className="login-form-item"
          rules={[
            {
              required: true,
              message: t('confirmPasswordRequired'),
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('passwordMismatch')));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={registerLoading}
            block
            className="login-submit-btn h-11 rounded-lg"
          >
            {registerLoading ? t('registering') : t('registerButton')}
          </Button>
        </Form.Item>
      </Form>

      {/* 底部链接 */}
      <div className="mt-6 text-center text-[13px]">
        <span className="text-[color:var(--ant-color-text-secondary)]">
          {t('hasAccount')}{' '}
        </span>
        <a
          href="/auth/login"
          className="text-[color:var(--ant-color-primary)] hover:text-[color:var(--ant-color-primary-hover)]"
        >
          {t('backToLogin')}
        </a>
      </div>
    </div>
  );
};

export default Register;
