package main

import (
	"context"
	"log"
	"net/http"

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

	// Start the server
	log.Fatal(http.ListenAndServe(":3002", api.Router()))
}