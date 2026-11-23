// Package filestream 负责大文件上传/下载的一次性票据与二进制 HTTP 端点。
//
// 大文件不走 unary proto：内存翻倍、无法断点续传、无法 Range。
// RPC 只签发短期票据，真正的字节流走 /files/upload 与 /files/download；
// 票据绑定目标路径与用途，上传票据一次性使用。
package filestream

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Purpose 是票据用途。
type Purpose string

const (
	// PurposeUpload 表示上传票据。
	PurposeUpload Purpose = "upload"
	// PurposeDownload 表示下载票据。
	PurposeDownload Purpose = "download"
)

// DefaultTTL 是票据默认有效期。
const DefaultTTL = 10 * time.Minute

// Ticket 是一张待使用的传输票据。
type Ticket struct {
	// Purpose 是用途：upload 或 download。
	Purpose Purpose
	// Path 是最终文件路径。
	Path string
	// Filename 是展示用文件名。
	Filename string
	// Size 是允许的最大字节数；0 表示不限制。
	Size int64
	// Overwrite 表示上传时是否覆盖同名文件。
	Overwrite bool
	// Expires 是过期时间。
	Expires time.Time
}

// Store 是进程内票据存储。
//
// 单进程部署不需要 Redis；票据短期有效，进程重启后失效是可接受的行为。
type Store struct {
	mu    sync.Mutex
	items map[string]Ticket
	now   func() time.Time
	ttl   time.Duration
}

// NewStore 创建票据存储。
func NewStore() *Store {
	return &Store{items: map[string]Ticket{}, now: time.Now, ttl: DefaultTTL}
}

// Issue 签发一张票据，返回 token 与过期时间。
func (s *Store) Issue(ticket Ticket) (string, time.Time, error) {
	if ticket.Purpose != PurposeUpload && ticket.Purpose != PurposeDownload {
		return "", time.Time{}, errors.New("invalid ticket purpose")
	}
	cleanPath, err := cleanAbsolutePath(ticket.Path)
	if err != nil {
		return "", time.Time{}, err
	}
	ticket.Path = cleanPath
	if ticket.Expires.IsZero() {
		ticket.Expires = s.now().Add(s.ttl)
	}

	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", time.Time{}, err
	}
	token := hex.EncodeToString(buf)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.gcLocked()
	s.items[token] = ticket
	return token, ticket.Expires, nil
}

// Consume 取出并删除票据。
func (s *Store) Consume(token string, purpose Purpose) (Ticket, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.gcLocked()
	ticket, ok := s.items[token]
	if !ok || ticket.Purpose != purpose || s.now().After(ticket.Expires) {
		return Ticket{}, false
	}
	delete(s.items, token)
	return ticket, true
}

// gcLocked 清理过期票据，调用方必须持锁。
func (s *Store) gcLocked() {
	now := s.now()
	for token, ticket := range s.items {
		if now.After(ticket.Expires) {
			delete(s.items, token)
		}
	}
}

// UploadHandler 返回 /files/upload 处理器。
func (s *Store) UploadHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		token := strings.TrimSpace(r.Header.Get("X-File-Ticket"))
		if token == "" {
			token = strings.TrimSpace(r.URL.Query().Get("ticket"))
		}
		ticket, ok := s.Consume(token, PurposeUpload)
		if !ok {
			http.Error(w, "invalid or expired ticket", http.StatusForbidden)
			return
		}

		body := http.MaxBytesReader(w, r.Body, uploadLimit(ticket))
		defer body.Close()

		if err := os.MkdirAll(filepath.Dir(ticket.Path), 0o755); err != nil {
			http.Error(w, "create directory failed", http.StatusInternalServerError)
			return
		}
		flag := os.O_CREATE | os.O_WRONLY | os.O_TRUNC
		if !ticket.Overwrite {
			flag = os.O_CREATE | os.O_WRONLY | os.O_EXCL
		}
		file, err := os.OpenFile(ticket.Path, flag, 0o644)
		if err != nil {
			http.Error(w, "open target file failed", http.StatusConflict)
			return
		}
		defer file.Close()

		written, err := io.Copy(file, body)
		if err != nil {
			_ = os.Remove(ticket.Path)
			http.Error(w, "write file failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"written":%d}`, written)
	})
}

// DownloadHandler 返回 /files/download 处理器。
func (s *Store) DownloadHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		token := strings.TrimSpace(r.URL.Query().Get("ticket"))
		if token == "" {
			token = strings.TrimSpace(r.Header.Get("X-File-Ticket"))
		}
		ticket, ok := s.Consume(token, PurposeDownload)
		if !ok {
			http.Error(w, "invalid or expired ticket", http.StatusForbidden)
			return
		}

		file, err := os.Open(ticket.Path)
		if err != nil {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil || info.IsDir() {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}

		disposition := mime.FormatMediaType("attachment", map[string]string{"filename": ticket.Filename})
		w.Header().Set("Content-Disposition", disposition)
		w.Header().Set("Content-Type", "application/octet-stream")
		http.ServeContent(w, r, ticket.Filename, info.ModTime(), file)
	})
}

// uploadLimit 返回上传体积上限。
func uploadLimit(ticket Ticket) int64 {
	if ticket.Size > 0 {
		// 允许多 1MB 的 multipart 包装开销。
		return ticket.Size + 1<<20
	}
	return 1 << 34 // 16GB 兜底，避免无上限占用磁盘
}

// cleanAbsolutePath 校验并清理路径，拒绝相对路径与空字节。
func cleanAbsolutePath(value string) (string, error) {
	if !filepath.IsAbs(value) {
		return "", errors.New("path must be absolute")
	}
	cleaned := filepath.Clean(value)
	if strings.ContainsRune(cleaned, '\x00') {
		return "", errors.New("invalid path")
	}
	return cleaned, nil
}
