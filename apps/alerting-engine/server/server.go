package server

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/openstatusHQ/openstatus/apps/alerting-engine/pkg/db"
	"github.com/openstatusHQ/openstatus/apps/alerting-engine/pkg/tinybird"
)

type Server struct {
	port int

	db db.Database
	tb  tinybird.Client
}

func NewServer() *http.Server {
	database   := os.Getenv("TURSO_URL")
	token      := os.Getenv("TURSO_AUTH_TOKEN")
	tbKey := os.Getenv("TINYBIRD_KEY")
	port, _ := strconv.Atoi(os.Getenv("PORT"))

	// packages.
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer httpClient.CloseIdleConnections()


	NewServer := &Server{
		port: port,
		db: *db.New(database,token),
		tb: tinybird.NewClient(httpClient, tbKey),
	}

	// Declare Server config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", NewServer.port),
		Handler:      NewServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return server
}
