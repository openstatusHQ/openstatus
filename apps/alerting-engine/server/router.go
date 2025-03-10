package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (s *Server) RegisterRoutes() http.Handler {

	r := gin.Default()

	r.GET("/health", s.healthHandler)
	r.GET("/alert", s.IngestAlert)
	r.POST("/notification/{provider}/test", s.NotificationTester)

	return r
}

func (s *Server) healthHandler(c *gin.Context) {

	db:= s.db.GetInstance()
	if db == nil {
		c.JSON(http.StatusInternalServerError,gin.H{"Error":"No DB"})
	}


	result := struct {
		Count int `db:"count"`
	}{}

	s.db.GetInstance().Get(&result, "SELECT count(*) as count FROM user")

	c.JSON(http.StatusOK, gin.H{"message": "pong", "user":result.Count})
}
