"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";

import type {
  HealthCheckReport,
  StepResult,
  ToolInfo,
} from "../../../../lib/mcp/health-check";
import { toast } from "../../../../lib/toast";
import { cn } from "../../../../lib/utils";
import { searchParamsParsers } from "./search-params";
import {
  STEP_REQUEST_BODIES,
  type StepKey,
  VERDICT_DOT,
  VERDICT_LABEL,
  formatResponseBody,
  originOf,
  statusDotClass,
} from "./utils";

const SAMPLE_URLS = ["https://hf.co/mcp", "https://mcp.context7.com/mcp"];

type HeaderRow = { key: string; value: string };

type ApiResponse =
  | { id: string; report: HealthCheckReport }
  | { error: string; code: string; details?: unknown };

type McpHealthContextType = {
  report: HealthCheckReport | null;
  setReport: React.Dispatch<React.SetStateAction<HealthCheckReport | null>>;
  id: string | null;
  setId: (next: string | null) => void;
};

const McpHealthContext = createContext<McpHealthContextType | null>(null);

export function McpHealthProvider({
  children,
  defaultReport = null,
}: {
  children: React.ReactNode;
  defaultReport?: HealthCheckReport | null;
}) {
  const [report, setReport] = useState<HealthCheckReport | null>(defaultReport);
  const [{ id: urlId }, setSearchParams] = useQueryStates(searchParamsParsers);
  const [id, setLocalId] = useState<string | null>(urlId);

  useEffect(() => {
    setLocalId(urlId);
  }, [urlId]);

  const setId: McpHealthContextType["setId"] = (next) => {
    setLocalId(next);
    void setSearchParams({ id: next });
  };

  return (
    <McpHealthContext.Provider value={{ report, setReport, id, setId }}>
      {children}
    </McpHealthContext.Provider>
  );
}

function useMcpHealthContext() {
  const context = useContext(McpHealthContext);
  if (!context) {
    throw new Error(
      "useMcpHealthContext must be used within a McpHealthProvider",
    );
  }
  return context;
}

export function Form({ defaultUrl = "" }: { defaultUrl?: string }) {
  const { setReport, setId } = useMcpHealthContext();
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const url = String(formData.get("url") ?? "").trim();
    if (!url) {
      toast.error("Enter an MCP server URL");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("Invalid URL");
      return;
    }

    setReport(null);
    setId(null);

    startTransition(async () => {
      const toastId = toast.loading("Running MCP handshake...", {
        duration: Number.POSITIVE_INFINITY,
        closeButton: false,
      });
      try {
        const res = await fetch("/play/mcp-health/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            headers: headers.filter((h) => h.key.trim()),
          }),
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || "error" in data) {
          const msg =
            "error" in data ? data.error : `Request failed (${res.status})`;
          toast.error(msg, { id: toastId, className: "text-destructive!" });
          return;
        }
        setReport(data.report);
        setId(data.id);
        toast.success(`Check complete: ${VERDICT_LABEL[data.report.verdict]}`, {
          id: toastId,
          description: "View full request/response per step.",
          action: {
            label: "Details",
            onClick: () => router.push(`/play/mcp-health/${data.id}`),
          },
          duration: 4000,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        toast.error(msg, { id: toastId, className: "text-destructive!" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        <div className="col-span-3 md:col-span-4">
          <Input
            name="url"
            placeholder="https://example.com/mcp"
            className="h-auto! rounded-none p-4 text-base md:text-base"
            defaultValue={defaultUrl}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            required
          />
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Button
            type="submit"
            variant="default"
            className="h-full w-full rounded-none p-4 text-base"
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
      <SampleHint />
      <HeadersEditor
        headers={headers}
        setHeaders={setHeaders}
        disabled={isPending}
      />
    </form>
  );
}

function HeadersEditor({
  headers,
  setHeaders,
  disabled,
}: {
  headers: HeaderRow[];
  setHeaders: React.Dispatch<React.SetStateAction<HeaderRow[]>>;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        <code>Content-Type: application/json</code> and{" "}
        <code>Accept: application/json, text/event-stream</code> are sent on
        every request.
      </p>
      <div className="grid grid-cols-5 gap-2">
        <Button
          type="button"
          variant="outline"
          className="col-span-2 h-auto! rounded-none p-3 text-base"
          onClick={() => setHeaders((h) => [...h, { key: "", value: "" }])}
          disabled={disabled}
        >
          Add header
        </Button>
        <div className="col-span-3" />
        {headers.map((header, index) => (
          <Fragment key={index}>
            <Input
              placeholder="Key (e.g. Authorization)"
              className="col-span-2 h-auto! rounded-none p-3 text-base md:text-base"
              value={header.key}
              onChange={(e) =>
                setHeaders((rows) =>
                  rows.map((h, i) =>
                    i === index ? { ...h, key: e.target.value } : h,
                  ),
                )
              }
              disabled={disabled}
            />
            <Input
              placeholder="Value"
              className="col-span-2 h-auto! rounded-none p-3 text-base md:text-base"
              value={header.value}
              onChange={(e) =>
                setHeaders((rows) =>
                  rows.map((h, i) =>
                    i === index ? { ...h, value: e.target.value } : h,
                  ),
                )
              }
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              className="h-full w-full rounded-none p-3 text-base"
              onClick={() =>
                setHeaders((rows) => rows.filter((_, i) => i !== index))
              }
              disabled={disabled}
            >
              Remove
            </Button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function SampleHint() {
  return (
    <p className="text-muted-foreground text-sm">
      No idea where to start? Try{" "}
      {SAMPLE_URLS.map((url, i) => (
        <Fragment key={url}>
          {i > 0 && (i === SAMPLE_URLS.length - 1 ? " or " : ", ")}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              const input =
                document.querySelector<HTMLInputElement>("input[name='url']");
              if (input) input.value = url;
            }}
          >
            <code>{url}</code>
          </button>
        </Fragment>
      ))}
      .
    </p>
  );
}

export function ResultTable() {
  const { report } = useMcpHealthContext();
  return <ResultTableStatic report={report} />;
}

export function ResultTableStatic({
  report,
}: {
  report: HealthCheckReport | null;
}) {
  const steps = report ? toStepRows(report) : EMPTY_STEPS;
  const okCount = steps.filter((s) => s.step.ok).length;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th className="w-12" />
            <th>Step</th>
            <th>Latency</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {steps.map(({ key, label, step, note }) => {
            const row = (
              <tr
                key={key}
                className={report ? "hover:bg-muted/50 cursor-pointer" : ""}
              >
                <td>
                  <StatusDot input={report ? step : null} />
                </td>
                <td>{label}</td>
                <td>
                  {report && step.latencyMs > 0 ? `${step.latencyMs}ms` : "—"}
                </td>
                <td>{note ?? "—"}</td>
              </tr>
            );
            return report ? (
              <StepDialog
                key={key}
                stepKey={key}
                label={label}
                step={step}
                report={report}
              >
                {row}
              </StepDialog>
            ) : (
              <Fragment key={key}>{row}</Fragment>
            );
          })}
        </tbody>
        <caption>
          {report
            ? `${VERDICT_LABEL[report.verdict]} — ${okCount} / ${steps.length} steps OK${
                report.initialize.serverInfo
                  ? ` · ${report.initialize.serverInfo.name}@${report.initialize.serverInfo.version}`
                  : ""
              } · click a row for the JSON-RPC request and response`
            : "Run a check to see results."}
        </caption>
      </table>
    </div>
  );
}

function StepDialog({
  stepKey,
  label,
  step,
  report,
  children,
}: {
  stepKey: StepKey;
  label: string;
  step: StepResult;
  report: HealthCheckReport;
  children: React.ReactNode;
}) {
  const requestBody = STEP_REQUEST_BODIES[stepKey];
  const extras = stepDetailRows(stepKey, report);
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto rounded-none! font-mono sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            JSON-RPC request and the response captured during the handshake.
          </DialogDescription>
        </DialogHeader>
        <div className="prose dark:prose-invert max-w-none min-w-0">
          <table>
            <tbody>
              <tr>
                <td>Status</td>
                <td>{step.ok ? "OK" : (step.error?.code ?? "failed")}</td>
              </tr>
              <tr>
                <td>Latency</td>
                <td>{step.latencyMs > 0 ? `${step.latencyMs}ms` : "—"}</td>
              </tr>
              {extras.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="break-words">{v}</td>
                </tr>
              ))}
              {step.error && (
                <tr>
                  <td>Error</td>
                  <td className="break-words">
                    {step.error.code}: {step.error.message}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Tabs defaultValue="response">
            <TabsList className="h-auto w-full rounded-none">
              <TabsTrigger
                value="response"
                className="h-auto w-full truncate rounded-none p-4"
              >
                Response
              </TabsTrigger>
              <TabsTrigger
                value="request"
                className="h-auto w-full truncate rounded-none p-4"
              >
                Request
              </TabsTrigger>
            </TabsList>
            <TabsContent value="response" className="min-w-0 overflow-x-auto">
              <pre className="my-0! break-words whitespace-pre-wrap">
                <code className="block break-words">
                  {formatResponseBody(step.rawBody) || "(no body captured)"}
                </code>
              </pre>
            </TabsContent>
            <TabsContent value="request" className="min-w-0 overflow-x-auto">
              <pre className="my-0! break-words whitespace-pre-wrap">
                <code className="block break-words">
                  {JSON.stringify(requestBody, null, 2)}
                </code>
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuthChallengeCallout() {
  const { report } = useMcpHealthContext();
  if (!report || report.verdict !== "auth-required" || !report.authChallenge) {
    return null;
  }
  const challenge = report.authChallenge;
  const as = challenge.authorizationServer;
  return (
    <blockquote>
      <p>
        <strong>Authentication required.</strong>{" "}
        {challenge.mechanism === "oauth"
          ? "This server uses OAuth-based MCP authentication."
          : challenge.mechanism === "bearer-static"
            ? "This server expects a static Bearer token in the Authorization header."
            : "This server returned 401 without a parseable challenge — try adding an Authorization header."}
      </p>
      {as && (
        <p>
          Authorization server: <code>{as}</code>{" "}
          <a href={originOf(as)} target="_blank" rel="noreferrer noopener">
            (open ↗)
          </a>
        </p>
      )}
      {challenge.scopes && challenge.scopes.length > 0 && (
        <p>
          Scopes: <code>{challenge.scopes.join(" ")}</code>
        </p>
      )}
    </blockquote>
  );
}

export function DetailsButtonLink() {
  const { report, id } = useMcpHealthContext();
  if (!report || !id) return null;
  return (
    <Button
      variant="default"
      className="h-auto! flex-1 rounded-none p-4 text-base"
      asChild
    >
      <Link
        href={`/play/mcp-health/${id}`}
        className="text-background! w-full no-underline!"
      >
        Share this report
      </Link>
    </Button>
  );
}

export function ToolsTable() {
  const { report } = useMcpHealthContext();
  if (!report?.toolsList.tools || report.toolsList.tools.length === 0) {
    return null;
  }
  return (
    <ToolsTableView
      tools={report.toolsList.tools}
      total={report.toolsList.toolCount}
      truncated={report.toolsList.truncated}
    />
  );
}

export function ToolsTableView({
  tools,
  total,
  truncated,
}: {
  tools: ToolInfo[];
  total?: number;
  truncated?: boolean;
}) {
  if (tools.length === 0) return null;
  return (
    <div>
      {tools.map((t) => {
        const hints = annotationHints(t.annotations);
        return (
          <details key={t.name}>
            <summary>
              {t.name}
              {t.title ? (
                <span className="text-muted-foreground"> — {t.title}</span>
              ) : null}
            </summary>
            <p>{t.description ?? "—"}</p>
            {hints.length > 0 && (
              <ul className="text-muted-foreground text-sm">
                {hints.map((h: string) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
      <p className="text-muted-foreground text-sm">
        {truncated
          ? `Showing first ${tools.length} of ${total ?? tools.length} tools`
          : `${tools.length} ${tools.length === 1 ? "tool" : "tools"}`}
      </p>
    </div>
  );
}

function stepDetailRows(
  stepKey: StepKey,
  report: HealthCheckReport,
): [string, string][] {
  if (stepKey === "initialize") {
    const init = report.initialize;
    const rows: [string, string][] = [];
    if (init.protocolVersion) rows.push(["Protocol", init.protocolVersion]);
    if (init.serverInfo) {
      rows.push([
        "Server",
        `${init.serverInfo.name}@${init.serverInfo.version}`,
      ]);
    }
    if (typeof init.hasSessionId === "boolean") {
      rows.push(["Session ID", init.hasSessionId ? "yes" : "no"]);
    }
    if (init.capabilities) {
      const keys = Object.keys(init.capabilities);
      if (keys.length > 0) rows.push(["Capabilities", keys.join(", ")]);
    }
    return rows;
  }
  if (stepKey === "toolsList") {
    const t = report.toolsList;
    const rows: [string, string][] = [];
    if (typeof t.toolCount === "number") {
      rows.push(["Tools", String(t.toolCount)]);
    }
    if (t.truncated) rows.push(["Truncated", "yes"]);
    return rows;
  }
  return [];
}

function annotationHints(ann: ToolInfo["annotations"]): string[] {
  if (!ann) return [];
  const hints: string[] = [];
  if (ann.readOnlyHint === true) hints.push("read-only");
  if (ann.destructiveHint === true) hints.push("destructive");
  if (ann.idempotentHint === true) hints.push("idempotent");
  if (ann.openWorldHint === true) hints.push("open-world");
  return hints;
}

type StepRow = {
  key: "initialize" | "ping" | "toolsList";
  label: string;
  step: StepResult;
  note: string | null;
};

function toStepRows(report: HealthCheckReport): StepRow[] {
  return [
    {
      key: "initialize",
      label: "1. initialize",
      step: report.initialize,
      note: noteFor(report.initialize, {
        protocol: report.initialize.protocolVersion,
      }),
    },
    {
      key: "ping",
      label: "2. ping",
      step: report.ping,
      note: noteFor(report.ping),
    },
    {
      key: "toolsList",
      label: "3. tools/list",
      step: report.toolsList,
      note:
        noteFor(report.toolsList) ??
        (typeof report.toolsList.toolCount === "number"
          ? `${report.toolsList.toolCount} ${report.toolsList.toolCount === 1 ? "tool" : "tools"}`
          : null),
    },
  ];
}

function noteFor(
  step: StepResult,
  extras?: { protocol?: string },
): string | null {
  if (step.error) return step.error.code;
  if (extras?.protocol) return `protocol ${extras.protocol}`;
  return null;
}

const EMPTY_STEPS: StepRow[] = [
  {
    key: "initialize",
    label: "1. initialize",
    step: { ok: false, latencyMs: 0 },
    note: null,
  },
  {
    key: "ping",
    label: "2. ping",
    step: { ok: false, latencyMs: 0 },
    note: null,
  },
  {
    key: "toolsList",
    label: "3. tools/list",
    step: { ok: false, latencyMs: 0 },
    note: null,
  },
];

function statusDotLabel(input: boolean | null | StepResult): string {
  if (input === null) return "not run";
  if (typeof input === "boolean") return input ? "ok" : "failed";
  if (input.ok) return "ok";
  return input.error?.code ?? "failed";
}

function StatusDot({ input }: { input: boolean | null | StepResult }) {
  const label = statusDotLabel(input);
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn("size-4", statusDotClass(input))}
    />
  );
}

export function VerdictBar() {
  const { report } = useMcpHealthContext();
  if (!report) return <VerdictLegend />;
  return <VerdictBarStatic report={report} />;
}

export function VerdictBarStatic({ report }: { report: HealthCheckReport }) {
  return (
    <div className="flex flex-wrap gap-2">
      <VerdictLegend />
      {report.initialize.serverInfo && (
        <span className="text-muted-foreground">
          · {report.initialize.serverInfo.name}@
          {report.initialize.serverInfo.version}
        </span>
      )}
      {report.initialize.protocolVersion && (
        <span className="text-muted-foreground">
          · protocol {report.initialize.protocolVersion}
        </span>
      )}
      {typeof report.toolsList.toolCount === "number" && (
        <span className="text-muted-foreground">
          · {report.toolsList.toolCount}{" "}
          {report.toolsList.toolCount === 1 ? "tool" : "tools"}
        </span>
      )}
    </div>
  );
}

export function VerdictLegend() {
  const verdicts: HealthCheckReport["verdict"][] = [
    "healthy",
    "partial",
    "auth-required",
    "unreachable",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {verdicts.map((v) => (
        <div
          key={v}
          className={cn("text-background text-base", VERDICT_DOT[v])}
        >
          {VERDICT_LABEL[v]}
        </div>
      ))}
    </div>
  );
}
