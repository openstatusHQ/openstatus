package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	"github.com/openstatushq/openstatus/apps/private-location/internal/logs"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	v1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	eventKey     contextKey = "event"
)

// responseWriter wraps http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if rw.status == 0 {
		rw.status = http.StatusOK
	}
	return rw.ResponseWriter.Write(b)
}

// Logger returns a Chi middleware that logs request details
func Logger() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			startTime := time.Now()

			// Generate or get request ID
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Build wide event context at request start
			event := map[string]any{
				"timestamp":    startTime.Format(time.RFC3339),
				"request_id":   requestID,
				"method":       r.Method,
				"path":         r.URL.Path,
				"url":          r.Host + r.URL.String(),
				"user_agent":   r.Header.Get("User-Agent"),
				"content_type": r.Header.Get("Content-Type"),
			}

			// Store in context
			ctx := context.WithValue(r.Context(), requestIDKey, requestID)
			ctx = context.WithValue(ctx, eventKey, event)
			r = r.WithContext(ctx)

			// Wrap response writer to capture status code
			wrapped := &responseWriter{ResponseWriter: w, status: 0}

			// Process request
			next.ServeHTTP(wrapped, r)

			// After request - capture response details
			duration := time.Since(startTime).Milliseconds()
			status := wrapped.status
			if status == 0 {
				status = http.StatusOK
			}

			event["status_code"] = status
			event["duration_ms"] = duration

			if status >= 400 {
				event["outcome"] = "error"
			} else {
				event["outcome"] = "success"
			}

			if logs.ShouldSample(event) {
				attrs := logs.MapToAttrs(event)
				slog.LogAttrs(r.Context(), slog.LevelInfo, "request done", attrs...)
			}
		})
	}
}

// GetRequestID retrieves the request ID from context
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

// GetEvent retrieves the event map from context
func GetEvent(ctx context.Context) map[string]any {
	if event, ok := ctx.Value(eventKey).(map[string]any); ok {
		return event
	}
	return nil
}

type privateLocationHandler struct {
	db       *sqlx.DB
	TbClient tinybird.Client
}

func NewPrivateLocationServer(db *sqlx.DB, tbClient tinybird.Client) *privateLocationHandler {
	return &privateLocationHandler{
		db:       db,
		TbClient: tbClient,
	}
}

// RegisterRoutes sets up the HTTP routes for the server.
func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()

	r.Use(Logger())

	r.Get("/health", s.healthHandler)

	tinyBirdToken := os.Getenv("TINYBIRD_TOKEN")

	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	tinybirdClient := tinybird.NewClient(httpClient, tinyBirdToken)

	privateLocationServer := NewPrivateLocationServer(s.db, tinybirdClient)
	path, handler := v1.NewPrivateLocationServiceHandler(privateLocationServer)

	r.Group(func(r chi.Router) {
		r.Mount(path, handler)
	})
	return r
}

// healthHandler responds with the health status of the server.
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {

	render.JSON(w, r, map[string]any{
		"status": "ok",
	})
	render.Status(r, http.StatusOK)
}
