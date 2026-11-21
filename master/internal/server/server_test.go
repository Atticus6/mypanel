package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func newTestServer(t *testing.T, webFS fstest.MapFS) http.Handler {
	t.Helper()
	return New(Options{
		Version: "test",
		WebFS:   webFS,
		Logger:  slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
}

func postJSON(t *testing.T, h http.Handler, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestPingIsMountedAtRootAndRPCPrefix(t *testing.T) {
	h := newTestServer(t, nil)

	for _, path := range []string{
		"/panel.v1.PanelService/Ping",
		RPCPrefix + "/panel.v1.PanelService/Ping",
	} {
		t.Run(path, func(t *testing.T) {
			rec := postJSON(t, h, path, `{"message":"hi"}`)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
			}
			if got := rec.Body.String(); !strings.Contains(got, `"message":"hi"`) {
				t.Fatalf("body = %q, want echoed message", got)
			}
			if !strings.Contains(rec.Body.String(), `"version":"test"`) {
				t.Fatalf("body = %q, want version", rec.Body.String())
			}
		})
	}
}

func TestHealthz(t *testing.T) {
	h := newTestServer(t, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != "ok" {
		t.Fatalf("body = %q, want ok", got)
	}
}

func TestSPAServesIndexAndDeepLinks(t *testing.T) {
	webFS := fstest.MapFS{
		"index.html":     {Data: []byte("<!doctype html><div id=app></div>")},
		"assets/app.js":  {Data: []byte("console.log(1)")},
		"assets/app.css": {Data: []byte("body{}")},
	}
	h := newTestServer(t, webFS)

	t.Run("index", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "id=app") {
			t.Fatalf("body = %q, want index.html", rec.Body.String())
		}
	})

	t.Run("deep link falls back to index", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/about", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "id=app") {
			t.Fatalf("body = %q, want index.html", rec.Body.String())
		}
	})

	t.Run("asset is served as a file", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "console.log") {
			t.Fatalf("body = %q, want asset contents", rec.Body.String())
		}
	})
}

func TestSPAReportsMissingBuild(t *testing.T) {
	// A clean checkout embeds only the placeholder, so index.html is absent.
	h := newTestServer(t, fstest.MapFS{".gitkeep": {Data: []byte("placeholder")}})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "scripts/build.sh") {
		t.Fatalf("body = %q, want build hint", rec.Body.String())
	}
}
