package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", secret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func FlyRegionMiddleware(cloudProvider, localRegion string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cloudProvider == "fly" {
			region := c.GetHeader("fly-prefer-region")
			if region != "" && region != localRegion {
				c.Header("fly-replay", fmt.Sprintf("region=%s", region))
				c.String(http.StatusAccepted, "Forwarding request to %s", region)
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
