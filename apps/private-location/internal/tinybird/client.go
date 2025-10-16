package tinybird

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/rs/zerolog/log"
)

const baseURL = "https://api.tinybird.co/v0/events"

type Client interface {
	SendEvent(ctx context.Context, event any, dataSourceName string) error
}

type client struct {
	httpClient *http.Client
	apiKey     string
}

func NewClient(httpClient *http.Client, apiKey string) Client {
	return client{
		httpClient: httpClient,
		apiKey:     apiKey,
	}
}

func (c client) SendEvent(ctx context.Context, event any, dataSourceName string) error {
	requestURL, err := url.Parse(baseURL)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("unable to parse url")
		return fmt.Errorf("unable to parse url: %w", err)
	}

	q := requestURL.Query()
	q.Add("name", dataSourceName)
	requestURL.RawQuery = q.Encode()

	var payload bytes.Buffer
	if err := json.NewEncoder(&payload).Encode(event); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("unable to encode payload")
		return fmt.Errorf("unable to encode payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL.String(), bytes.NewReader(payload.Bytes()))
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("unable to create request")
		return fmt.Errorf("unable to create request: %w", err)
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("unable to send request")
		return fmt.Errorf("unable to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		log.Ctx(ctx).Error().Str("status", resp.Status).Msg("unexpected status code")
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
