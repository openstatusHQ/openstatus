package handlers

import (
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
)

type Handler struct {
	TbClient      tinybird.Client
	Secret        string
	CloudProvider string
	Region        string
}

// Authorization could be handle by middleware
