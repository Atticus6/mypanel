package server

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// testWebFS 构造一个带 CSS/JS/PNG 的前端产物，用于验证压缩策略。
func testWebFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":      {Data: []byte("<!doctype html><div id=app></div>")},
		"assets/app.css":  {Data: []byte(strings.Repeat(".a{color:red}", 100))},
		"assets/app.js":   {Data: []byte(strings.Repeat("console.log(1);", 100))},
		"assets/logo.png": {Data: []byte("\x89PNG\r\n\x1a\n")},
	}
}

func get(t *testing.T, h http.Handler, path string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestGzipCompressesCSS(t *testing.T) {
	h := newTestServer(t, testWebFS())

	rec := get(t, h, "/assets/app.css", map[string]string{
		"Accept-Encoding": "gzip",
	})

	if got := rec.Code; got != http.StatusOK {
		t.Fatalf("status = %d, want 200", got)
	}
	if got := rec.Header().Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip", got)
	}
	// 中间缓存必须知道响应随 Accept-Encoding 变化。
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Accept-Encoding") {
		t.Fatalf("Vary = %q, want to contain Accept-Encoding", got)
	}

	// 解压后内容必须与源文件一致。
	gz, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatalf("gzip.NewReader: %v", err)
	}
	body, err := io.ReadAll(gz)
	if err != nil {
		t.Fatalf("read gzip body: %v", err)
	}
	want := strings.Repeat(".a{color:red}", 100)
	if string(body) != want {
		t.Fatalf("body length = %d, want %d", len(body), len(want))
	}
}

func TestGzipSkipsWhenNotAccepted(t *testing.T) {
	h := newTestServer(t, testWebFS())

	rec := get(t, h, "/assets/app.css", nil)

	if got := rec.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("Content-Encoding = %q, want empty without Accept-Encoding", got)
	}
	if !strings.Contains(rec.Body.String(), ".a{color:red}") {
		t.Fatalf("body = %q, want uncompressed CSS", rec.Body.String())
	}
}

func TestGzipSkipsAlreadyCompressedTypes(t *testing.T) {
	h := newTestServer(t, testWebFS())

	rec := get(t, h, "/assets/logo.png", map[string]string{
		"Accept-Encoding": "gzip",
	})

	// PNG 本身已压缩，再 gzip 只会浪费 CPU。
	if got := rec.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("Content-Encoding = %q, want empty for .png", got)
	}
	if got := rec.Code; got != http.StatusOK {
		t.Fatalf("status = %d, want 200", got)
	}
}

func TestGzipSkipsRangeRequests(t *testing.T) {
	h := newTestServer(t, testWebFS())

	// Range 请求需要按字节区间响应，与整体压缩冲突，必须跳过。
	rec := get(t, h, "/assets/app.css", map[string]string{
		"Accept-Encoding": "gzip",
		"Range":           "bytes=0-9",
	})

	if got := rec.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("Content-Encoding = %q, want empty for Range request", got)
	}
}

func TestGzipSetsCorrectContentType(t *testing.T) {
	// 回归测试：压缩路径绕过了 http.FileServer，必须自己设置 Content-Type。
	// 浏览器对 ES module 强制要求 JS MIME 类型，缺失会直接拒绝执行脚本，
	// 页面表现为白屏，且没有任何控制台报错指向真正原因。
	h := newTestServer(t, testWebFS())

	tests := []struct {
		path string
		want string
	}{
		{path: "/assets/app.js", want: "text/javascript"},
		{path: "/assets/app.css", want: "text/css"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := get(t, h, tt.path, map[string]string{"Accept-Encoding": "gzip"})

			if got := rec.Header().Get("Content-Encoding"); got != "gzip" {
				t.Fatalf("Content-Encoding = %q, want gzip", got)
			}
			got := rec.Header().Get("Content-Type")
			if !strings.HasPrefix(got, tt.want) {
				t.Fatalf("Content-Type = %q, want prefix %q", got, tt.want)
			}
		})
	}
}

func TestShouldGzipMatrix(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		acceptEnc string
		rangeHdr  string
		want      bool
	}{
		{name: "css 且支持 gzip", path: "/a.css", acceptEnc: "gzip", want: true},
		{name: "js 且支持 gzip", path: "/a.js", acceptEnc: "gzip", want: true},
		{name: "svg 且支持 gzip", path: "/a.svg", acceptEnc: "gzip, deflate", want: true},
		{name: "大写扩展名", path: "/a.CSS", acceptEnc: "gzip", want: true},
		{name: "不支持 gzip", path: "/a.css", want: false},
		{name: "png 不压缩", path: "/a.png", acceptEnc: "gzip", want: false},
		{name: "woff2 不压缩", path: "/a.woff2", acceptEnc: "gzip", want: false},
		{name: "无扩展名不压缩", path: "/a", acceptEnc: "gzip", want: false},
		{name: "Range 请求跳过", path: "/a.css", acceptEnc: "gzip", rangeHdr: "bytes=0-1", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			if tt.acceptEnc != "" {
				req.Header.Set("Accept-Encoding", tt.acceptEnc)
			}
			if tt.rangeHdr != "" {
				req.Header.Set("Range", tt.rangeHdr)
			}

			if got := shouldGzip(req, tt.path); got != tt.want {
				t.Fatalf("shouldGzip(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}
