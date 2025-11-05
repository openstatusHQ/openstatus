package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/health", s.healthHandler)



	return r
}


func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {

	render.JSON(w, r, map[string]any{
		"status": "ok",
	})
	render.Status(r, http.StatusOK)
}
