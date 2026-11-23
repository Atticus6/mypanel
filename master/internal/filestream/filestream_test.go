package filestream

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestUploadAndDownloadTicket 验证票据上传落盘、下载回读的完整链路。
func TestUploadAndDownloadTicket(t *testing.T) {
	store := NewStore()
	dir := t.TempDir()
	target := filepath.Join(dir, "hello.txt")

	uploadToken, _, err := store.Issue(Ticket{Purpose: PurposeUpload, Path: target, Filename: "hello.txt", Size: 64})
	if err != nil {
		t.Fatalf("签发上传票据失败: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/files/upload", strings.NewReader("hello"))
	uploadReq.Header.Set("X-File-Ticket", uploadToken)
	uploadRec := httptest.NewRecorder()
	store.UploadHandler().ServeHTTP(uploadRec, uploadReq)
	if uploadRec.Code != http.StatusOK {
		t.Fatalf("upload status = %d, want 200 (%s)", uploadRec.Code, uploadRec.Body.String())
	}
	content, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("读取上传文件失败: %v", err)
	}
	if string(content) != "hello" {
		t.Fatalf("content = %q, want hello", content)
	}

	downloadToken, _, err := store.Issue(Ticket{Purpose: PurposeDownload, Path: target, Filename: "hello.txt"})
	if err != nil {
		t.Fatalf("签发下载票据失败: %v", err)
	}
	downloadReq := httptest.NewRequest(http.MethodGet, "/files/download?ticket="+downloadToken, nil)
	downloadRec := httptest.NewRecorder()
	store.DownloadHandler().ServeHTTP(downloadRec, downloadReq)
	if downloadRec.Code != http.StatusOK {
		t.Fatalf("download status = %d, want 200", downloadRec.Code)
	}
	if got := downloadRec.Body.String(); got != "hello" {
		t.Fatalf("download body = %q, want hello", got)
	}
}

// TestUploadTicketIsOneShot 验证上传票据只能使用一次。
func TestUploadTicketIsOneShot(t *testing.T) {
	store := NewStore()
	target := filepath.Join(t.TempDir(), "a.txt")
	token, _, err := store.Issue(Ticket{Purpose: PurposeUpload, Path: target, Filename: "a.txt"})
	if err != nil {
		t.Fatalf("签发票据失败: %v", err)
	}

	first := httptest.NewRequest(http.MethodPost, "/files/upload", strings.NewReader("x"))
	first.Header.Set("X-File-Ticket", token)
	firstRec := httptest.NewRecorder()
	store.UploadHandler().ServeHTTP(firstRec, first)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("first upload = %d, want 200", firstRec.Code)
	}

	second := httptest.NewRequest(http.MethodPost, "/files/upload", strings.NewReader("y"))
	second.Header.Set("X-File-Ticket", token)
	secondRec := httptest.NewRecorder()
	store.UploadHandler().ServeHTTP(secondRec, second)
	if secondRec.Code != http.StatusForbidden {
		t.Fatalf("second upload = %d, want 403", secondRec.Code)
	}
}

// TestExpiredTicketRejected 验证过期票据被拒绝。
func TestExpiredTicketRejected(t *testing.T) {
	store := NewStore()
	now := time.Now()
	store.now = func() time.Time { return now }
	token, _, err := store.Issue(Ticket{
		Purpose: PurposeDownload,
		Path:    filepath.Join(t.TempDir(), "a.txt"),
		Expires: now.Add(time.Second),
	})
	if err != nil {
		t.Fatalf("签发票据失败: %v", err)
	}
	store.now = func() time.Time { return now.Add(2 * time.Second) }

	req := httptest.NewRequest(http.MethodGet, "/files/download?ticket="+token, nil)
	rec := httptest.NewRecorder()
	store.DownloadHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

// TestIssueRejectsRelativePath 验证只接受绝对路径。
func TestIssueRejectsRelativePath(t *testing.T) {
	store := NewStore()
	if _, _, err := store.Issue(Ticket{Purpose: PurposeUpload, Path: "relative/file.txt"}); err == nil {
		t.Fatal("相对路径应被拒绝")
	}
}
