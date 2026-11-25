package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/stretchr/testify/assert"
)

func TestICMPHandler_RejectsUnauthorized(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/icmp", h.ICMPHandler)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/icmp", strings.NewReader(`{"uri":"1.1.1.1"}`))
	r.Header.Set("Authorization", "Basic wrong")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestICMPHandler_RejectsBadPayload(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/icmp", h.ICMPHandler)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/icmp", strings.NewReader(`{not json`))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestICMPHandlerRegion_RequiresRegion(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/icmp/:region", h.ICMPHandlerRegion)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/icmp/local", strings.NewReader(`{"uri":"1.1.1.1"}`))
	r.Header.Set("Authorization", "Basic wrong")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// A check that exhausts its retries is still returned under `?data=true`, so it
// has to carry the same identifying fields as a successful one — the success
// path sets them inside op(), which never runs when every attempt fails.
func TestICMPHandler_FailureResponseKeepsJobTypeAndRegion(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/icmp", h.ICMPHandler)

	w := httptest.NewRecorder()
	// 192.0.2.1 is TEST-NET-1 (RFC 5737): never answers, so every retry fails.
	body := `{"uri":"192.0.2.1","timeout":200,"retry":1,"workspaceId":"1","monitorId":"1"}`
	r, _ := http.NewRequest(http.MethodPost, "/checker/icmp?data=true", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response %q: %v", w.Body.String(), err)
	}

	assert.Equal(t, "icmp", res["jobType"], "jobType is the discriminator callers match on")
	assert.Equal(t, "local", res["region"])
	assert.Equal(t, float64(1), res["error"])
}
