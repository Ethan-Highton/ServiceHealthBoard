// Small helpers for running Windows commands. Values reach PowerShell through
// environment variables, never by building script text, so config can't inject code.
import { execFile } from "node:child_process";

export function run(file, args, { env = {}, timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { env: { ...process.env, ...env }, timeout, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          timedOut: Boolean(error && error.killed),
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
        });
      }
    );
  });
}

export function powershell(script, env, opts) {
  return run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { env, ...opts }
  );
}

// "%LOCALAPPDATA%\x" -> real path
export function expandEnv(text) {
  return String(text).replace(/%(\w+)%/g, (whole, name) => process.env[name] ?? whole);
}
