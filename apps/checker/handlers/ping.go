package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type PingResponse struct {
	Body        string `json:"body,omitempty"`
	Headers     string `json:"headers,omitempty"`
	Region      string `json:"region"`
	Timing      string `json:"timing,omitempty"`
	RequestId   int64  `json:"requestId,omitempty"`
	WorkspaceId int64  `json:"workspaceId,omitempty"`
	Latency     int64  `json:"latency"`
	Timestamp   int64  `json:"timestamp"`
	StatusCode  int    `json:"statusCode,omitempty"`
}

type Response struct {
	Headers     map[string]string `json:"headers,omitempty"`
	Error       string            `json:"error,omitempty"`
	Body        string            `json:"body,omitempty"`
	Region      string            `json:"region"`
	Tags        []string          `json:"tags,omitempty"`
	RequestId   int64             `json:"requestId,omitempty"`
	WorkspaceId int64             `json:"workspaceId,omitempty"`
	Latency     int64             `json:"latency"`
	Timestamp   int64             `json:"timestamp"`
	Timing      checker.Timing    `json:"timing"`
	Status      int               `json:"status,omitempty"`
}

func (h Handler) PingRegionHandler(c *gin.Context) {
	ctx := c.Request.Context()

	dataSourceName := "check_response_http__v0"
	region := c.Param("region")

	if region == "" {
		c.String(http.StatusBadRequest, "region is required")

		return
	}

	fmt.Printf("Start of /ping/%s\n", region)

	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})

		return
	}

	if h.CloudProvider == "fly" {
		if region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)

			return
		}
	}

	//  We need a new client for each request to avoid connection reuse.
	requestClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer requestClient.CloseIdleConnections()

	var req request.PingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	var res checker.Response

	op := func() error {

		headers := make([]struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}, 0)

		for key, value := range req.Headers {
			headers = append(headers, struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}{Key: key, Value: value})
		}

		input := request.HttpCheckerRequest{
			Headers: headers,
			URL:     req.URL,
			Method:  req.Method,
			Body:    req.Body,
		}

		r, err := checker.Http(c.Request.Context(), requestClient, input)

		if err != nil {
			return fmt.Errorf("unable to ping: %w", err)
		}

		timingAsString, err := json.Marshal(r.Timing)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URL, err)
		}

		headersAsString, err := json.Marshal(r.Headers)
		if err != nil {
			return nil
		}

		tbData := PingResponse{
			RequestId:   req.RequestId,
			WorkspaceId: req.WorkspaceId,
			StatusCode:  r.Status,
			Latency:     r.Latency,
			Body:        r.Body,
			Headers:     string(headersAsString),
			Timestamp:   r.Timestamp,
			Timing:      string(timingAsString),
			Region:      h.Region,
		}

		res = r
		res.Region = h.Region

		if tbData.RequestId != 0 {
			if err := h.TbClient.SendEvent(ctx, tbData, dataSourceName); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}
		}

		return nil
	}
	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	c.JSON(http.StatusOK, res)
}
