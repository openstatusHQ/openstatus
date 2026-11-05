package database

import (
	"encoding/json"
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
	expired    map[string]bool

	inFlight    atomic.Int32
	maxInFlight atomic.Int32
	statements  atomic.Int32
}

func newFakeHrana(t *testing.T, f *fakeHrana) *sqlx.DB {
	t.Helper()
	f.open = map[string]bool{}
	f.expired = map[string]bool{}
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

// expireStreams makes the server reject every stream opened so far, as libSQL
// does once a stream sits idle too long.
func (f *fakeHrana) expireStreams() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := 1; i <= f.nextStream; i++ {
		f.expired[fmt.Sprintf("stream-%d", i)] = true
	}
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
	expired := f.expired[baton]
	f.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")

	if expired {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, `{"message":"The stream has expired due to inactivity","code":"STREAM_EXPIRED"}`)
		return
	}

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
