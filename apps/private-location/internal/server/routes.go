package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (s *Server) RegisterRoutes() http.Handler {
	r := gin.Default()



	r.GET("/health", s.healthHandler)

	// When a private region is launched
	r.GET("/register", s.HelloWorldHandler)
	// To get monitor associated with private region
	r.GET("/monitors",s.HelloWorldHandler)
	// to send data to TB
	r.POST("/ingest", s.HelloWorldHandler)
	return r
}

func (s *Server) HelloWorldHandler(c *gin.Context) {
	resp := make(map[string]string)
	resp["message"] = "Hello World"


	c.JSON(http.StatusOK, resp)
}

func (s *Server) healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK,map[string]string{
		"status": "ok",
	})
}
