package db

import (
	"fmt"
	"log"

	"github.com/jmoiron/sqlx"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

type Database struct {
	db *sqlx.DB
}

var (
	dbInstance *Database
)

func New(database string, token string) *Database {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}
	connStr := fmt.Sprintf("%s?authToken=%s", database, token)
	fmt.Println(connStr)
	db, err := sqlx.Connect("libsql", connStr)
	if err != nil {
		log.Fatal(err)
	}
	dbInstance = &Database{
		db: db,
	}
	return dbInstance
}

func (d *Database) GetInstance() *sqlx.DB {
	if dbInstance.db == nil {
		return nil
	}
	return dbInstance.db
}
func (d *Database) Health() int {

	result := struct {
		Count int `db:"count"`
	}{}

	d.db.Get(&result, "SELECT count(*) as count FROM user")
	return result.Count
}
