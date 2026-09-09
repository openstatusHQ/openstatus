package main

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/x/ansi"
	"github.com/muesli/termenv"
)

const (
	// Page data is cached for 30s upstream, so refreshing faster than this only
	// buys duplicate answers.
	refreshEvery = 15 * time.Second
	// The board is drawn inline rather than in the alt screen, so it has to
	// stay short enough to sit in a terminal without scrolling — and so the
	// last frame survives after quitting.
	tuiComponentListLimit = 8
	tuiMaxComponentLines  = 10
	tuiMaxEvents          = 3
)

// tuiKey marks a session the TUI has already served, so the plain middleware
// downstream doesn't print the static view underneath it on exit.
type contextKey struct{ name string }

var tuiKey = &contextKey{"tui"}

// teaHandler returns a nil model for anything the TUI shouldn't serve — no
// terminal, or a slug that isn't one — which makes wish fall through to the
// plain renderer.
func teaHandler(s ssh.Session) (tea.Model, []tea.ProgramOption) {
	pty, _, ok := s.Pty()
	if !ok {
		return nil, nil
	}
	slug := strings.ToLower(s.User())
	if slug == "help" || !slugPattern.MatchString(slug) {
		return nil, nil
	}
	s.Context().SetValue(tuiKey, true)
	return newModel(slug, sessionRenderer(s, pty), pty.Window.Width), nil
}

// sessionRenderer is wish's MakeRenderer without its background-colour probe.
// That probe writes an OSC 11 query and blocks reading the session until the
// client answers; clients that never answer (and anything driving ssh from a
// script) either stall the handler or have their keystrokes swallowed by the
// probe's reader. Nothing here adapts to light or dark — the palette is ANSI
// 1-4 — so the query buys nothing and costs the keyboard.
func sessionRenderer(s ssh.Session, pty ssh.Pty) *lipgloss.Renderer {
	if pty.Term == "" || pty.Term == "dumb" {
		return lipgloss.NewRenderer(s, termenv.WithProfile(termenv.Ascii))
	}
	return lipgloss.NewRenderer(s,
		termenv.WithEnvironment(sshEnviron(append(s.Environ(), "TERM="+pty.Term))),
		termenv.WithColorCache(true),
		// The session isn't an *os.File, so termenv's isatty check would
		// otherwise flatten every client to no colour at all.
		termenv.WithUnsafe(),
	)
}

// sshEnviron adapts the client's environment to termenv's lookup interface.
type sshEnviron []string

func (e sshEnviron) Environ() []string { return e }

func (e sshEnviron) Getenv(key string) string {
	for _, kv := range e {
		if strings.HasPrefix(kv, key+"=") {
			return kv[len(key)+1:]
		}
	}
	return ""
}

type fetchedMsg struct {
	sum    *summary
	err    error
	took   time.Duration
	cached bool
}

type tickMsg time.Time

type model struct {
	slug   string
	styles styles
	width  int

	spin    spinner.Model
	loading bool

	sum       *summary
	err       error
	fetchedAt time.Time // last successful read, which is what "updated 3s ago" means
	lastTry   time.Time // last attempt, successful or not, which paces the refresh
	took      time.Duration
	cached    bool

	quip      string
	firstDraw bool
}

func newModel(slug string, r *lipgloss.Renderer, width int) model {
	sp := spinner.New(spinner.WithSpinner(spinner.Dot))
	st := newStyles(r)
	sp.Style = st.dim
	return model{
		slug:      slug,
		styles:    st,
		width:     clampWidth(width),
		spin:      sp,
		loading:   true,
		firstDraw: true,
	}
}

// clampWidth leaves room for the two-space margin indent() adds back.
func clampWidth(w int) int {
	switch {
	case w <= 0:
		return 70
	case w < 26:
		return 24
	case w > 74:
		return 72
	default:
		return w - 2
	}
}

func fetchCmd(slug string) tea.Cmd {
	return func() tea.Msg {
		start := time.Now()
		sum, hit, err := fetchSummary(slug)
		return fetchedMsg{sum: sum, err: err, took: time.Since(start), cached: hit}
	}
}

// One second is the clock, not the refresh rate: it keeps "updated 4s ago"
// honest and doubles as the trigger for the next fetch.
func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spin.Tick, fetchCmd(m.slug), tickCmd())
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = clampWidth(msg.Width)
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		case "r":
			if m.loading {
				return m, nil
			}
			m.loading = true
			return m, tea.Batch(fetchCmd(m.slug), m.spin.Tick)
		}
		return m, nil

	case tickMsg:
		// A page that doesn't exist won't start existing; stop hammering it.
		if !m.loading && !errors.Is(m.err, errNoPage) && time.Since(m.lastTry) >= refreshEvery {
			m.loading = true
			return m, tea.Batch(fetchCmd(m.slug), m.spin.Tick, tickCmd())
		}
		return m, tickCmd()

	case fetchedMsg:
		m.loading, m.firstDraw = false, false
		m.lastTry, m.err = time.Now(), msg.err
		// A failed refresh keeps the last good board on screen rather than
		// blanking it; only a read that actually landed moves the clock.
		if msg.sum != nil {
			m.sum, m.fetchedAt, m.took, m.cached = msg.sum, time.Now(), msg.took, msg.cached
			m.newQuip(msg.sum.Status.Indicator)
		}
		return m, nil

	case spinner.TickMsg:
		if !m.loading {
			return m, nil
		}
		var cmd tea.Cmd
		m.spin, cmd = m.spin.Update(msg)
		return m, cmd
	}
	return m, nil
}

// Every landed read draws a new line — it's the cheapest signal that the board
// is live rather than a screenshot.
func (m *model) newQuip(indicator string) {
	m.quip = forecast[indicator].quipExcept(m.quip)
}

func (m model) View() string {
	st := m.styles
	var b strings.Builder
	write := func(s string) { b.WriteString(s + "\n") }

	write("")
	switch {
	case m.firstDraw:
		write(m.spin.View() + " reading " + m.slug + "…")
		write("")
		return indent(b.String() + m.footer())
	case errors.Is(m.err, errNoPage):
		write("🤷  " + st.bold.Render(fmt.Sprintf("No status page called %q", m.slug)))
		write("")
		write(st.dim.Render("Check the slug — it's the one in <slug>.openstatus.dev."))
	case errors.Is(m.err, errPassword), errors.Is(m.err, errForbidden):
		write("🔒  " + st.bold.Render(fmt.Sprintf("%q is not public", m.slug)))
		write("")
		write(st.dim.Render("Open it in a browser to get in."))
	case m.err != nil && m.sum == nil:
		write("⚠️  " + st.bad.Bold(true).Render("Could not read the status"))
		write("")
		write(st.dim.Render(m.err.Error() + "."))
	default:
		m.writeBoard(write)
	}

	write("")
	return indent(b.String() + m.footer())
}

// indent gives the board the same two-space margin the static view has.
func indent(s string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		if l != "" {
			lines[i] = "  " + l
		}
	}
	return strings.Join(lines, "\n")
}

func (m model) writeBoard(write func(string)) {
	st := m.styles
	sum := m.sum

	head := st.forIndicator(sum.Status.Indicator).Bold(true).Render(sum.label())
	if cond, ok := forecast[sum.Status.Indicator]; ok {
		head = cond.icon + "  " + head
	}
	write(head)
	if name := strings.TrimSpace(sum.Page.Name); name != "" {
		write(st.dim.Render(name))
	}

	// A stale read is still worth showing — say so rather than blanking the board.
	if m.err != nil {
		write("")
		write(st.warn.Render("⚠ " + m.err.Error() + " — showing the last good read"))
	}

	if len(sum.Components) > 0 {
		write("")
		m.writeComponents(write)
	}

	if len(sum.Incidents) > 0 {
		write("")
		write(st.bold.Render("Ongoing incidents"))
		for i, inc := range sum.Incidents {
			if i == tuiMaxEvents {
				write(st.dim.Render(fmt.Sprintf("  …and %d more", len(sum.Incidents)-i)))
				break
			}
			write(m.clip("• " + inc.Name + " — " + incidentDetail(inc)))
		}
	}

	if len(sum.Maintenances) > 0 {
		write("")
		write(st.bold.Render("Scheduled maintenance"))
		for i, mt := range sum.Maintenances {
			if i == tuiMaxEvents {
				write(st.dim.Render(fmt.Sprintf("  …and %d more", len(sum.Maintenances)-i)))
				break
			}
			write(m.clip("• " + mt.Name + " — " + window(mt)))
		}
	}

	if m.quip != "" {
		write("")
		write(st.dim.Render(m.clip(`"` + m.quip + `"`)))
	}
}

func (m model) writeComponents(write func(string)) {
	st := m.styles
	impacted, healthy := m.sum.split()

	if len(impacted) == 0 && len(m.sum.Components) > tuiComponentListLimit {
		write(st.dim.Render(fmt.Sprintf("%s · all operational", count(len(m.sum.Components), "component"))))
		return
	}

	listed := impacted
	if len(impacted) == 0 {
		listed = m.sum.Components
	}
	for i, c := range listed {
		if i == tuiMaxComponentLines {
			write(st.dim.Render(fmt.Sprintf("…and %d more", len(listed)-i)))
			break
		}
		line := st.forComponent(c.Status).Render("●") + " " + c.Name
		if c.Status != "operational" {
			line += st.dim.Render(" — " + humanize(c.Status))
		}
		write(m.clip(line))
	}
	if len(impacted) > 0 && healthy > 0 {
		write(st.dim.Render(fmt.Sprintf("%s operational", count(healthy, "other component"))))
	}
}

// footer carries the page link, the freshness of the read and the keys.
func (m model) footer() string {
	st := m.styles
	rule := st.dim.Render(strings.Repeat("─", m.width))

	right := st.dim.Render("r refresh · q quit")
	left := ""
	if m.sum != nil {
		left = st.dim.Render(m.sum.url(m.slug))
	}

	status := ""
	switch {
	case m.loading:
		status = m.spin.View() + st.dim.Render(" refreshing")
	case !m.fetchedAt.IsZero():
		read := fmt.Sprintf("%dms", m.took.Milliseconds())
		if m.cached {
			read = "cached"
		}
		status = st.dim.Render(fmt.Sprintf("updated %s · %s", ago(time.Since(m.fetchedAt)), read))
	}

	return strings.Join([]string{rule, m.spread(left, status), right}, "\n")
}

// spread pushes right against the right edge, using lipgloss's display-width
// so ANSI sequences don't count toward the padding.
func (m model) spread(left, right string) string {
	pad := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if pad < 1 {
		if left == "" {
			return right
		}
		return left + "\n" + right
	}
	return left + strings.Repeat(" ", pad) + right
}

// clip truncates a line that would wrap, keeping the board's height stable.
// ansi.Truncate measures cells rather than bytes, so it won't cut a line in the
// middle of an escape sequence and leave the colour bleeding down the screen.
func (m model) clip(s string) string {
	if lipgloss.Width(s) <= m.width {
		return s
	}
	return ansi.Truncate(s, m.width, "…")
}

func ago(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds ago", int(d.Seconds()))
	}
	return duration(d) + " ago"
}

type styles struct {
	bold, dim, ok, warn, bad, info lipgloss.Style
}

func newStyles(r *lipgloss.Renderer) styles {
	return styles{
		bold: r.NewStyle().Bold(true),
		dim:  r.NewStyle().Faint(true),
		ok:   r.NewStyle().Foreground(lipgloss.Color("2")),
		warn: r.NewStyle().Foreground(lipgloss.Color("3")),
		bad:  r.NewStyle().Foreground(lipgloss.Color("1")),
		info: r.NewStyle().Foreground(lipgloss.Color("4")),
	}
}

func (st styles) forIndicator(indicator string) lipgloss.Style {
	switch indicator {
	case "none":
		return st.ok
	case "minor":
		return st.warn
	case "major":
		return st.bad
	case "maintenance":
		return st.info
	default:
		return st.bold
	}
}

func (st styles) forComponent(status string) lipgloss.Style {
	switch status {
	case "operational":
		return st.ok
	case "degraded_performance", "partial_outage":
		return st.warn
	case "major_outage":
		return st.bad
	case "under_maintenance":
		return st.info
	default:
		return st.dim
	}
}
