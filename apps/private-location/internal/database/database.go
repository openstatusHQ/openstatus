package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	"github.com/tursodatabase/go-libsql"
)

// Service represents a service that interacts with a database.
type Service interface {

	// Close terminates the database connection.
	// It returns an error if the connection cannot be closed.
	Close() error
}

type service struct {
	db *sqlx.DB
}

var (
	dbUrl      = os.Getenv("DB_URL")
	authToken  = os.Getenv("DB_AUTH_TOKEN")
	dbInstance *service
)

func New() Service {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}
	dbName := "local.db"
	dir, err := os.MkdirTemp("", "libsql-*")
	if err != nil {
		fmt.Println("Error creating temporary directory:", err)
		os.Exit(1)
	}
	defer os.RemoveAll(dir)

	dbPath := filepath.Join(dir, dbName)

	connector, err := libsql.NewEmbeddedReplicaConnector(dbPath, dbUrl,
		libsql.WithAuthToken(authToken),
	)

	if err != nil {
		fmt.Println("Error creating connector:", err)
		os.Exit(1)
	}
	defer connector.Close()
	c := sql.OpenDB(connector)
	// sql.OpenDB()
	db := sqlx.NewDb(c, "sqlite3")

	dbInstance = &service{
		db: db,
	}
	return dbInstance
}

func (s *service) Close() error {
	log.Printf("Disconnected from database: %s", dbUrl)
	return s.db.Close()
}
