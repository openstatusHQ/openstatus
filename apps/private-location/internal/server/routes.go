package server

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jmoiron/sqlx"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	v1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// JobType represents the type of job for a monitor.
type JobType string

const (
	JobTypeTCP  JobType = "tcp"
	JobTypeUDP  JobType = "udp"
	JobTypeHTTP JobType = "http"
	JobTypeDNS  JobType = "dns"
)

// Monitor represents a monitoring job.
type Monitor struct {
	ID              int            `db:"id"`
	Active          bool           `db:"active"`
	WorkspaceID     int            `db:"workspace_id"`
	JobType         JobType        `db:"job_type"`
	Periodicity     string         `db:"periodicity"`
	URL             string         `db:"url"`
	Headers         string         `db:"headers"`
	Body            string         `db:"body"`
	Method          string         `db:"method"`
	Timeout         int64            `db:"timeout"`
	DegradedAfter   sql.NullInt64  `db:"degraded_after"`
	Assertions      sql.NullString `db:"assertions"`
	Retry           int            `db:"retry"`
	FollowRedirects bool           `db:"follow_redirects"`
	OtelEndpoint    sql.NullString `db:"otel_endpoint" json:"-"`
	OtelHeaders     sql.NullString `db:"otel_headers" json:"-"`
	Name            string         `db:"name" json:"-"`
	Description     string         `db:"description" json:"-"`
	CreatedAt       int            `db:"created_at" json:"-"`
	UpdatedAt       int            `db:"updated_at" json:"-"`
	DeletedAt       sql.NullInt64  `db:"deleted_at" json:"-"`
	Regions         string         `db:"regions" json:"-"`
	Status          string         `db:"status" json:"-"`
	Public          bool           `db:"public" json:"-"`
}

type privateLocationHandler struct {
	db *sqlx.DB
}

func NewPrivateLocationServer() *privateLocationHandler {
	return &privateLocationHandler{
		db: database.New(),
	}
}

// RegisterRoutes sets up the HTTP routes for the server.
func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/health", s.healthHandler)
	privateLocationServer := NewPrivateLocationServer()
	path, handler := v1.NewPrivateLocationServiceHandler(privateLocationServer)


	r.Group(func(r chi.Router) {
		r.Mount(path, handler)
	})
	return r
}

// Not use using connectrpc now
// GetMonitors handles GET requests for monitors.
func (s *Server) GetMonitors(w http.ResponseWriter, r *http.Request) {

	token := r.Header.Get("openstatus-token")
	if token == "" {

		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	var monitors []Monitor
	err := s.db.Select(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.key = ? AND monitor.deleted_at IS NULL", token)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	render.JSON(w, r, monitors)
	render.Status(r, http.StatusOK)
}

// healthHandler responds with the health status of the server.
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {

	render.JSON(w, r, map[string]any{
		"status": "ok",
	})
	render.Status(r, http.StatusOK)
}
