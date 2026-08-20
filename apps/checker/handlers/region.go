package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// requestedRegion is the region the caller asked the check to run in. The query
// parameter is authoritative: fly-prefer-region is consumed by fly-proxy, which
// silently falls back to the nearest healthy region, so a request landing here
// is no proof this is the region that was asked for.
func requestedRegion(c *gin.Context) string {
	if region := c.Query("region"); region != "" {
		return region
	}

	if region := c.GetHeader("fly-force-region"); region != "" {
		return region
	}

	return c.GetHeader("fly-prefer-region")
}

// serveRegion reports whether this machine may run the check. A misrouted
// request is replayed to the region the caller asked for; once the proxy tells
// us the replay itself failed we refuse the request, because running it here
// would store the check under a region the user never selected.
func (h Handler) serveRegion(c *gin.Context, region string) bool {
	if region == "" || region == h.Region {
		return true
	}

	replayFailed := c.GetHeader("fly-replay-failed")

	if h.CloudProvider != "fly" {
		// Koyeb and Railway have no replay mechanism, and their region strings
		// are not verified end to end yet: keep serving, but make it visible.
		log.Ctx(c.Request.Context()).Warn().
			Str("requested_region", region).
			Str("region", h.Region).
			Msg("check served from a region the caller did not request")

		return true
	}

	if replayFailed == "" {
		c.Header("fly-replay", fmt.Sprintf("region=%s;fallback=force_self", region))
		c.String(http.StatusAccepted, "Forwarding request to %s", region)

		return false
	}

	log.Ctx(c.Request.Context()).Error().
		Str("requested_region", region).
		Str("region", h.Region).
		Str("fly_replay_failed", replayFailed).
		Msg("check dropped: request could not be routed to the requested region")

	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error":  fmt.Sprintf("region %s is unavailable", region),
		"region": h.Region,
	})

	return false
}
