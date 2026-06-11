package models

import (
	"time"
)

// PrivateLocation represents a private location
type PrivateLocation struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Region      string    `json:"region"`
	Country     string    `json:"country"`
	City        string    `json:"city"`
	Provider    string    `json:"provider"`
	IPAddress   string    `json:"ip_address"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}