package services

import (
	"context"
	"errors"

	"github.com/openstatushq/openstatus/pkg/models"
	"github.com/openstatushq/openstatus/pkg/repositories"
)

// PrivateLocationsService provides methods for managing private locations
type PrivateLocationsService struct {
	privateLocationsRepository repositories.PrivateLocationsRepository
}

// NewPrivateLocationsService returns a new instance of PrivateLocationsService
func NewPrivateLocationsService(privateLocationsRepository repositories.PrivateLocationsRepository) *PrivateLocationsService {
	return &PrivateLocationsService{
		privateLocationsRepository: privateLocationsRepository,
	}
}

// CreatePrivateLocation creates a new private location
func (s *PrivateLocationsService) CreatePrivateLocation(privateLocation models.PrivateLocation) error {
	_, err := s.privateLocationsRepository.CreatePrivateLocation(context.Background(), privateLocation)
	if err != nil {
		return errors.Wrap(err, "failed to create private location")
	}

	return nil
}

// UpdatePrivateLocation updates an existing private location
func (s *PrivateLocationsService) UpdatePrivateLocation(privateLocation models.PrivateLocation) error {
	_, err := s.privateLocationsRepository.UpdatePrivateLocation(context.Background(), privateLocation)
	if err != nil {
		return errors.Wrap(err, "failed to update private location")
	}

	return nil
}