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
	"github.com/openstatushq/openstatus/apps/checker/checker"
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

func TestEvaluateAssertions_raw(t *testing.T) {
	// Helper to marshal assertion
	marshal := func(a any) json.RawMessage {
		b, _ := json.Marshal(a)
		return b
	}

	// Success if no assertions and status code is 200
	t.Run("no assertions, status code 200", func(t *testing.T) {
		raw := []json.RawMessage{}
		data := handlers.PingData{}
		res := checker.Response{Status: 200}
		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	// Header assertion success
	t.Run("header assertion success", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: request.AssertionHeader}
		target := struct {
			request.Assertion
			Comparator request.StringComparator `json:"compare"`
			Key        string                   `json:"key"`
			Target     string                   `json:"target"`
		}{
			assertion,
			request.StringContains,
			"X-Test",
			"ok",
		}
		rawMsg := marshal(target)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{Headers: `{"X-Test":"ok-value"}`}
		res := checker.Response{Status: 200}

		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	t.Run("header assertion failed", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: request.AssertionHeader}
		target := struct {
			request.Assertion
			Comparator request.StringComparator `json:"compare"`
			Key        string                   `json:"key"`
			Target     string                   `json:"target"`
		}{
			assertion,
			request.StringContains,
			"X-Test",
			"not-ok",
		}
		rawMsg := marshal(target)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{Headers: `{"X-Test":"ok-value"}`}
		res := checker.Response{Status: 200}

		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.False(t, ok)
		assert.NoError(t, err)
	})

	// Text body assertion failure
	t.Run("text body assertion failure", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: request.AssertionTextBody}
		target := struct {
			request.Assertion
			Comparator request.StringComparator `json:"compare"`
			Target     string                   `json:"target"`
		}{
			assertion,
			request.StringEquals,
			"fail",
		}
		rawMsg := marshal(target)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{Body: "ok"}
		res := checker.Response{Status: 200}

		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.False(t, ok)
		assert.NoError(t, err)
	})

	// Text body assertion failure
	t.Run("text body assertion success", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: request.AssertionTextBody}
		target := struct {
			request.Assertion
			Comparator request.StringComparator `json:"compare"`
			Target     string                   `json:"target"`
		}{
			assertion,
			request.StringEquals,
			"success",
		}
		rawMsg := marshal(target)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{Body: "success"}
		res := checker.Response{Status: 200}

		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.True(t, ok)
		assert.NoError(t, err)
	})
	// Status assertion success
	t.Run("status assertion success", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: request.AssertionStatus}
		target := struct {
			request.Assertion
			Comparator request.NumberComparator `json:"compare"`
			Target     int64                    `json:"target"`
		}{
			assertion,
			request.NumberEquals,
			200,
		}
		rawMsg := marshal(target)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{}
		res := checker.Response{Status: 200}

		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.True(t, ok)
		assert.NoError(t, err)
	})

	// Malformed assertion
	t.Run("malformed assertion", func(t *testing.T) {
		raw := []json.RawMessage{[]byte(`{not valid json}`)}
		data := handlers.PingData{}
		res := checker.Response{Status: 200}
		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.False(t, ok)
		assert.Error(t, err)
	})

	// Unknown assertion type
	t.Run("unknown assertion type", func(t *testing.T) {
		assertion := request.Assertion{AssertionType: "unknown"}
		rawMsg := marshal(assertion)
		raw := []json.RawMessage{rawMsg}
		data := handlers.PingData{}
		res := checker.Response{Status: 200}
		ok, err := handlers.EvaluateHTTPAssertions(raw, data, res)
		assert.True(t, ok) // Should not fail, just skip
		assert.NoError(t, err)
	})
}
