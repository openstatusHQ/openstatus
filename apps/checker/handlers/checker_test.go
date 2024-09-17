package handlers_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/stretchr/testify/assert"
)

func TestHandler_HTTPCheckerHandler(t *testing.T) {
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
		router.POST("/checker/:region", h.HTTPCheckerHandler)

		w := httptest.NewRecorder()

		data := request.HttpCheckerRequest{
			URL: "https://www.openstatus.dev",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/checker/"+region, strings.NewReader(string(dataJson)))
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
		router.POST("/checker/:region", h.HTTPCheckerHandler)

		w := httptest.NewRecorder()

		data := request.PingRequest{
			URL: "https://www.openstatus.dev",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/checker/"+region, strings.NewReader(string(dataJson)))
		req.Header.Set("Authorization", "Basic test")
		router.ServeHTTP(w, req)

		assert.Equal(t, 400, w.Code)
		assert.Contains(t, w.Body.String(), "{\"error\":\"invalid request\"}")
	})

	t.Run("it should return 200 if the payload is not ok", func(t *testing.T) {
		region := "local"

		httptest.NewRequest(http.MethodGet, "http://www.openstatus.dev", nil)
		httptest.NewRecorder()

		h := handlers.Handler{
			TbClient:      client,
			Secret:        "test",
			CloudProvider: "fly",
			Region:        region,
		}
		router := gin.New()
		router.POST("/checker/:region", h.HTTPCheckerHandler)

		w := httptest.NewRecorder()

		data := request.HttpCheckerRequest{
			URL:    "https://www.openstatus.dev",
			Method: "GET",
			Body:   "",
		}
		dataJson, _ := json.Marshal(data)
		req, _ := http.NewRequest(http.MethodPost, "/checker/"+region, strings.NewReader(string(dataJson)))
		req.Header.Set("Authorization", "Basic test")
		router.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		fmt.Println(w.Body.String())
	})
}
