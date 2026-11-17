package main

import (
	"encoding/json"
	"errors"
	"fmt"
	mathrand "math/rand/v2"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// The status page serves its own Statuspage-shaped summary: page rollup,
	// components, unresolved incidents and scheduled maintenance in one call.
	// api.openstatus.dev/public/status/:slug only ever returned a bare status.
	defaultPageURL = "https://{slug}.openstatus.dev/api/status/summary.json"
	siteURL        = "https://www.openstatus.dev"
	// The apex is the marketing site on Vercel, which answers HTTP only — the
	// fly app this binary runs on is reachable at the ssh. subdomain.
	sshHost   = "ssh.openstatus.dev"
	userAgent = "openstatus-ssh/1.0"
)

// Overridable so self-hosted deployments — and local runs — can point the
// server at their own pages, the same way the React badge does.
var pageURL = defaultPageURL

// Anything slower than a page render is a problem on their side, and the
// session should say so rather than hang on the default client's absent timeout.
var client = &http.Client{Timeout: 5 * time.Second}

// Mirrors slugSchema in packages/db/src/schema/pages/validation.ts. The SSH
// username is attacker-controlled and becomes a hostname, so anything off-shape
// never reaches DNS.
var slugPattern = regexp.MustCompile(`^[A-Za-z0-9-]{3,64}$`)

// A page reached by its own domain is served the same summary — the route
// matches `lower(page.slug) = prefix OR lower(page.customDomain) = prefix` —
// so `ssh status.cal.com@` and `ssh cal@` land on the same board.
const summaryPath = "/api/status/summary.json"

// target is the page a session asked for: either a slug, which expands through
// the operator-configured template, or a domain the user typed, which does not.
type target struct {
	name string // what was typed, lowercased — used in messages
	url  string // where the summary comes from
	web  string // fallback link, when the payload carries no page url
	// domain marks a host supplied by the client rather than by configuration,
	// which is the difference between a trusted fetch and a guarded one.
	domain bool
}

// resolveTarget turns an SSH username into a page to read, or reports that it
// isn't one — `help`, junk, and anything that could point inward all land here.
func resolveTarget(user string) (target, bool) {
	name := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(user), "."))
	switch {
	case name == "" || name == "help":
		return target{}, false
	case slugPattern.MatchString(name):
		return target{
			name: name,
			url:  strings.ReplaceAll(pageURL, "{slug}", name),
			web:  fmt.Sprintf("https://%s.openstatus.dev", name),
		}, true
	case isPublicDomain(name):
		return target{
			name:   name,
			url:    "https://" + name + summaryPath,
			web:    "https://" + name,
			domain: true,
		}, true
	}
	return target{}, false
}

var (
	labelPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
	// An all-digit final label means an IPv4 literal dressed as a hostname.
	tldPattern = regexp.MustCompile(`^[a-z]{2,63}$`)
)

// Suffixes that resolve inside a private network. `.flycast` and `.internal`
// are fly's own 6PN names, which is exactly what an SSRF here would reach for.
var blockedSuffixes = []string{".internal", ".flycast", ".local", ".localhost", ".arpa", ".onion"}

// isPublicDomain screens a hostname before any lookup happens. It is the first
// of two gates: this one rejects shapes, and guardedDial rejects addresses.
func isPublicDomain(name string) bool {
	if len(name) == 0 || len(name) > 253 || strings.ContainsAny(name, ":/@ _") {
		return false
	}
	labels := strings.Split(name, ".")
	if len(labels) < 2 {
		return false
	}
	for _, label := range labels {
		if !labelPattern.MatchString(label) {
			return false
		}
	}
	if !tldPattern.MatchString(labels[len(labels)-1]) {
		return false
	}
	for _, suffix := range blockedSuffixes {
		if strings.HasSuffix(name, suffix) {
			return false
		}
	}
	return true
}

var (
	errNoPage    = errors.New("no page")
	errPassword  = errors.New("password protected")
	errForbidden = errors.New("restricted")
)

type component struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type incident struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updated_at"`
}

type maintenance struct {
	Name           string `json:"name"`
	Status         string `json:"status"`
	ScheduledFor   string `json:"scheduled_for"`
	ScheduledUntil string `json:"scheduled_until"`
}

type summary struct {
	Page struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"page"`
	Status struct {
		Indicator   string `json:"indicator"`
		Description string `json:"description"`
	} `json:"status"`
	Components   []component   `json:"components"`
	Incidents    []incident    `json:"incidents"`
	Maintenances []maintenance `json:"scheduled_maintenances"`
}

// Every connected board refreshes on its own timer, so a page with a crowd
// watching would otherwise multiply into one upstream request per viewer per
// cycle. Successful reads are shared for a few seconds; errors are not cached,
// so a page coming back up is visible immediately.
const cacheTTL = 10 * time.Second

// Past this many entries the expired ones are swept, bounding what a stream of
// distinct slugs can pin in memory.
const cacheSweepAt = 512

type cacheEntry struct {
	sum *summary
	at  time.Time
}

var (
	cacheMu sync.Mutex
	cache   = map[string]cacheEntry{}
)

// fetchSummary reports whether the answer came from the shared cache, so the
// renderers can say "cached" instead of claiming a 0ms fetch.
func fetchSummary(t target) (sum *summary, cached bool, err error) {
	cacheMu.Lock()
	hit, ok := cache[t.url]
	cacheMu.Unlock()
	if ok && time.Since(hit.at) < cacheTTL {
		return hit.sum, true, nil
	}

	sum, err = fetchLive(t)
	if err != nil {
		return nil, false, err
	}

	cacheMu.Lock()
	if len(cache) >= cacheSweepAt {
		for k, v := range cache {
			if time.Since(v.at) >= cacheTTL {
				delete(cache, k)
			}
		}
	}
	cache[t.url] = cacheEntry{sum: sum, at: time.Now()}
	cacheMu.Unlock()

	return sum, false, nil
}

func fetchLive(t target) (*summary, error) {
	req, err := http.NewRequest(http.MethodGet, t.url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json")

	// A client-supplied host is only ever fetched through the guarded client.
	hc := client
	if t.domain {
		hc = guardedClient
	}
	res, err := hc.Do(req)
	if err != nil {
		var netErr net.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			return nil, errors.New("the status page did not answer in time")
		}
		return nil, errors.New("the status page is unreachable")
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, errNoPage
	case http.StatusUnauthorized:
		return nil, errPassword
	case http.StatusForbidden:
		return nil, errForbidden
	default:
		return nil, fmt.Errorf("the status page answered with %d", res.StatusCode)
	}

	var body summary
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, errors.New("the status page answered with something that isn't a summary")
	}
	return &body, nil
}

// label is the headline: the API's own wording, so the terminal and the web
// page never disagree.
func (s *summary) label() string {
	if s.Status.Description != "" {
		return s.Status.Description
	}
	return humanize(s.Status.Indicator)
}

func (s *summary) url(t target) string {
	if s.Page.URL != "" {
		return s.Page.URL
	}
	return t.web
}

// split separates the components worth naming from the healthy remainder.
func (s *summary) split() (impacted []component, healthy int) {
	for _, c := range s.Components {
		if c.Status == "operational" {
			healthy++
			continue
		}
		impacted = append(impacted, c)
	}
	return impacted, healthy
}

type conditions struct {
	icon  string
	quips []string
}

// Status as weather, keyed on the page indicator.
var forecast = map[string]conditions{
	"none": {
		icon: "☀️",
		quips: []string{
			"Nothing to see here. Go touch grass.",
			"Boring. Beautifully boring.",
			"All green. Suspiciously green.",
			"Everything is fine. Genuinely, this time.",
		},
	},
	"minor": {
		icon: "⛅",
		quips: []string{
			"It's slow, but it's trying its best.",
			"Somewhere, a cache is crying.",
			"Not broken. Just… pensive.",
			"Some of it works. That's still something.",
		},
	},
	"major": {
		icon: "⛈️",
		quips: []string{
			"Have you tried turning it off and on again?",
			"It's not DNS. It's always DNS.",
			"Someone is having a worse day than you.",
			"This is fine. (It is not fine.)",
		},
	},
	"maintenance": {
		icon: "🚧",
		quips: []string{
			"We're under the hood. Please don't look.",
			"Planned. On purpose. We promise.",
		},
	},
}

func (c conditions) quip() string { return c.quipExcept("") }

// quipExcept picks a line, skipping the one already on screen so a refresh
// visibly does something even when the status hasn't moved.
func (c conditions) quipExcept(current string) string {
	if len(c.quips) == 0 {
		return ""
	}
	options := make([]string, 0, len(c.quips))
	for _, q := range c.quips {
		if q != current {
			options = append(options, q)
		}
	}
	if len(options) == 0 {
		return current
	}
	return options[mathrand.IntN(len(options))]
}

// noPageHint points at whichever of the two spellings the caller used.
func noPageHint(t target) string {
	if t.domain {
		return "No page is served on that domain — check the spelling, or try the page's openstatus slug."
	}
	return "Check the slug — it's the one in <slug>.openstatus.dev. A custom domain works here too."
}

func humanize(status string) string {
	return strings.ReplaceAll(status, "_", " ")
}

func incidentDetail(inc incident) string {
	detail := humanize(inc.Status)
	if ago := since(inc.UpdatedAt); ago != "" {
		detail += ", updated " + ago
	}
	return detail
}

func window(m maintenance) string {
	if m.Status == "in_progress" {
		if ends := until(m.ScheduledUntil); ends != "" {
			return "in progress, ends " + ends
		}
		return "in progress"
	}
	if starts := until(m.ScheduledFor); starts != "" {
		return "starts " + starts
	}
	return "scheduled"
}

func count(n int, noun string) string {
	if n == 1 {
		return "1 " + noun
	}
	return fmt.Sprintf("%d %ss", n, noun)
}

// since renders an RFC3339 timestamp as "3h ago", or "" if it can't be read.
func since(ts string) string {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return ""
	}
	d := time.Since(t)
	if d < time.Minute {
		return "just now"
	}
	return duration(d) + " ago"
}

// until renders a future RFC3339 timestamp as "in 3h", or "" if it can't be read.
func until(ts string) string {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return ""
	}
	d := time.Until(t)
	if d < time.Minute {
		return "any moment now"
	}
	return "in " + duration(d)
}

// duration rounds to the nearest unit: a window five hours out reads "5h",
// not the "4h" plain truncation would give it.
func duration(d time.Duration) string {
	if m := int(d.Round(time.Minute).Minutes()); m < 60 {
		return fmt.Sprintf("%dm", m)
	}
	if h := int(d.Round(time.Hour).Hours()); h < 48 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dd", int(d.Round(24*time.Hour).Hours())/24)
}

func configureFromEnv() {
	if tmpl := os.Getenv("OPENSTATUS_PAGE_URL"); tmpl != "" {
		pageURL = tmpl
	}
}
