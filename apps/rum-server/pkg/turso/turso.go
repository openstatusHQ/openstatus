package turso

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/openstatusHQ/rum-server/pkg/utils"
	"github.com/tursodatabase/go-libsql"
)

func GetClient() (*sql.DB, error) {
	dbName := "local.db"
	primaryUrl := utils.Env("DB_URL", "http://localhost:8080")
	authToken := utils.Env("AUTH_TOKEN", "")
	syncInterval := time.Minute

	dir, err := os.MkdirTemp("", "libsql-*")
	if err != nil {
		fmt.Println("Error creating temporary directory:", err)
		return nil, err
	}
	defer os.RemoveAll(dir)

	dbPath := filepath.Join(dir, dbName)

	connector, err := libsql.NewEmbeddedReplicaConnector(dbPath, primaryUrl,
		libsql.WithAuthToken(authToken),
		libsql.WithSyncInterval(syncInterval),
	)

	if err != nil {
		fmt.Println("Error creating connector:", err)
		return nil, err
	}
	defer connector.Close()

	db := sql.OpenDB(connector)
	return db, nil
}

func GetCurrentWorkspace(db *sql.DB, dsn string) (string, error) {
	var s sql.NullString
	err := db.QueryRow("SELECT id FROM workspace where dsn = ?", dsn).Scan(&s)
	if err != nil {
		return "", err
	}
	if !s.Valid {
		return "", fmt.Errorf("workspace not found")
	}
	return s.String, nil
}
