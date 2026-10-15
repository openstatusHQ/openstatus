package database

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	_ "github.com/tursodatabase/go-libsql"
)

const (
	// Bound the pool so bursts of concurrent ingests can't open an unbounded
	// number of remote libSQL connections (see #2861).
	maxOpenConns    = 16
	maxIdleConns    = 16
	connMaxIdleTime = time.Minute
)

var (
	dbUrl      = os.Getenv("DB_URL")
	authToken  = os.Getenv("DB_AUTH_TOKEN")
	dbInstance *sqlx.DB
)

// New returns a database connection, reusing an existing connection if available.
func New() *sqlx.DB {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}

	db, err := Open(dbUrl, authToken)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open db %s: %s", dbUrl, err)
		os.Exit(1)
	}
	dbInstance = db

	return db
}

// Open opens a libSQL database with a bounded connection pool.
// dsn can be a remote URL (libsql://, http://, https://) or a local file: URL.
func Open(dsn string, token string) (*sqlx.DB, error) {
	if token != "" {
		u, err := url.Parse(dsn)
		if err != nil {
			return nil, err
		}
		q := u.Query()
		q.Set("authToken", token)
		u.RawQuery = q.Encode()
		dsn = u.String()
	}

	c, err := sql.Open("libsql", dsn)
	if err != nil {
		return nil, err
	}
	c.SetMaxOpenConns(maxOpenConns)
	c.SetMaxIdleConns(maxIdleConns)
	c.SetConnMaxIdleTime(connMaxIdleTime)

	return sqlx.NewDb(c, "sqlite3"), nil
}

// Close closes the database connection.
func Close() error {
	if dbInstance != nil {
		err := dbInstance.Close()
		dbInstance = nil
		return err
	}
	return nil
}
