import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MonitorChartModel } from "@openstatus/services/agent-tools";

import { el, htmlEl, svgEl } from "../_shared/dom";
import {
  formatInterval,
  formatMs,
  formatNumber,
  formatTime,
} from "../_shared/format";
import { callTool, connectHost, hostLocale, resultText } from "../_shared/host";
import { seriesKey, showTooltip } from "../_shared/tooltip";

const TOOL_NAME = "render_monitor_chart";
const TIME_RANGES = ["1d", "7d", "14d"] as const;
const PERCENTILES = ["p50", "p75", "p90", "p95", "p99"] as const;
const HEIGHT = 240;
const MARGIN = { top: 24, right: 16, bottom: 24, left: 52 };
// End labels only while few enough lines can carry one each.
const MAX_END_LABELS = 4;
const END_LABEL_WIDTH = 36;
const END_LABEL_MIN_GAP = 13;

const root = el("root");
const title = el("title");
const subtitle = el("subtitle");
const controls = el("controls");
const ranges = el("ranges");
const percentile = el<HTMLSelectElement>("percentile");
const toggleTable = el<HTMLButtonElement>("toggle-table");
const open = el<HTMLButtonElement>("open");
const peak = el("peak");
const chartView = el("chart-view");
const plot = el("plot");
const svg = document.getElementById("svg") as unknown as SVGSVGElement;
const tooltip = el("tooltip");
const legend = el("legend");
const tableView = el("table-view");
const table = el<HTMLTableElement>("table");
const note = el("note");
const error = el("error");

const app = new App({ name: "openstatus-monitor-chart", version: "0.1.0" });

let model: MonitorChartModel | undefined;
let hovered: number | undefined;

// The tool's `outputSchema` is the contract; this only guards a foreign payload.
function isChartModel(value: unknown): value is MonitorChartModel {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MonitorChartModel>;
  return (
    typeof candidate.monitorId === "number" &&
    Array.isArray(candidate.timestamps) &&
    Array.isArray(candidate.series)
  );
}

function seriesColor(index: number): string {
  return `var(--series-${index + 1})`;
}

function tickStyle(current: MonitorChartModel) {
  return current.timeRange === "1d" ? "time" : "day";
}

function niceMax(max: number): { max: number; step: number } {
  if (max <= 0) return { max: 100, step: 25 };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude;
  return { max: Math.ceil(max / step) * step, step };
}

/** Bucket indices to label: evenly spaced hours for 1d, day starts otherwise. */
function xTicks(current: MonitorChartModel, limit: number): number[] {
  const last = current.timestamps.length - 1;
  if (last <= 0) return last === 0 ? [0] : [];
  if (current.timeRange === "1d") {
    const count = Math.min(last + 1, limit);
    return [
      ...new Set(
        Array.from({ length: count }, (_, t) =>
          Math.round((t / (count - 1)) * last),
        ),
      ),
    ];
  }
  const days: number[] = [];
  const style = tickStyle(current);
  let previous = formatTime(current.timestamps[0] as number, style, hostLocale);
  for (let index = 1; index <= last; index++) {
    const label = formatTime(
      current.timestamps[index] as number,
      style,
      hostLocale,
    );
    if (label !== previous) days.push(index);
    previous = label;
  }
  const stride = Math.ceil(days.length / limit);
  // count back from the newest day so today is always labelled
  return days.filter((_, i) => (days.length - 1 - i) % stride === 0);
}

type Scales = {
  x: (index: number) => number;
  y: (value: number) => number;
  width: number;
};

let scales: Scales | undefined;

function renderChart(current: MonitorChartModel) {
  const width = Math.max(plot.clientWidth, 240);
  const count = current.timestamps.length;
  const values = current.series.flatMap((s) =>
    s.values.filter((value) => value !== null),
  );
  const { max, step } = niceMax(Math.max(0, ...values));

  const lastIndex = count - 1;
  const ends = current.series
    .map((s, i) => ({ region: s.region, value: s.values[lastIndex], i }))
    .filter((end): end is { region: string; value: number; i: number } =>
      Number.isFinite(end.value),
    );
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const yOf = (value: number) =>
    MARGIN.top + innerHeight - (value / max) * innerHeight;
  const sortedEnds = [...ends].sort((a, b) => yOf(a.value) - yOf(b.value));
  const collides = sortedEnds.some(
    (end, i) =>
      i > 0 &&
      yOf(end.value) - yOf((sortedEnds[i - 1] as typeof end).value) <
        END_LABEL_MIN_GAP,
  );
  const showEndLabels =
    current.series.length > 1 &&
    current.series.length <= MAX_END_LABELS &&
    ends.length === current.series.length &&
    !collides;

  const right = MARGIN.right + (showEndLabels ? END_LABEL_WIDTH : 0);
  const innerWidth = width - MARGIN.left - right;
  const xOf = (index: number) =>
    MARGIN.left +
    (count <= 1 ? innerWidth / 2 : (index / lastIndex) * innerWidth);
  scales = { x: xOf, y: yOf, width };

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
  svg.setAttribute("height", String(HEIGHT));

  for (let tick = 0; tick <= max; tick += step) {
    const y = yOf(tick);
    svg.append(
      svgEl("line", {
        class: tick === 0 ? "baseline" : "grid",
        x1: MARGIN.left,
        x2: width - right,
        y1: y,
        y2: y,
      }),
      svgEl(
        "text",
        { class: "tick", x: MARGIN.left - 8, y: y + 4, "text-anchor": "end" },
        formatNumber(tick, hostLocale),
      ),
    );
  }
  svg.append(
    svgEl(
      "text",
      { class: "tick", x: MARGIN.left - 8, y: 10, "text-anchor": "end" },
      "ms",
    ),
  );

  if (count === 0) {
    svg.append(
      svgEl(
        "text",
        {
          class: "empty",
          x: MARGIN.left + innerWidth / 2,
          // between two gridlines, not on one
          y: yOf(max * 0.625) + 4,
          "text-anchor": "middle",
        },
        "No checks recorded in this window",
      ),
    );
    return;
  }

  const ticks = xTicks(current, Math.max(2, Math.floor(innerWidth / 88)));
  ticks.forEach((index, t) => {
    const anchor =
      ticks.length === 1 || (t > 0 && t < ticks.length - 1)
        ? "middle"
        : t === 0 && index === 0
          ? "start"
          : t === ticks.length - 1 && index === lastIndex
            ? "end"
            : "middle";
    svg.append(
      svgEl(
        "text",
        {
          class: "tick",
          x: xOf(index),
          y: HEIGHT - 6,
          "text-anchor": anchor,
        },
        formatTime(
          current.timestamps[index] as number,
          tickStyle(current),
          hostLocale,
        ),
      ),
    );
  });

  current.series.forEach((s, i) => {
    let path = "";
    let pen = false;
    s.values.forEach((value, index) => {
      if (value === null) {
        pen = false;
        return;
      }
      const isolated =
        (s.values[index - 1] ?? null) === null &&
        (s.values[index + 1] ?? null) === null;
      if (isolated) {
        svg.append(
          svgEl("circle", {
            class: "dot",
            cx: xOf(index),
            cy: yOf(value),
            r: 4,
            fill: seriesColor(i),
          }),
        );
      }
      path += `${pen ? "L" : "M"}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`;
      pen = true;
    });
    svg.append(
      svgEl("path", { class: "line", d: path, stroke: seriesColor(i) }),
    );
  });

  if (showEndLabels) {
    for (const end of ends) {
      svg.append(
        svgEl(
          "text",
          { class: "end-label", x: xOf(lastIndex) + 8, y: yOf(end.value) + 4 },
          end.region,
        ),
      );
    }
  }

  svg.append(svgEl("g", { id: "hover" }));
  if (hovered !== undefined) showHover(Math.min(hovered, lastIndex));
}

function showHover(index: number) {
  if (!model || !scales || model.timestamps.length === 0) return;
  hovered = index;
  const layer = svg.querySelector("#hover");
  if (!layer) return;
  const x = scales.x(index);
  layer.replaceChildren(
    svgEl("line", {
      class: "crosshair",
      x1: x,
      x2: x,
      y1: MARGIN.top,
      y2: HEIGHT - MARGIN.bottom,
    }),
  );

  const rows = model.series
    .map((s, i) => ({ region: s.region, value: s.values[index] ?? null, i }))
    .filter(
      (row): row is { region: string; value: number; i: number } =>
        row.value !== null,
    )
    .sort((a, b) => b.value - a.value);
  for (const row of rows) {
    layer.append(
      svgEl("circle", {
        class: "dot",
        cx: x,
        cy: scales.y(row.value),
        r: 4,
        fill: seriesColor(row.i),
      }),
    );
  }

  showTooltip(
    tooltip,
    {
      heading: formatTime(
        model.timestamps[index] as number,
        "full",
        hostLocale,
      ),
      rows: rows.map((row) => ({
        color: seriesColor(row.i),
        name: row.region,
        value: formatMs(row.value, hostLocale),
      })),
      empty: "No checks",
    },
    { x, containerWidth: scales.width },
  );
}

function hideHover() {
  hovered = undefined;
  svg.querySelector("#hover")?.replaceChildren();
  tooltip.hidden = true;
}

function indexAt(clientX: number): number {
  if (!model || !scales) return 0;
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * scales.width;
  const last = model.timestamps.length - 1;
  let best = 0;
  for (let i = 1; i <= last; i++) {
    if (Math.abs(scales.x(i) - x) < Math.abs(scales.x(best) - x)) best = i;
  }
  return best;
}

function renderLegend(current: MonitorChartModel) {
  legend.replaceChildren();
  // one series is already named by the title
  legend.hidden = current.series.length < 2;
  current.series.forEach((s, i) => {
    const item = htmlEl("li");
    item.append(seriesKey(seriesColor(i)), htmlEl("span", undefined, s.region));
    legend.append(item);
  });
}

function renderTable(current: MonitorChartModel) {
  const head = htmlEl("tr");
  head.append(htmlEl("th", undefined, "Time"));
  for (const s of current.series) {
    head.append(htmlEl("th", undefined, `${s.region} (ms)`));
  }
  const thead = htmlEl("thead");
  thead.append(head);
  const tbody = htmlEl("tbody");
  // newest first, like the response log
  for (let index = current.timestamps.length - 1; index >= 0; index--) {
    const row = htmlEl("tr");
    row.append(
      htmlEl(
        "td",
        undefined,
        formatTime(current.timestamps[index] as number, "full", hostLocale),
      ),
    );
    for (const s of current.series) {
      const value = s.values[index] ?? null;
      row.append(
        htmlEl(
          "td",
          undefined,
          value === null ? "–" : formatNumber(value, hostLocale),
        ),
      );
    }
    tbody.append(row);
  }
  table.replaceChildren(thead, tbody);
}

function renderControls(current: MonitorChartModel) {
  for (const button of ranges.querySelectorAll("button")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.range === current.timeRange),
    );
  }
  percentile.value = current.percentile;
}

function render() {
  if (!model) return;
  const current = model;
  title.textContent = `${current.percentile} latency · ${current.name}`;
  const regionCount = current.series.length;
  subtitle.textContent = [
    current.jobType.toUpperCase(),
    `last ${current.timeRange}`,
    `${formatInterval(current.intervalMinutes)} buckets`,
    `${regionCount} ${regionCount === 1 ? "region" : "regions"}`,
  ].join(" · ");

  peak.hidden = current.peak === null;
  if (current.peak) {
    peak.replaceChildren(
      "Peak ",
      htmlEl("strong", undefined, formatMs(current.peak.value, hostLocale)),
      ` in ${current.peak.region} at ${formatTime(current.peak.timestamp, "full", hostLocale)}`,
    );
  }

  note.hidden = current.omittedRegions.length === 0;
  note.textContent = `Showing the ${regionCount} slowest regions. Not plotted: ${current.omittedRegions.join(", ")}.`;

  renderControls(current);
  renderLegend(current);
  renderTable(current);
  renderChart(current);
}

function showError(message: string) {
  error.textContent = message;
  error.hidden = false;
}

function applyResult(result: CallToolResult) {
  if (result.isError) {
    showError(resultText(result) || "The chart could not be loaded.");
  } else if (isChartModel(result.structuredContent)) {
    error.hidden = true;
    model = result.structuredContent;
    hideHover();
    render();
  } else {
    showError("The server returned no chart data.");
  }
  root.setAttribute("aria-busy", "false");
}

async function refetch(next: {
  timeRange?: MonitorChartModel["timeRange"];
  percentile?: MonitorChartModel["percentile"];
}) {
  if (!model) return;
  const regions = model.series.map((s) => s.region);
  root.setAttribute("aria-busy", "true");
  try {
    const result = await callTool(app, TOOL_NAME, {
      monitorId: model.monitorId,
      timeRange: next.timeRange ?? model.timeRange,
      percentile: next.percentile ?? model.percentile,
      // pin the regions so a line keeps its colour across ranges
      ...(regions.length > 0 ? { regions } : {}),
    });
    applyResult(result);
    if (!result.isError && app.getHostCapabilities()?.updateModelContext) {
      // keeps the model's picture in step with what the user now sees
      await app.updateModelContext({ content: result.content }).catch(() => {});
    }
  } catch (err) {
    showError(
      err instanceof Error ? err.message : "The chart could not be loaded.",
    );
    root.setAttribute("aria-busy", "false");
    if (model) renderControls(model);
  }
}

function setUpControls() {
  for (const range of TIME_RANGES) {
    const button = htmlEl("button", undefined, range);
    button.type = "button";
    button.dataset.range = range;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (model?.timeRange !== range) void refetch({ timeRange: range });
    });
    ranges.append(button);
  }
  for (const value of PERCENTILES) {
    const option = htmlEl("option", undefined, value);
    option.value = value;
    percentile.append(option);
  }
  percentile.addEventListener("change", () => {
    void refetch({
      percentile: percentile.value as MonitorChartModel["percentile"],
    });
  });

  toggleTable.addEventListener("click", () => {
    const showTable = tableView.hidden;
    tableView.hidden = !showTable;
    chartView.hidden = showTable;
    toggleTable.setAttribute("aria-pressed", String(showTable));
    if (!showTable && model) renderChart(model);
  });

  open.addEventListener("click", () => {
    if (model) void app.openLink({ url: model.dashboardUrl }).catch(() => {});
  });

  svg.setAttribute("tabindex", "0");
  svg.addEventListener("pointermove", (event) =>
    showHover(indexAt(event.clientX)),
  );
  svg.addEventListener("pointerdown", (event) =>
    showHover(indexAt(event.clientX)),
  );
  svg.addEventListener("pointerleave", hideHover);
  svg.addEventListener("blur", hideHover);
  svg.addEventListener("focus", () => {
    if (model && model.timestamps.length > 0) {
      showHover(hovered ?? model.timestamps.length - 1);
    }
  });
  svg.addEventListener("keydown", (event) => {
    if (!model || model.timestamps.length === 0) return;
    const last = model.timestamps.length - 1;
    const current = hovered ?? last;
    const next = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showHover(next);
  });

  new ResizeObserver(() => {
    if (model && !chartView.hidden) renderChart(model);
  }).observe(plot);
}

async function main() {
  setUpControls();

  app.ontoolresult = (result) => applyResult(result);
  app.ontoolcancelled = () => {
    showError("The chart request was cancelled.");
    root.setAttribute("aria-busy", "false");
  };

  await connectHost(app, render);

  const capabilities = app.getHostCapabilities();
  controls.hidden = false;
  // range and percentile re-call the tool, which the host has to allow
  ranges.hidden = !capabilities?.serverTools;
  percentile.parentElement?.toggleAttribute(
    "hidden",
    !capabilities?.serverTools,
  );
  open.hidden = !capabilities?.openLinks;
}

void main().catch((err) => {
  showError(err instanceof Error ? err.message : "The chart failed to start.");
  root.setAttribute("aria-busy", "false");
});
