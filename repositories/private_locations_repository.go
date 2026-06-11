package repositories

import (
	"context"
	"errors"

	"github.com/openstatushq/openstatus/pkg/models"
)

// PrivateLocationsRepository provides methods for interacting with the private locations database
type PrivateLocationsRepository interface {
	CreatePrivateLocation(ctx context.Context, privateLocation models.PrivateLocation) (models.PrivateLocation, error)
	UpdatePrivateLocation(ctx context.Context, privateLocation models.PrivateLocation) (models.PrivateLocation, error)
}

// privateLocationsRepository is a concrete implementation of PrivateLocationsRepository
type privateLocationsRepository struct {
	db *sql.DB
}

// NewPrivateLocationsRepository returns a new instance of privateLocationsRepository
func NewPrivateLocationsRepository(db *sql.DB) PrivateLocationsRepository {
	return &privateLocationsRepository{
		db: db,
	}
}

// CreatePrivateLocation creates a new private location in the database
func (r *privateLocationsRepository) CreatePrivateLocation(ctx context.Context, privateLocation models.PrivateLocation) (models.PrivateLocation, error) {
	_, err := r.db.ExecContext(ctx, "INSERT INTO private_locations (name, region, country, city, provider, ip_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		privateLocation.Name, privateLocation.Region, privateLocation.Country, privateLocation.City, privateLocation.Provider, privateLocation.IPAddress, privateLocation.Description)
	if err != nil {
		return models.PrivateLocation{}, errors.Wrap(err, "failed to create private location")
	}

	return privateLocation, nil
}

// UpdatePrivateLocation updates an existing private location in the database
func (r *privateLocationsRepository) UpdatePrivateLocation(ctx context.Context, privateLocation models.PrivateLocation) (models.PrivateLocation, error) {
	_, err := r.db.ExecContext(ctx, "UPDATE private_locations SET name = $1, region = $2, country = $3, city = $4, provider = $5, ip_address = $6, description = $7 WHERE id = $8",
		privateLocation.Name, privateLocation.Region, privateLocation.Country, privateLocation.City, privateLocation.Provider, privateLocation.IPAddress, privateLocation.Description, privateLocation.ID)
	if err != nil {
		return models.PrivateLocation{}, errors.Wrap(err, "failed to update private location")
	}

	return privateLocation, nil
}