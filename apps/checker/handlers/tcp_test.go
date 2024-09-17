package handlers_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHandler_TCP(t *testing.T) {

	hclient := &http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusAccepted,
			Body:       io.NopCloser(strings.NewReader(`Status Accepted`)),
		}
	})}
	client := tinybird.NewClient(hclient, "apiKey")

	t.Run("it should return 401 if there's no auth", func(t *testing.T) {

		region := "local"
		h := handlers.Handler{
			TbClient:      client,
			Secret:        "",
			CloudProvider: "fly",
			Region:        region,
		}
		router := gin.New()
		router.POST("/tcp/:region", h.TCPHandler)

		w := httptest.NewRecorder()

		data := request.TCPCheckerRequest{
			URL: "https://www.openstatus.dev",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/tcp/"+region, strings.NewReader(string(dataJson)))
		router.ServeHTTP(w, req)

		assert.Equal(t, 401, w.Code)
	})

	t.Run("it should return 400 if the payload is not ok", func(t *testing.T) {
		region := "local"

		h := handlers.Handler{
			TbClient:      client,
			Secret:        "test",
			CloudProvider: "fly",
			Region:        region,
		}
		router := gin.New()
		router.POST("/tcp/:region", h.PingRegionHandler)

		w := httptest.NewRecorder()

		data := request.HttpCheckerRequest{
			URL: "https://www.openstatus.dev",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/tcp/"+region, strings.NewReader(string(dataJson)))
		req.Header.Set("Authorization", "Basic test")
		router.ServeHTTP(w, req)

		assert.Equal(t, 400, w.Code)
		assert.Contains(t, w.Body.String(), "{\"error\":\"invalid request\"}")
	})

	t.Run("it should return 200 if the payload is ok", func(t *testing.T) {
		region := "local"

		h := handlers.Handler{
			TbClient:      client,
			Secret:        "test",
			CloudProvider: "fly",
			Region:        region,
		}
		router := gin.New()
		router.POST("/tcp/:region", h.TCPHandler)

		w := httptest.NewRecorder()

		data := request.TCPCheckerRequest{
			URL:         "openstatus.dev:443",
			WorkspaceID: "1",
			MonitorID:   "1",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/tcp/"+region, strings.NewReader(string(dataJson)))
		req.Header.Set("Authorization", "Basic test")
		router.ServeHTTP(w, req)

		fmt.Println(w.Body.String())
		assert.Equal(t, 200, w.Code)
	})
}
