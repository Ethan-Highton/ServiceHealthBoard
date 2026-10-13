// Restart actions. To support a new kind of restart, add a function to `restarters`
// and use its name as restart.type in config/services.json.
// Each returns { ok: boolean, message: string }.
import { spawn } from "node:child_process";
import { powershell, expandEnv } from "./run.mjs";

const NEEDS_ADMIN = /access is denied|cannot open .* service|requires elevation|PermissionDenied/i;

function failure(result, what) {
  const text = `${result.stderr}\n${result.stdout}`;
  if (NEEDS_ADMIN.test(text)) {
    return { ok: false, message: `${what} needs administrator rights, which this board doesn't have. Restart it from the PC.` };
  }
  if (result.timedOut) return { ok: false, message: `${what} took too long.` };
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) || "Unknown error";
  return { ok: false, message: `${what} failed: ${first}` };
}

const restarters = {
  async "windows-service"({ name }) {
    const script =
      "$s=Get-Service -Name $env:SVC -ErrorAction Stop; if ($s.Status -eq 'Running') { Restart-Service -InputObject $s -Force -ErrorAction Stop } else { Start-Service -InputObject $s -ErrorAction Stop }";
    const result = await powershell(script, { SVC: name }, { timeout: 45000 });
    return result.ok ? { ok: true, message: "Restarted." } : failure(result, "Restarting the service");
  },

  async task({ task, stopMatch }) {
    const script = [
      "if ($env:STOP) { Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*'+$env:STOP+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }",
      "Start-ScheduledTask -TaskName $env:TASK -ErrorAction Stop",
    ].join("; ");
    const result = await powershell(script, { TASK: task, STOP: stopMatch || "" }, { timeout: 30000 });
    return result.ok ? { ok: true, message: "Restarted." } : failure(result, "Restarting the task");
  },

  async process({ stopNames = [], start }) {
    if (stopNames.length) {
      const script = "$env:NAMES -split ',' | ForEach-Object { Stop-Process -Name $_ -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1";
      await powershell(script, { NAMES: stopNames.join(",") });
    }
    if (!start?.command) return { ok: true, message: "Stopped." };
    try {
      const child = spawn(expandEnv(start.command), (start.args || []).map(expandEnv), {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", () => {});
      child.unref();
      return { ok: true, message: "Restarted." };
    } catch (error) {
      return { ok: false, message: `Could not start it: ${error.message}` };
    }
  },
};

export async function restartService(service) {
  const restarter = restarters[service.restart?.type];
  if (!restarter) return { ok: false, message: "This service has no restart set up." };
  return restarter(service.restart);
}
