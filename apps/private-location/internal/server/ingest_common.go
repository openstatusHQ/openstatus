package server

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
)

// dbTimeout bounds how long a single query waits for a pooled connection and runs.
const dbTimeout = 5 * time.Second

// ingestContext holds common data needed for ingestion
type ingestContext struct {
	Monitor database.Monitor
	Region  database.PrivateLocation
}

// getIngestContext retrieves monitor and private location data for ingestion
func (h *privateLocationHandler) getIngestContext(ctx context.Context, token string, monitorID string) (*ingestContext, error) {
	monitorCtx, cancelMonitor := context.WithTimeout(ctx, dbTimeout)
	defer cancelMonitor()

	var monitor database.Monitor
	err := h.db.GetContext(monitorCtx, &monitor, "SELECT monitor.id, monitor.workspace_id, monitor.url, monitor.method, monitor.assertions FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.token = ? AND monitor.deleted_at IS NULL and monitor.id = ?", token, monitorID)
	if err != nil {
		if holder := GetEvent(ctx); holder != nil {
			holder.Event["error"] = map[string]any{
				"message": err.Error(),
				"source":  "database",
				"type":    "monitor_lookup",
			}
		}
		if errors.Is(err, sql.ErrNoRows) {
			return nil, h.classifyLookupMiss(ctx, token)
		}
		return nil, err
	}

	regionCtx, cancelRegion := context.WithTimeout(ctx, dbTimeout)
	defer cancelRegion()

	var region database.PrivateLocation
	err = h.db.GetContext(regionCtx, &region, "SELECT private_location.id FROM private_location join private_location_to_monitor a ON private_location.id = a.private_location_id WHERE a.monitor_id = ? AND private_location.token = ?", monitor.ID, token)
	if err != nil {
		if holder := GetEvent(ctx); holder != nil {
			holder.Event["error"] = map[string]any{
				"message": err.Error(),
				"source":  "database",
				"type":    "private_location_lookup",
			}
		}
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMonitorNotFound
		}
		return nil, err
	}

	return &ingestContext{
		Monitor: monitor,
		Region:  region,
	}, nil
}

// classifyLookupMiss tells an unknown token apart from a monitor that is no
// longer linked to the private location. The token is checked on its own only
// here, because private_location.token is not unique and a token-only lookup
// could pick the wrong location while the joined lookup still matches.
func (h *privateLocationHandler) classifyLookupMiss(ctx context.Context, token string) error {
	tokenCtx, cancelToken := context.WithTimeout(ctx, dbTimeout)
	defer cancelToken()

	var id int
	err := h.db.GetContext(tokenCtx, &id, "SELECT id FROM private_location WHERE token = ?", token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrPrivateLocationNotFound
		}
		return err
	}
	return ErrMonitorNotFound
}

// ingestError maps a failed ingest lookup to a client error. A missing private
// location or monitor is a not-found condition, not a server fault: a 500 here
// hides real database failures behind a constant 5xx rate.
func ingestError(err error) error {
	switch {
	case errors.Is(err, ErrPrivateLocationNotFound):
		return connect.NewError(connect.CodeUnauthenticated, err)
	case errors.Is(err, ErrMonitorNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}

// sendEventAndUpdateLastSeen sends the event to Tinybird and updates the last_seen_at timestamp
func (h *privateLocationHandler) sendEventAndUpdateLastSeen(ctx context.Context, data any, dataSourceName string, regionID int) {
	start := time.Now()
	err := h.TbClient.SendEvent(ctx, data, dataSourceName)
	duration := time.Since(start).Milliseconds()

	// Enrich wide event with Tinybird operation context
	if holder := GetEvent(ctx); holder != nil {
		holder.Event["tinybird"] = map[string]any{
			"datasource":  dataSourceName,
			"duration_ms": duration,
			"success":     err == nil,
		}
		if err != nil {
			holder.Event["error"] = map[string]any{
				"message": err.Error(),
				"source":  "tinybird",
			}
		}
	}

	// Detached from the request so a cancelled probe still records last_seen_at.
	dbCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), dbTimeout)
	defer cancel()
	_, dbErr := h.db.NamedExecContext(dbCtx, "UPDATE private_location SET last_seen_at = :last_seen_at WHERE id = :id", map[string]any{
		"last_seen_at": time.Now().Unix(),
		"id":           regionID,
	})
	if dbErr != nil {
		if holder := GetEvent(ctx); holder != nil {
			holder.Event["db_update_error"] = map[string]any{
				"message": dbErr.Error(),
				"type":    "last_seen_update",
			}
		}
	}
}
