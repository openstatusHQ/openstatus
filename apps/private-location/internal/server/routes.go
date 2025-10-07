package server

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// JobType represents the type of job for a monitor.
type JobType string

const (
	JobTypeTCP  JobType = "tcp"
	JobTypeUDP  JobType = "udp"
	JobTypeHTTP JobType = "http"
	JobTypeDNS  JobType = "dns"
)

// Monitor represents a monitoring job.
type Monitor struct {
	ID              int            `db:"id"`
	Active          bool           `db:"active"`
	WorkspaceID     int            `db:"workspace_id"`
	JobType         JobType        `db:"job_type"`
	Periodicity     string         `db:"periodicity"`
	URL             string         `db:"url"`
	Headers         string         `db:"headers"`
	Body            string         `db:"body"`
	Method          string         `db:"method"`
	Timeout         int            `db:"timeout"`
	DegradedAfter   sql.NullInt64  `db:"degraded_after"`
	Assertions      sql.NullString `db:"assertions"`
	Retry           int            `db:"retry"`
	FollowRedirects bool           `db:"follow_redirects"`
	OtelEndpoint    sql.NullString `db:"otel_endpoint" json:"-"`
	OtelHeaders     sql.NullString `db:"otel_headers" json:"-"`
	Name            string         `db:"name" json:"-"`
	Description     string         `db:"description" json:"-"`
	CreatedAt       int            `db:"created_at" json:"-"`
	UpdatedAt       int            `db:"updated_at" json:"-"`
	DeletedAt       sql.NullInt64  `db:"deleted_at" json:"-"`
	Regions         string         `db:"regions" json:"-"`
	Status          string         `db:"status" json:"-"`
	Public          bool           `db:"public" json:"-"`
}

// RegisterRoutes sets up the HTTP routes for the server.
func (s *Server) RegisterRoutes() http.Handler {
	r := gin.Default()
	r.GET("/health", s.healthHandler)
	r.GET("/monitors", s.GetMonitors)
	return r
}

// GetMonitors handles GET requests for monitors.
func (s *Server) GetMonitors(c *gin.Context) {

	token := c.GetHeader("openstatus-token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}
	var monitors []Monitor
	subQuery := fmt.Sprintf(
		"SELECT a.monitor_id FROM private_location_to_monitor AS a, private_location AS b WHERE a.private_location_id = b.id AND b.key='%s'",
		token,
	)
	query := fmt.Sprintf(
		"SELECT * FROM monitor WHERE id IN (%s) AND deleted_at IS NULL",
		subQuery,
	)
	err := s.db.Select(&monitors, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, monitors)
}

// healthHandler responds with the health status of the server.
func (s *Server) healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
