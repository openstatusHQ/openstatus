package server

import (
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jmoiron/sqlx"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	v1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// Monitor represents a monitoring job.

type privateLocationHandler struct {
	db *sqlx.DB
	TbClient      tinybird.Client
}

func NewPrivateLocationServer(db *sqlx.DB, tbClient tinybird.Client) *privateLocationHandler {
	return &privateLocationHandler{
		db: db,
		TbClient: tbClient,
	}
}

// RegisterRoutes sets up the HTTP routes for the server.
func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/health", s.healthHandler)

	tinyBirdToken := os.Getenv("tinybird-token")


	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer httpClient.CloseIdleConnections()

	tinybirdClient := tinybird.NewClient(httpClient, tinyBirdToken)

	privateLocationServer := NewPrivateLocationServer(s.db, tinybirdClient)
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
	var monitors []database.Monitor
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
