package core

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"strings"
	"testing"

	"connectrpc.com/connect"

	"mypanel/core/app/repo"
	"mypanel/master/internal/bootstrap"
	"mypanel/master/internal/transport/bridge"
	corev1 "mypanel/proto/gen/go/panel/core/v1"
)

// setupCore 在临时目录启动一次 core，返回管理员密码。
//
// 登录依赖迁移写入的管理员密码与 hook 生成的 RSA 密钥，
// 所以测试必须走真实初始化流程，不能只构造 AuthServer。
func setupCore(t *testing.T) string {
	t.Helper()
	password := strings.Repeat("p", 12)
	err := bootstrap.InitCore(bootstrap.CoreOptions{
		DataDir:       t.TempDir(),
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: password,
		Mode:          "stable",
		Language:      "zh",
	})
	if err != nil {
		t.Fatalf("InitCore: %v", err)
	}
	return password
}

// TestLoginWithEncryptedPassword 验证完整登录链路：
// proto 请求 → 1Panel 登录逻辑 → 会话 Cookie → proto 响应。
func TestLoginWithEncryptedPassword(t *testing.T) {
	password := setupCore(t)

	handler := http.Header{}
	handler.Set("User-Agent", "bootstrap-test")
	c, recorder := bridge.New(context.Background(), handler, "127.0.0.1:5000", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)

	server := NewAuthServer()
	resp, err := server.Login(ctx, connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, password),
		Language: "zh",
	}))
	if err != nil {
		t.Fatalf("Login 返回错误: %v", err)
	}
	if resp.Msg.GetName() != "admin" {
		t.Fatalf("name = %q, 期望 admin", resp.Msg.GetName())
	}
	if resp.Msg.GetRole() != "ADMIN" {
		t.Fatalf("role = %q, 期望 ADMIN", resp.Msg.GetRole())
	}

	// 登录必须下发会话 Cookie，否则浏览器下一个请求仍然未登录。
	cookies := recorder.Header().Values("Set-Cookie")
	if len(cookies) == 0 {
		t.Fatal("登录未下发任何 Cookie")
	}
}

// TestLoginRejectsWrongPassword 验证错误密码映射为未认证错误。
func TestLoginRejectsWrongPassword(t *testing.T) {
	password := setupCore(t)
	_ = password

	c, _ := bridge.New(context.Background(), http.Header{}, "127.0.0.1:5000", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)

	server := NewAuthServer()
	_, err := server.Login(ctx, connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, "definitely-wrong"),
		Language: "zh",
	}))
	if err == nil {
		t.Fatal("错误密码应当返回错误")
	}
	var connectErr *connect.Error
	if !asConnectError(err, &connectErr) {
		t.Fatalf("错误类型 = %T, 期望 *connect.Error", err)
	}
	if connectErr.Code() != connect.CodeUnauthenticated {
		t.Fatalf("code = %v, 期望 unauthenticated", connectErr.Code())
	}
}

// asConnectError 是 errors.As 的小包装，避免在测试里重复导入 errors。
func asConnectError(err error, target **connect.Error) bool {
	for err != nil {
		if typed, ok := err.(*connect.Error); ok {
			*target = typed
			return true
		}
		type unwrapper interface{ Unwrap() error }
		u, ok := err.(unwrapper)
		if !ok {
			return false
		}
		err = u.Unwrap()
	}
	return false
}

// encryptLoginPassword 按前端的方式加密密码：
// 随机 AES 密钥加密密码，再用 RSA 公钥加密 AES 密钥。
//
// 纯文本密码在服务端会被 RSA 解密失败，所以测试必须复刻这套协议。
func encryptLoginPassword(t *testing.T, password string) string {
	t.Helper()

	settingRepo := repo.NewISettingRepo()
	publicKeyPEM, err := settingRepo.GetValueByKey("PASSWORD_PUBLIC_KEY")
	if err != nil {
		t.Fatalf("读取公钥失败: %v", err)
	}
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		t.Fatal("公钥 PEM 解析失败")
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		t.Fatalf("解析公钥失败: %v", err)
	}
	publicKey, ok := parsed.(*rsa.PublicKey)
	if !ok {
		t.Fatal("公钥类型不是 RSA")
	}

	aesKey := make([]byte, 16)
	if _, err := rand.Read(aesKey); err != nil {
		t.Fatalf("生成 AES 密钥失败: %v", err)
	}
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		t.Fatalf("生成 IV 失败: %v", err)
	}

	plain := pkcs7Pad([]byte(password), aes.BlockSize)
	blockCipher, err := aes.NewCipher(aesKey)
	if err != nil {
		t.Fatalf("AES 初始化失败: %v", err)
	}
	ciphertext := make([]byte, len(plain))
	cipher.NewCBCEncrypter(blockCipher, iv).CryptBlocks(ciphertext, plain)

	encryptedKey, err := rsa.EncryptPKCS1v15(rand.Reader, publicKey, aesKey)
	if err != nil {
		t.Fatalf("RSA 加密失败: %v", err)
	}

	return strings.Join([]string{
		base64.StdEncoding.EncodeToString(encryptedKey),
		base64.StdEncoding.EncodeToString(iv),
		base64.StdEncoding.EncodeToString(ciphertext),
	}, ":")
}

// pkcs7Pad 按块大小填充，与前端库的行为一致。
func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

// TestAuthMFAAndPasskeyTolerant 验证 MFA/Passkey/Cookie 相关接口的容错行为。
func TestAuthMFAAndPasskeyTolerant(t *testing.T) {
	setupCore(t)

	c, _ := bridge.New(context.Background(), http.Header{}, "127.0.0.1:5000", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)
	server := NewAuthServer()

	// 未登录时关闭 MFA / 删除 Passkey 必须返回 Connect 错误而不是 panic。
	if _, err := server.CloseMFA(ctx, connect.NewRequest(&corev1.CloseMFARequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("close mfa: %T", err)
		}
	}
	if _, err := server.PasskeyDelete(ctx, connect.NewRequest(&corev1.PasskeyDeleteRequest{Id: "missing"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("passkey delete: %T", err)
		}
	}
	if _, err := server.GetMFA(ctx, connect.NewRequest(&corev1.GetMFARequest{Title: "panel", Interval: 30})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("get mfa: %T", err)
		}
	}
}
