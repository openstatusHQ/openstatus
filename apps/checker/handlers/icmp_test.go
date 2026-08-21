package handlers_test

import (
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
