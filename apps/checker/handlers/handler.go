package handlers

import (
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
)

type Handler struct {
	Secret        string
	CloudProvider string
	Region        string
	TbClient      tinybird.Client
}

// Authorization could be handle by middleware
