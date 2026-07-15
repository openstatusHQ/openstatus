package checker_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

func TestHttpViaProxy(t *testing.T) {
	t.Run("forwards the check and maps the proxy result", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Equal(t, "secret", r.Header.Get("X-Proxy-Token"))

			var proxyReq checker.ProxyRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&proxyReq))
			assert.Equal(t, "https://openstat.us", proxyReq.URL)
			assert.Equal(t, http.MethodGet, proxyReq.Method)
			assert.Equal(t, "Value", proxyReq.Headers["Test"])
			assert.Equal(t, int64(30000), proxyReq.Timeout)
			assert.True(t, proxyReq.FollowRedirects)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(checker.ProxyResponse{
				Status:    200,
				Latency:   42,
				Region:    "cn-hangzhou",
				Body:      "OK",
				Headers:   map[string]string{"Server": "nginx"},
				Timestamp: 1700000000000,
			})
		}))
		defer proxy.Close()

		res, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:             "https://openstat.us",
			Method:          http.MethodGet,
			Timeout:         30000,
			FollowRedirects: true,
			ProxyURL:        proxy.URL,
			Headers: []struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}{{Key: "Test", Value: "Value"}},
			ProxyHeaders: []struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}{{Key: "X-Proxy-Token", Value: "secret"}},
		})

		require.NoError(t, err)
		assert.Equal(t, 200, res.Status)
		assert.Equal(t, int64(42), res.Latency)
		assert.Equal(t, "cn-hangzhou", res.Region)
		assert.Equal(t, "OK", res.Body)
		assert.Equal(t, "nginx", res.Headers["Server"])
		assert.Equal(t, int64(1700000000000), res.Timestamp)
	})

	t.Run("POST without Content-Type defaults to application/json like the direct checker", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var proxyReq checker.ProxyRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&proxyReq))
			assert.Equal(t, "application/json", proxyReq.Headers["Content-Type"])
			assert.Equal(t, `{"hello":"world"}`, proxyReq.Body)
			assert.Empty(t, proxyReq.BodyEncoding)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(checker.ProxyResponse{Status: 200, Latency: 1})
		}))
		defer proxy.Close()

		_, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:      "https://openstat.us",
			Method:   http.MethodPost,
			Body:     `{"hello":"world"}`,
			ProxyURL: proxy.URL,
		})

		require.NoError(t, err)
	})

	t.Run("binary data URL body is shipped as base64 like the direct checker decodes it", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var proxyReq checker.ProxyRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&proxyReq))
			assert.Equal(t, "base64", proxyReq.BodyEncoding)

			decoded, err := base64.StdEncoding.DecodeString(proxyReq.Body)
			require.NoError(t, err)
			assert.Equal(t, []byte("binary-payload"), decoded)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(checker.ProxyResponse{Status: 200, Latency: 1})
		}))
		defer proxy.Close()

		dataURL := "data:application/octet-stream;base64," +
			base64.StdEncoding.EncodeToString([]byte("binary-payload"))

		_, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:      "https://openstat.us",
			Method:   http.MethodPost,
			Body:     dataURL,
			ProxyURL: proxy.URL,
			Headers: []struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}{{Key: "Content-Type", Value: "application/octet-stream"}},
		})

		require.NoError(t, err)
	})

	t.Run("target unreachable from the proxy is not a proxy error", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(checker.ProxyResponse{
				Error:   "Timeout after 30000 ms",
				Latency: 30000,
			})
		}))
		defer proxy.Close()

		res, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:      "https://openstat.us",
			Method:   http.MethodGet,
			ProxyURL: proxy.URL,
		})

		require.NoError(t, err)
		assert.Equal(t, 0, res.Status)
		assert.Equal(t, "Timeout after 30000 ms", res.Error)
		assert.Equal(t, int64(30000), res.Latency)
	})

	t.Run("proxy failure returns an error", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		}))
		defer proxy.Close()

		_, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:      "https://openstat.us",
			Method:   http.MethodGet,
			ProxyURL: proxy.URL,
		})

		assert.Error(t, err)
	})

	t.Run("missing status in the proxy response returns an error", func(t *testing.T) {
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(checker.ProxyResponse{Latency: 42})
		}))
		defer proxy.Close()

		_, err := checker.HttpViaProxy(context.Background(), proxy.Client(), request.HttpCheckerRequest{
			URL:      "https://openstat.us",
			Method:   http.MethodGet,
			ProxyURL: proxy.URL,
		})

		assert.Error(t, err)
	})
}
