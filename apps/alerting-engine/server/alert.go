package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

type monitorStatus string

const (
	MonitorStatusActive   monitorStatus = "active"
	MonitorStatusDegraded monitorStatus = "degraded"
	MonitorStatusError    monitorStatus = "error"
)

type payload struct {
	MonitorID     string        `json:"monitorId"`
	Message       string        `json:"message"`
	StatusCode    int           `json:"statusCode"`
	Region        string        `json:"region"`
	CronTimeStamp int64         `json:"cronTimestamp"`
	Status        monitorStatus `json:"status"`
}

type monitorStatusDb struct {
	MonitorId string `db:"monitor_id"`
	Region    string `db:"region"`
	Status    string `db:"status"`
}

func (s *Server) IngestAlert(c *gin.Context) {
	ctx := c.Request.Context()

	var req payload
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	//  Stream to CH
	if err := s.tb.SendEvent(ctx, req, "dataSourceName"); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
	}

	db:= s.db.GetInstance()
	insertOrUpdateMonitorStatus( db,
		monitorStatusDb{
			MonitorId: req.MonitorID,
			Region:    req.Region,
			Status:    string(req.Status),
		},
	)

	// 	Update monitor status

	// 	Incident engine

	// We ingest the alert let's do the thing
}



func  insertOrUpdateMonitorStatus(db *sqlx.DB, m monitorStatusDb) error {

	tx:= db.MustBegin()
	_, err := tx.NamedExec("INSERT INTO monitor_status (monitor_id, region, status) VALUES(:monitor_id, :region, :status) ON CONFLICT DO UPDATE SET (status = :status)", m)
	if err != nil {
		log.Error().Msg("Can't run ")
		return err
	}
	err = tx.Commit()
	if err!= nil {
		log.Error().Msg("Something went wrong")
		return err
	}

	return nil
}
