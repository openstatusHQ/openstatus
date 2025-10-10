package server

import (
	// "database/sql"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"

	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
)

type Server struct {
	port int

	db *sqlx.DB
}

func NewServer() *http.Server {
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	NewServer := &Server{
		port: port,

		db: database.New(),
	}

	// Declare Server config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", NewServer.port),
		Handler:      NewServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return server
}
