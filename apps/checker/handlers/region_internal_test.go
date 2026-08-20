package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func regionContext(t *testing.T, target string, headers map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, target, nil)

	for key, value := range headers {
		c.Request.Header.Set(key, value)
	}

	return c, rec
}

func TestRequestedRegionPrefersQueryParam(t *testing.T) {
	c, _ := regionContext(t, "/checker/http?region=fra", map[string]string{
		"fly-force-region": "arn",
	})

	if got := requestedRegion(c); got != "fra" {
		t.Fatalf("requestedRegion() = %q, want %q", got, "fra")
	}
}

func TestRequestedRegionFallsBackToHeaders(t *testing.T) {
	c, _ := regionContext(t, "/checker/http", map[string]string{
		"fly-prefer-region": "ams",
	})

	if got := requestedRegion(c); got != "ams" {
		t.Fatalf("requestedRegion() = %q, want %q", got, "ams")
	}
}

func TestServeRegionMatching(t *testing.T) {
	h := Handler{CloudProvider: "fly", Region: "ams"}
	c, _ := regionContext(t, "/checker/http?region=ams", nil)

	if !h.serveRegion(c, requestedRegion(c)) {
		t.Fatal("serveRegion() = false, want true for the requested region")
	}
}

func TestServeRegionReplaysMisroutedRequest(t *testing.T) {
	h := Handler{CloudProvider: "fly", Region: "arn"}
	c, rec := regionContext(t, "/checker/http?region=fra", nil)

	if h.serveRegion(c, requestedRegion(c)) {
		t.Fatal("serveRegion() = true, want false for a misrouted request")
	}
	if got := rec.Header().Get("fly-replay"); got != "region=fra;fallback=force_self" {
		t.Fatalf("fly-replay = %q, want the request replayed to fra", got)
	}
}

func TestServeRegionDropsCheckWhenReplayFailed(t *testing.T) {
	h := Handler{CloudProvider: "fly", Region: "arn"}
	c, rec := regionContext(t, "/checker/http?region=fra", map[string]string{
		"fly-replay-failed": "region=fra;reason=no_candidate",
	})

	if h.serveRegion(c, requestedRegion(c)) {
		t.Fatal("serveRegion() = true, want false once the replay failed")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
	if got := rec.Header().Get("fly-replay"); got != "" {
		t.Fatalf("fly-replay = %q, want no second replay", got)
	}
}

func TestServeRegionKeepsServingOutsideFly(t *testing.T) {
	h := Handler{CloudProvider: "koyeb", Region: "koyeb_fra"}
	c, _ := regionContext(t, "/ping/koyeb_par", nil)

	if !h.serveRegion(c, "koyeb_par") {
		t.Fatal("serveRegion() = false, want true: only Fly can replay")
	}
}
