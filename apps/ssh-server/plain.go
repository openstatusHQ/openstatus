package main

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/charmbracelet/ssh"
)

// The plain renderer serves sessions without a terminal — `ssh page@… | cat`
// in a script, a CI job, a `ProxyCommand`. Anything with a PTY gets the TUI.
const (
	plainComponentListLimit = 10
	plainMaxComponentLines  = 20
)

// ANSI escapes, emitted only when the client asked for a terminal.
const (
	ansiReset  = "\033[0m"
	ansiBold   = "\033[1m"
	ansiDim    = "\033[2m"
	ansiRed    = "\033[31m"
	ansiGreen  = "\033[32m"
	ansiYellow = "\033[33m"
	ansiBlue   = "\033[34m"
)

// Component impact values, which already match Statuspage's enum.
var componentColor = map[string]string{
	"operational":          ansiGreen,
	"degraded_performance": ansiYellow,
	"partial_outage":       ansiYellow,
	"major_outage":         ansiRed,
	"under_maintenance":    ansiBlue,
}

// plainMiddleware renders the static view. It sits at the end of the chain, so
// it also runs after the TUI exits — the context flag tells those apart.
func plainMiddleware(next ssh.Handler) ssh.Handler {
	return func(s ssh.Session) {
		if handled, _ := s.Context().Value(tuiKey).(bool); handled {
			next(s)
			return
		}
		plainHandler(s)
		next(s)
	}
}

func plainHandler(s ssh.Session) {
	sc := newScreen(s)

	t, ok := resolveTarget(s.User())
	if !ok {
		writeUsage(sc)
		return
	}

	start := time.Now()
	sum, hit, err := fetchSummary(t)
	took := time.Since(start)

	switch {
	case errors.Is(err, errNoPage):
		writeNoPage(sc, t)
		return
	case errors.Is(err, errPassword):
		writeLocked(sc, t, "This status page is password protected.")
		return
	case errors.Is(err, errForbidden):
		writeLocked(sc, t, "This status page is restricted to its own people.")
		return
	case err != nil:
		writeError(sc, err)
		return
	}

	cond, known := forecast[sum.Status.Indicator]

	sc.line("")
	if known {
		sc.line(cond.icon + "  " + sc.paint(ansiBold, sum.label()))
	} else {
		sc.line(sc.paint(ansiBold, sum.label()))
	}
	if name := strings.TrimSpace(sum.Page.Name); name != "" {
		sc.line(sc.paint(ansiDim, name))
	}

	writeComponents(sc, sum)
	writeIncidents(sc, sum.Incidents)
	writeMaintenances(sc, sum.Maintenances)

	if q := cond.quip(); q != "" {
		sc.line("")
		sc.prose(`"`+q+`"`, ansiDim)
	}

	sc.line("")
	sc.rule()
	read := fmt.Sprintf("fetched in %dms", took.Milliseconds())
	if hit {
		read = "cached"
	}
	sc.row(sum.url(t), "", read, ansiDim)
	sc.line("")
}

// screen renders one session's output against the width the client reported.
type screen struct {
	w     io.Writer
	width int
	tty   bool
}

func newScreen(s ssh.Session) screen {
	pty, _, isPty := s.Pty()
	width := pty.Window.Width
	if width <= 0 {
		width = 80
	}
	if width > 72 {
		width = 72
	}
	return screen{w: s, width: width, tty: isPty}
}

// inner is the printable width once the two-space left margin is removed.
func (sc screen) inner() int { return sc.width - 4 }

// paint colors s only on a terminal, so `ssh page@… | cat` stays clean.
func (sc screen) paint(codes, s string) string {
	if !sc.tty || codes == "" {
		return s
	}
	return codes + s + ansiReset
}

// line writes one indented line. A client PTY is in raw mode, so a bare \n
// walks the cursor down without returning it — every line needs the \r.
func (sc screen) line(s string) {
	if s != "" {
		s = "  " + s
	}
	if sc.tty {
		s += "\r"
	}
	io.WriteString(sc.w, s+"\n")
}

// prose writes s wrapped to the terminal width, so a quip or an incident title
// doesn't spill on a narrow client.
func (sc screen) prose(s, codes string) { sc.wrap(s, codes, 0) }

// bullet is prose with a hanging indent, so a wrapped incident title stays
// visually under its own bullet instead of lining up with the next one.
func (sc screen) bullet(s, codes string) { sc.wrap("• "+s, codes, 2) }

func (sc screen) wrap(s, codes string, hang int) {
	width := sc.inner()
	if width < 16 {
		sc.line(sc.paint(codes, s))
		return
	}
	indent, prefix, limit := strings.Repeat(" ", hang), "", width
	line := ""
	flush := func() {
		sc.line(sc.paint(codes, prefix+line))
		prefix, limit = indent, width-hang
	}
	for _, word := range strings.Fields(s) {
		switch {
		case line == "":
			line = word
		case utf8.RuneCountInString(line)+1+utf8.RuneCountInString(word) <= limit:
			line += " " + word
		default:
			flush()
			line = word
		}
	}
	if line != "" {
		flush()
	}
}

// row puts right flush against the right margin, falling back to a second line
// when the two would collide on a narrow terminal. Only used for ASCII runs:
// component names carry flag emoji, whose cell width no rune count can predict,
// so those lines are never column-aligned.
func (sc screen) row(left, leftCodes, right, rightCodes string) {
	pad := sc.inner() - utf8.RuneCountInString(left) - utf8.RuneCountInString(right)
	if pad >= 1 {
		sc.line(sc.paint(leftCodes, left) + strings.Repeat(" ", pad) + sc.paint(rightCodes, right))
		return
	}
	sc.line(sc.paint(leftCodes, left))
	sc.line(sc.paint(rightCodes, right))
}

func (sc screen) rule() {
	sc.line(sc.paint(ansiDim, strings.Repeat("─", sc.inner())))
}

func writeComponents(sc screen, sum *summary) {
	if len(sum.Components) == 0 {
		return
	}
	impacted, healthy := sum.split()

	sc.line("")

	// Nothing wrong and too many to be worth listing: one line beats a wall of
	// identical green dots.
	if len(impacted) == 0 && len(sum.Components) > plainComponentListLimit {
		sc.line(sc.paint(ansiDim, fmt.Sprintf("%s · all operational", count(len(sum.Components), "component"))))
		return
	}

	listed := impacted
	if len(impacted) == 0 {
		listed = sum.Components
	}
	for i, c := range listed {
		if i == plainMaxComponentLines {
			sc.line(sc.paint(ansiDim, fmt.Sprintf("…and %d more", len(listed)-i)))
			break
		}
		dot := sc.paint(componentColor[c.Status], "●")
		if c.Status == "operational" {
			sc.line(dot + " " + c.Name)
			continue
		}
		sc.line(dot + " " + c.Name + sc.paint(ansiDim, " — "+humanize(c.Status)))
	}
	if len(impacted) > 0 && healthy > 0 {
		sc.line(sc.paint(ansiDim, fmt.Sprintf("%s operational", count(healthy, "other component"))))
	}
}

func writeIncidents(sc screen, incidents []incident) {
	if len(incidents) == 0 {
		return
	}
	sc.line("")
	sc.line(sc.paint(ansiBold, "Ongoing incidents"))
	for _, inc := range incidents {
		sc.bullet(inc.Name+" — "+incidentDetail(inc), "")
	}
}

func writeMaintenances(sc screen, maintenances []maintenance) {
	if len(maintenances) == 0 {
		return
	}
	sc.line("")
	sc.line(sc.paint(ansiBold, "Scheduled maintenance"))
	for _, m := range maintenances {
		sc.bullet(m.Name+" — "+window(m), "")
	}
}

func writeUsage(sc screen) {
	sc.line("")
	sc.line(sc.paint(ansiBold, "OpenStatus, in your terminal."))
	sc.line("")
	sc.line(sc.paint(ansiDim, "Usage") + "   ssh <your-page>@" + sshHost)
	sc.line("        ssh <your-domain>@" + sshHost)
	sc.line("")
	sc.line(sc.paint(ansiDim, "Try") + "     ssh status@" + sshHost)
	sc.line("")
	sc.rule()
	sc.line(sc.paint(ansiDim, "Create your status page at ") + siteURL)
	sc.line("")
}

func writeNoPage(sc screen, t target) {
	sc.line("")
	sc.line("🤷  " + sc.paint(ansiBold, fmt.Sprintf("No status page called %q", t.name)))
	sc.line("")
	sc.prose(noPageHint(t), ansiDim)
	sc.line("")
	sc.rule()
	sc.line(sc.paint(ansiDim, "Create your status page at ") + siteURL)
	sc.line("")
}

func writeLocked(sc screen, t target, why string) {
	sc.line("")
	sc.line("🔒  " + sc.paint(ansiBold, fmt.Sprintf("%q is not public", t.name)))
	sc.line("")
	sc.prose(why+" Open it in a browser to get in.", ansiDim)
	sc.line("")
	sc.rule()
	sc.line(t.web)
	sc.line("")
}

func writeError(sc screen, err error) {
	sc.line("")
	sc.line("⚠️  " + sc.paint(ansiRed+ansiBold, "Could not read the status"))
	sc.line("")
	sc.prose(err.Error()+". Try again in a moment.", ansiDim)
	sc.line("")
	sc.rule()
	sc.line(sc.paint(ansiDim, "Our own status lives at ") + "https://status.openstatus.dev")
	sc.line("")
}
