package server

import (
	"net/http"
	"os"
	"time"

		_ "github.com/joho/godotenv/autoload"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jmoiron/sqlx"
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

	tinyBirdToken := os.Getenv("TINYBIRD_TOKEN")


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


// healthHandler responds with the health status of the server.
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {

	render.JSON(w, r, map[string]any{
		"status": "ok",
	})
	render.Status(r, http.StatusOK)
}
