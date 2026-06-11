package api

import (
	"encoding/json"
	"net/http"

	"github.com/openstatushq/openstatus/pkg/private_locations"
)

// CreatePrivateLocationRequest represents the request body for creating a private location
type CreatePrivateLocationRequest struct {
	Name        string `json:"name"`
	Region      string `json:"region"`
	Country     string `json:"country"`
	City        string `json:"city"`
	Provider    string `json:"provider"`
	IPAddress   string `json:"ip_address"`
	Description string `json:"description"`
}

// CreatePrivateLocation creates a new private location
func (a *API) CreatePrivateLocation(w http.ResponseWriter, r *http.Request) {
	var req CreatePrivateLocationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	privateLocation := private_locations.PrivateLocation{
		Name:        req.Name,
		Region:      req.Region,
		Country:     req.Country,
		City:        req.City,
		Provider:    req.Provider,
		IPAddress:   req.IPAddress,
		Description: req.Description,
	}

	err = a.privateLocationsService.CreatePrivateLocation(privateLocation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// UpdatePrivateLocationRequest represents the request body for updating a private location
type UpdatePrivateLocationRequest struct {
	Name        string `json:"name"`
	Region      string `json:"region"`
	Country     string `json:"country"`
	City        string `json:"city"`
	Provider    string `json:"provider"`
	IPAddress   string `json:"ip_address"`
	Description string `json:"description"`
}

// UpdatePrivateLocation updates an existing private location
func (a *API) UpdatePrivateLocation(w http.ResponseWriter, r *http.Request) {
	var req UpdatePrivateLocationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	privateLocation := private_locations.PrivateLocation{
		Name:        req.Name,
		Region:      req.Region,
		Country:     req.Country,
		City:        req.City,
		Provider:    req.Provider,
		IPAddress:   req.IPAddress,
		Description: req.Description,
	}

	err = a.privateLocationsService.UpdatePrivateLocation(privateLocation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}