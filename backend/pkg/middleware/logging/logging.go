package logging

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
	"github.com/go-kratos/kratos/v2/transport/http"

	adminV1 "go-wind-admin/api/gen/go/admin/service/v1"
)

// Server is an server logging middleware.
func Server(opts ...Option) middleware.Middleware {
	op := options{
		loginOperations: []string{
			adminV1.OperationAuthenticationServiceLogin,
			// MFA 登录挑战验证也按登录事件审计：它是登录流程的二次验证阶段，
			// 审计 schema 已预埋 mfa_status / Status.PARTIAL 等字段支持此语义。
			adminV1.OperationMfaServiceVerifyMFAChallenge,
		},
		logoutOperation: adminV1.OperationAuthenticationServiceLogout,
	}
	for _, o := range opts {
		o(&op)
	}

	if op.ecPrivateKey == nil || op.ecPublicKey == nil {
		op.ecPrivateKey, op.ecPublicKey, _ = generateECDSAKeyPair()
	}

	loginAuditLogMiddleware := NewLoginAuditLogMiddleware(&op)
	apiAuditLogMiddleware := NewApiAuditLogMiddleware(&op)

	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
			startTime := time.Now()

			reply, err = handler(ctx, req)

			// 统计耗时
			latencyMs := time.Since(startTime).Milliseconds()

			if tr, ok := transport.FromServerContext(ctx); ok {
				var htr *http.Transport
				if htr, ok = tr.(*http.Transport); ok {
					loginAuditLogMiddleware.Handle(ctx, htr, err)
					apiAuditLogMiddleware.Handle(ctx, htr, err, latencyMs)
				}
			}

			return
		}
	}
}
