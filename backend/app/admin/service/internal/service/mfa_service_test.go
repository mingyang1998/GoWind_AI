package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/pquerna/otp"
	otpTotp "github.com/pquerna/otp/totp"
)

// TestTotpGenerateAndValidate 验证 StartEnrollMethod/VerifyMFAChallenge 共用的
// TOTP 生成-校验闭环：同参数生成的 key，其当前有效码必须能被 ValidateCustom
// （±1 窗口、6 位、SHA1）验证通过；错误码必须失败。
func TestTotpGenerateAndValidate(t *testing.T) {
	key, err := otpTotp.Generate(otpTotp.GenerateOpts{
		Issuer:      mfaTotpIssuer,
		AccountName: "uid:1",
	})
	if err != nil {
		t.Fatalf("generate totp key failed: %v", err)
	}

	code, err := otpTotp.GenerateCode(key.Secret(), time.Now())
	if err != nil {
		t.Fatalf("generate code failed: %v", err)
	}

	ok, verr := otpTotp.ValidateCustom(code, key.Secret(), time.Now(), otpTotp.ValidateOpts{
		Period:    30,
		Skew:      mfaTotpSkew,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	if verr != nil || !ok {
		t.Fatalf("valid code rejected: ok=%v err=%v", ok, verr)
	}

	ok, verr = otpTotp.ValidateCustom("000000", key.Secret(), time.Now(), otpTotp.ValidateOpts{
		Period:    30,
		Skew:      mfaTotpSkew,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	// 000000 恰好是当期有效码的概率是 1/10^6，测试撞上视为通过
	if verr == nil && ok && code != "000000" {
		t.Fatalf("invalid code accepted")
	}
}

// TestTotpSkewWindow 验证 ±1 时间窗口：上一周期的码（30s 前）应被接受（时钟漂移容忍），
// 两个周期前（60s 前）必须被拒绝。
func TestTotpSkewWindow(t *testing.T) {
	key, err := otpTotp.Generate(otpTotp.GenerateOpts{
		Issuer:      mfaTotpIssuer,
		AccountName: "uid:1",
	})
	if err != nil {
		t.Fatalf("generate totp key failed: %v", err)
	}

	opts := otpTotp.ValidateOpts{
		Period:    30,
		Skew:      mfaTotpSkew,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	}

	prevCode, err := otpTotp.GenerateCode(key.Secret(), time.Now().Add(-30*time.Second))
	if err != nil {
		t.Fatalf("generate prev code failed: %v", err)
	}
	if ok, _ := otpTotp.ValidateCustom(prevCode, key.Secret(), time.Now(), opts); !ok {
		t.Fatalf("prev-period code should be accepted within skew=1")
	}

	oldCode, err := otpTotp.GenerateCode(key.Secret(), time.Now().Add(-60*time.Second))
	if err != nil {
		t.Fatalf("generate old code failed: %v", err)
	}
	if ok, _ := otpTotp.ValidateCustom(oldCode, key.Secret(), time.Now(), opts); ok {
		t.Fatalf("two-period-old code should be rejected")
	}
}

// TestParseFactorId 验证 credential_id 字符串到 uint32 主键的解析。
func TestParseFactorId(t *testing.T) {
	cases := []struct {
		in      string
		want    uint32
		wantErr bool
	}{
		{"1", 1, false},
		{"4294967295", 4294967295, false},
		{"", 0, true},
		{"abc", 0, true},
		{"-1", 0, true},
		{"4294967296", 0, true}, // 超 uint32
	}
	for _, c := range cases {
		got, err := parseFactorId(c.in)
		if c.wantErr {
			if err == nil {
				t.Fatalf("parseFactorId(%q) expected error, got %d", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Fatalf("parseFactorId(%q) unexpected error: %v", c.in, err)
		}
		if got != c.want {
			t.Fatalf("parseFactorId(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

// TestTotpQrDataUri 验证 QR data URI 生成的形状：data:image/png;base64 前缀 + 非空负载。
func TestTotpQrDataUri(t *testing.T) {
	key, err := otpTotp.Generate(otpTotp.GenerateOpts{
		Issuer:      mfaTotpIssuer,
		AccountName: "uid:1",
	})
	if err != nil {
		t.Fatalf("generate totp key failed: %v", err)
	}

	uri, err := totpQrDataUri(key)
	if err != nil {
		t.Fatalf("totpQrDataUri failed: %v", err)
	}
	const prefix = "data:image/png;base64,"
	if len(uri) <= len(prefix) || uri[:len(prefix)] != prefix {
		t.Fatalf("qr data uri missing png prefix: %s...", fmt.Sprintf("%.40s", uri))
	}

	if _, err := totpQrDataUri(nil); err == nil {
		t.Fatalf("totpQrDataUri(nil) should fail")
	}
}
