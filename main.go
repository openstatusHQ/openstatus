package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/openstatushq/openstatus/pkg/api"
	"github.com/openstatushq/openstatus/pkg/repositories"
	"github.com/openstatushq/openstatus/pkg/services"
	"github.com/openstatushq/openstatus/pkg/sql"
)

func main() {
	// Initialize the database connection
	db, err := sql.NewDatabaseConnection()
	if err != nil {
		log.Fatal(err)
	}

	// Initialize the private locations repository
	privateLocationsRepository := repositories.NewPrivateLocationsRepository(db)

	// Initialize the private locations service
	privateLocationsService := services.NewPrivateLocationsService(privateLocationsRepository)

	// Initialize the API
	api := api.NewAPI(privateLocationsService)

	// Port is configurable via environment variable
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}

	// Server with explicit timeouts to prevent resource exhaustion
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      api.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Starting server on :%s", port)
	log.Fatal(srv.ListenAndServe())

	_ = context.Background() // retained for future middleware use
}
