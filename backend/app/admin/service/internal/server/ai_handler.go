package server

import (
	"context"
	"strconv"
	"sync"
	"time"

	kratoshttp "github.com/go-kratos/kratos/v2/transport/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Phase 2（第一刀）：AI 调用追踪的持久化。
// 为避开 proto/ent/wire 代码生成带来的构建风险，这里采用与 registerFileTransferServiceHandler
// 相同的"手动路由注册"模式 + 自带 pgx 连接池 + 原生 SQL，零 DI 改动。
// 路由走 /admin/v1/ai/*，继承全局 auth 中间件（需 JWT），与其它管理接口一致。
// LLM 调用仍留在前端（用户的 provider key 不上后端），后端只负责存/查追踪。

const aiDSN = "host=127.0.0.1 port=15432 user=postgres password=*Abcd123456 dbname=gwa sslmode=disable"

const (
	aiOpRecordTrace = "/admin.service.v1.AiService/RecordTrace"
	aiOpListTraces  = "/admin.service.v1.AiService/ListTraces"
)

var (
	aiPoolOnce sync.Once
	aiPool     *pgxpool.Pool
	aiPoolErr  error
)

func aiDB() (*pgxpool.Pool, error) {
	aiPoolOnce.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		cfg, err := pgxpool.ParseConfig(aiDSN)
		if err != nil {
			aiPoolErr = err
			return
		}
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			aiPoolErr = err
			return
		}
		// 建表（幂等）。Ent migrate 不管这张表，因为它不是 ent schema。
		_, aiPoolErr = pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS sys_ai_call_traces (
			id bigserial PRIMARY KEY,
			created_at timestamptz NOT NULL DEFAULT now(),
			provider_kind text,
			base_url text,
			model text,
			prompt text,
			response text,
			reasoning text,
			prompt_tokens int,
			completion_tokens int,
			total_tokens int,
			latency_ms int,
			status text,
			finish text,
			error text,
			span_id text
		)`)
		if aiPoolErr != nil {
			return
		}
		aiPool = pool
	})
	if aiPool == nil {
		return nil, aiPoolErr
	}
	return aiPool, nil
}

type aiTraceRecord struct {
	ProviderKind    string `json:"provider_kind"`
	BaseURL         string `json:"base_url"`
	Model           string `json:"model"`
	Prompt          string `json:"prompt"`
	Response        string `json:"response"`
	Reasoning       string `json:"reasoning"`
	PromptTokens    int    `json:"prompt_tokens"`
	CompletionTokens int   `json:"completion_tokens"`
	TotalTokens     int    `json:"total_tokens"`
	LatencyMs       int    `json:"latency_ms"`
	Status          string `json:"status"`
	Finish          string `json:"finish"`
	Error           string `json:"error"`
	SpanID          string `json:"span_id"`
}

type aiTraceRow struct {
	ID              int64     `json:"id"`
	CreatedAt       time.Time `json:"created_at"`
	ProviderKind    string    `json:"provider_kind"`
	Model           string    `json:"model"`
	Status          string    `json:"status"`
	LatencyMs       int       `json:"latency_ms"`
	PromptTokens    int       `json:"prompt_tokens"`
	CompletionTokens int      `json:"completion_tokens"`
	TotalTokens     int       `json:"total_tokens"`
	Finish          string    `json:"finish"`
	Error           string    `json:"error"`
	PromptPreview   string    `json:"prompt_preview"`
	ResponsePreview string    `json:"response_preview"`
}

func registerAiServiceHandler(srv *kratoshttp.Server) {
	r := srv.Route("/")
	r.POST("admin/v1/ai/traces", aiRecordTraceHandler)
	r.GET("admin/v1/ai/traces", aiListTracesHandler)
}

func aiRecordTraceHandler(ctx kratoshttp.Context) error {
	kratoshttp.SetOperation(ctx, aiOpRecordTrace)

	var in aiTraceRecord
	if err := ctx.Bind(&in); err != nil {
		return ctx.Result(400, map[string]string{"error": "invalid body: " + err.Error()})
	}
	db, err := aiDB()
	if err != nil {
		return ctx.Result(500, map[string]string{"error": "db init: " + err.Error()})
	}
	var id int64
	err = db.QueryRow(context.Background(),
		`INSERT INTO sys_ai_call_traces
		 (provider_kind, base_url, model, prompt, response, reasoning,
		  prompt_tokens, completion_tokens, total_tokens, latency_ms, status, finish, error, span_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
		in.ProviderKind, in.BaseURL, in.Model, in.Prompt, in.Response, in.Reasoning,
		in.PromptTokens, in.CompletionTokens, in.TotalTokens, in.LatencyMs,
		emptyIf(in.Status, "ok"), in.Finish, in.Error, in.SpanID,
	).Scan(&id)
	if err != nil {
		return ctx.Result(500, map[string]string{"error": "insert: " + err.Error()})
	}
	return ctx.Result(200, map[string]int64{"id": id})
}

func aiListTracesHandler(ctx kratoshttp.Context) error {
	kratoshttp.SetOperation(ctx, aiOpListTraces)

	db, err := aiDB()
	if err != nil {
		return ctx.Result(500, map[string]string{"error": "db init: " + err.Error()})
	}
	limit := 100
	if s := ctx.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	rows, err := db.Query(context.Background(),
		`SELECT id, created_at,
		       coalesce(provider_kind,''), coalesce(model,''), coalesce(status,''), coalesce(latency_ms,0),
		       coalesce(prompt_tokens,0), coalesce(completion_tokens,0), coalesce(total_tokens,0),
		       coalesce(finish,''), coalesce(error,''),
		       left(coalesce(prompt,''),200), left(coalesce(response,''),200)
		 FROM sys_ai_call_traces ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return ctx.Result(500, map[string]string{"error": "query: " + err.Error()})
	}
	defer rows.Close()
	out := []aiTraceRow{}
	for rows.Next() {
		var r aiTraceRow
		if err := rows.Scan(&r.ID, &r.CreatedAt, &r.ProviderKind, &r.Model, &r.Status, &r.LatencyMs,
			&r.PromptTokens, &r.CompletionTokens, &r.TotalTokens, &r.Finish, &r.Error,
			&r.PromptPreview, &r.ResponsePreview); err != nil {
			return ctx.Result(500, map[string]string{"error": "scan: " + err.Error()})
		}
		out = append(out, r)
	}
	return ctx.Result(200, out)
}

func emptyIf(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
