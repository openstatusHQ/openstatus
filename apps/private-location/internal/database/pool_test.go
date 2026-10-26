package database

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
)

// fakeHrana is a minimal libSQL remote server: it answers SELECT 1 for any
// statement and tracks streams so tests can see what the pool holds open.
type fakeHrana struct {
	// stall, when set, blocks every statement until it is closed or the client
	// gives up on the request.
	stall chan struct{}
	delay time.Duration

	mu         sync.Mutex
	nextStream int
	open       map[string]bool

	inFlight    atomic.Int32
	maxInFlight atomic.Int32
	statements  atomic.Int32
}

func newFakeHrana(t *testing.T, f *fakeHrana) *sqlx.DB {
	t.Helper()
	f.open = map[string]bool{}
	server := httptest.NewServer(f)
	t.Cleanup(server.Close)

	db, err := Open(server.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	return db
}

func (f *fakeHrana) openStreams() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return len(f.open)
}

func (f *fakeHrana) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Baton    *string `json:"baton"`
		Requests []struct {
			Type string `json:"type"`
		} `json:"requests"`
		Batch json.RawMessage `json:"batch"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	f.mu.Lock()
	var baton string
	if request.Baton == nil {
		f.nextStream++
		baton = fmt.Sprintf("stream-%d", f.nextStream)
		f.open[baton] = true
	} else {
		baton = *request.Baton
	}
	f.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")

	if len(request.Requests) == 1 && request.Requests[0].Type == "close" {
		f.mu.Lock()
		delete(f.open, baton)
		f.mu.Unlock()
		fmt.Fprint(w, `{"baton":null,"base_url":null,"results":[{"type":"ok","response":{"type":"close"}}]}`)
		return
	}

	inFlight := f.inFlight.Add(1)
	defer f.inFlight.Add(-1)
	for {
		seen := f.maxInFlight.Load()
		if inFlight <= seen || f.maxInFlight.CompareAndSwap(seen, inFlight) {
			break
		}
	}

	if f.stall != nil {
		select {
		case <-f.stall:
		case <-r.Context().Done():
			return
		}
	}
	if f.delay > 0 {
		time.Sleep(f.delay)
	}

	if len(request.Batch) > 0 {
		f.statements.Add(1)
		fmt.Fprintf(w, "{\"baton\":%q,\"base_url\":null}\n", baton)
		fmt.Fprintln(w, `{"type":"step_begin","step":0,"cols":[{"name":"1","decltype":null}]}`)
		fmt.Fprintln(w, `{"type":"row","row":[{"type":"integer","value":"1"}]}`)
		fmt.Fprintln(w, `{"type":"step_end","affected_row_count":0,"last_insert_rowid":null}`)
		fmt.Fprintln(w, `{"type":"replication_index","replication_index":null}`)
		return
	}
	if len(request.Requests) == 1 && request.Requests[0].Type == "describe" {
		fmt.Fprintf(w, `{"baton":%q,"base_url":null,"results":[{"type":"ok","response":{"type":"describe","result":{"params":[],"cols":[{"name":"1","decltype":null}],"is_explain":false,"is_readonly":true}}}]}`, baton)
		return
	}
	http.Error(w, "unexpected Hrana request", http.StatusBadRequest)
}

func waitFor(t *testing.T, msg string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal(msg)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestPoolNeverExceedsMaxOpenConns(t *testing.T) {
	hrana := &fakeHrana{delay: 20 * time.Millisecond}
	db := newFakeHrana(t, hrana)

	const burst = 4 * maxOpenConns
	errs := make(chan error, burst)
	var wg sync.WaitGroup
	for range burst {
		wg.Go(func() {
			var value int
			errs <- db.GetContext(context.Background(), &value, "SELECT 1")
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("query in burst: %v", err)
		}
	}

	if got := hrana.maxInFlight.Load(); got > maxOpenConns {
		t.Fatalf("server saw %d concurrent statements, want at most %d", got, maxOpenConns)
	}
	if got := db.Stats().InUse; got != 0 {
		t.Fatalf("%d connections still in use after the burst", got)
	}
}

func TestPoolDoesNotLeakRemoteStreams(t *testing.T) {
	hrana := &fakeHrana{}
	db := newFakeHrana(t, hrana)

	for range 3 * maxOpenConns {
		var value int
		if err := db.GetContext(context.Background(), &value, "SELECT 1"); err != nil {
			t.Fatal(err)
		}
	}

	// Remote connections are never kept idle, so each stream must be closed on
	// the server once its query is done.
	waitFor(t, fmt.Sprintf("%d remote streams left open", hrana.openStreams()), func() bool {
		return hrana.openStreams() == 0
	})
	if got := db.Stats().OpenConnections; got != 0 {
		t.Fatalf("%d connections still open, want 0", got)
	}
}

// stalledHrana returns a server that holds every statement until the test ends.
func stalledHrana(t *testing.T) (*fakeHrana, *sqlx.DB) {
	t.Helper()
	hrana := &fakeHrana{stall: make(chan struct{})}
	db := newFakeHrana(t, hrana)
	// Registered last so it runs first: unblock the server before it and the
	// pool are closed.
	t.Cleanup(func() { close(hrana.stall) })

	return hrana, db
}

// The ingest handlers bound every query with dbTimeout. If a timed-out query
// keeps its connection, a slow libSQL server drains the pool within a few
// requests and every later ingest fails waiting for a connection.
func TestPoolReleasesConnectionsWhenQueriesTimeOut(t *testing.T) {
	t.Skip("go-libsql ignores ctx in QueryContext/ExecContext: a stalled remote query holds its connection until the server answers")
	_, db := stalledHrana(t)

	returned := make(chan error, maxOpenConns)
	for range maxOpenConns {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()
			var value int
			returned <- db.GetContext(ctx, &value, "SELECT 1")
		}()
	}

	timeout := time.After(2 * time.Second)
	for range maxOpenConns {
		select {
		case err := <-returned:
			if !errors.Is(err, context.DeadlineExceeded) {
				t.Fatalf("stalled query returned %v, want deadline exceeded", err)
			}
		case <-timeout:
			t.Fatalf("queries ignored their 100ms deadline: %d of %d connections held by a stalled server", db.Stats().InUse, maxOpenConns)
		}
	}

	waitFor(t, fmt.Sprintf("%d connections still in use after their queries timed out", db.Stats().InUse), func() bool {
		return db.Stats().InUse == 0
	})
}

func TestPoolWaitIsBoundedByContext(t *testing.T) {
	_, db := stalledHrana(t)

	for range maxOpenConns {
		go func() {
			var value int
			_ = db.GetContext(context.Background(), &value, "SELECT 1")
		}()
	}
	waitFor(t, "pool never filled", func() bool { return db.Stats().InUse == maxOpenConns })

	// With every connection busy, a caller must fail on its own deadline rather
	// than queue forever behind them.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	var value int
	err := db.GetContext(ctx, &value, "SELECT 1")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("query on an exhausted pool returned %v, want deadline exceeded", err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("query on an exhausted pool waited %s", elapsed)
	}
	if db.Stats().WaitCount == 0 {
		t.Fatal("expected the query to wait for a connection")
	}
}
