# Service Health Board

A phone-friendly page that shows whether the PC's key background tools are running (green or red) and lets you restart each one with a button. Opened over Tailscale, so it works from anywhere your phone is connected.

It is item 3 of the phone-to-PC tool backlog.

## What it watches

| Service | How it is checked | How it is restarted |
|---|---|---|
| Tailscale | Windows service state | Restart-Service (needs admin, see below) |
| Claude Remote Control | A running `claude … remote-control` process | Stops it, then starts the `ClaudeRemoteControl` scheduled task |
| Local AI (Ollama, Qwen) | `http://127.0.0.1:11434/api/tags` answers; lists installed models | Stops Ollama, starts `ollama.exe serve` hidden |

The page refreshes every 10 seconds while it is on screen. A confirmation box appears before any restart, with a warning where a restart has side effects (for example, restarting Tailscale drops your phone's connection for a few seconds).

## Run it

Needs Node 18 or newer. No packages to install.

```
node server.mjs
```

It listens on the Tailscale address from `config/services.json` (`100.105.214.97:8095`). Override with `HOST` and `PORT` environment variables, for example `HOST=127.0.0.1 node server.mjs` to try it on the PC alone.

Tests: `npm test`.

### Administrator rights

The board runs as your normal user. Restarting the `Tailscale` Windows service needs administrator rights, so its button will report "needs administrator rights" and tell you to do it from the PC. Remote Control and Ollama restart fine without it. If you later want the phone to restart Tailscale as well, the usual route is a one-time scheduled task set to run with highest privileges, which a new restart type can trigger.

## Adding or changing a service

Edit `config/services.json`. It is re-read on every request, so changes show up on the next refresh with no server restart. Each entry has:

- `id`, `name`, `description`: what the card shows.
- `check`: `{ "type": "windows-service", "name": "…" }`, `{ "type": "process", "match": "text in the command line" }` or `{ "type": "http", "url": "…" }`.
- `restart` (optional; leave it out for a status-only card): `{ "type": "windows-service", "name": "…" }`, `{ "type": "task", "task": "…", "stopMatch": "…" }` or `{ "type": "process", "stopNames": […], "start": { "command": "…", "args": […] } }`. An optional `warning` is shown in the confirmation box.

A new kind of check or restart is one small function in `lib/checks.mjs` or `lib/actions.mjs`, keyed by its `type`.

## How it is served and shown in the library

The app has its own server on port 8095, bound to the Tailscale IP only (never the public internet). It appears in the WebAppLib library through a registry entry in `config/apps.json` (`url` `http://100.105.214.97:8095/`). The page loads `js/backlink.js` (a copy of the library's back bar) so a "‹ Library" link shows at the top.

## Safety

- Only the services listed in `config/services.json` can be checked or restarted; the page cannot run arbitrary commands.
- Restarts are POST only and refused if the request comes from another site's origin.
- Values go to PowerShell through environment variables, never pasted into script text.
- Only `index.html`, `css/` and `js/` are served; the config and server code are not.

## Data

None. The board keeps no data of its own, so there is nothing to back up beyond this repo (including `config/services.json`).

## Folder layout

```
server.mjs            HTTP server and API
start-hidden.vbs      starts run-loop.ps1 with no window (used by the login task)
run-loop.ps1          keeps the server running, restarting it if it exits
config/services.json  host, port and the list of services
lib/checks.mjs        health checks (one function per check type)
lib/actions.mjs       restart actions (one function per restart type)
lib/run.mjs           helpers for running Windows commands safely
index.html            the page
css/                  tokens, base, layout and components styles (same dark "departures board" look as the other library apps)
js/app.js             page logic
js/clock.js           split-flap clock in the top bar
js/backlink.js        "‹ Library" back bar (copy from WebAppLib)
tests/                node:test unit tests
```

## API

- `GET /api/services` returns the status of every service.
- `POST /api/services/<id>/restart` restarts one and returns the result plus its fresh status.

## Stack

Plain Node (ES modules, no dependencies) on the server; plain HTML, CSS and JavaScript on the page, styled to match the rest of the library (dark, Bahnschrift, amber accent).

## Start at login

A scheduled task named `ServiceHealthBoard` runs `start-hidden.vbs` (no window) when you log in. That starts `run-loop.ps1`, which keeps the server running and starts it again 10 seconds after it exits (for example when Tailscale is not connected yet at login). The log is `%LOCALAPPDATA%service-health-boardoard.log`. Check or control the task with `Get-ScheduledTask ServiceHealthBoard`, `Start-ScheduledTask ServiceHealthBoard` and `Stop-ScheduledTask ServiceHealthBoard` (stopping the task does not stop a loop that is already running; end its `powershell` and `node` processes).

```
$a = New-ScheduledTaskAction -Execute wscript.exe -Argument '"C:\Users\Desktop\Documents\ServiceHealthBoard\start-hidden.vbs"'
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask ServiceHealthBoard -Action $a -Trigger $t -Settings $s
```
