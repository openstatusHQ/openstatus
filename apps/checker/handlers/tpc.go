package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
)

func (h Handler) TCPHandler (c *gin.Context) {
		err := checker.PingTcp(60, "www.openstatus.dev:80")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
