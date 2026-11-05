package database

import (
	"path/filepath"
	"testing"
)

func TestOpenRemoteDoesNotReuseExpiredStreams(t *testing.T) {
	hrana := &fakeHrana{}
	db := newFakeHrana(t, hrana)

	var value int
	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if value != 1 {
		t.Fatalf("first query returned %d, want 1", value)
	}

	// Expire existing streams without a wall-clock delay.
	hrana.expireStreams()

	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatalf("query after stream expiry: %v", err)
	}
	if value != 1 {
		t.Fatalf("second query returned %d, want 1", value)
	}
	if got := db.Stats().MaxOpenConnections; got != maxOpenConns {
		t.Fatalf("max open connections = %d, want %d", got, maxOpenConns)
	}
}

func TestOpenLocalRetainsIdleConnections(t *testing.T) {
	db, err := Open("file:"+filepath.Join(t.TempDir(), "pool.db"), "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var value int
	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if db.Stats().Idle == 0 {
		t.Fatal("local database should retain an idle connection")
	}
}
