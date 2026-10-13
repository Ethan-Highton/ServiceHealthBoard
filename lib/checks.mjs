// Health checks. To support a new kind of check, add one function to `checkers`
// and use its name as "type" in config/services.json. Each returns
// { status: "up" | "down" | "unknown", detail?: string }.
import { run, powershell } from "./run.mjs";

const SERVICE_STATES = {
  RUNNING: "up",
  START_PENDING: "up",
  STOPPED: "down",
  STOP_PENDING: "down",
  PAUSED: "down",
};

export function parseScQuery(text) {
  const match = /STATE\s*:\s*\d+\s+(\w+)/.exec(text);
  return match ? match[1] : null;
}

const checkers = {
  async "windows-service"({ name }) {
    const result = await run("sc.exe", ["query", name]);
    const state = parseScQuery(result.stdout);
    if (!state) {
      return /1060/.test(result.stdout)
        ? { status: "down", detail: "Not installed" }
        : { status: "unknown", detail: "Could not read the service state" };
    }
    return { status: SERVICE_STATES[state] ?? "unknown", detail: state.toLowerCase().replace("_", " ") };
  },

  async process({ match }) {
    const script =
      "$m=$env:MATCH; $n=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*'+$m+'*') }).Count; Write-Output $n";
    const result = await powershell(script, { MATCH: match });
    const count = Number.parseInt(result.stdout.trim(), 10);
    if (!result.ok || Number.isNaN(count)) return { status: "unknown", detail: "Could not look at running programs" };
    return count > 0 ? { status: "up", detail: "Running" } : { status: "down", detail: "Not running" };
  },

  async http({ url, detail, expectStatus = 200, timeoutMs = 3000 }) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status !== expectStatus) return { status: "down", detail: `Answered with ${response.status}` };
      if (detail === "ollama-models") {
        const body = await response.json();
        const names = (body.models || []).map((m) => m.name);
        return { status: "up", detail: names.length ? `Models: ${names.join(", ")}` : "Running, no models installed" };
      }
      return { status: "up", detail: "Answering" };
    } catch {
      return { status: "down", detail: "Not answering" };
    }
  },
};

export async function checkService(service) {
  const checker = checkers[service.check?.type];
  const base = { id: service.id, name: service.name, description: service.description ?? "", canRestart: Boolean(service.restart), restartWarning: service.restart?.warning ?? "" };
  if (!checker) return { ...base, status: "unknown", detail: `Unknown check type "${service.check?.type}"`, checkedAt: Date.now() };
  try {
    return { ...base, ...(await checker(service.check)), checkedAt: Date.now() };
  } catch (error) {
    return { ...base, status: "unknown", detail: error.message, checkedAt: Date.now() };
  }
}
