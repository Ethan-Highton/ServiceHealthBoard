import { startClock } from "./clock.js";

const REFRESH_MS = 10000;
const LABELS = { up: "Running", down: "Stopped", unknown: "Unknown" };

const list = document.getElementById("list");
const summary = document.getElementById("summary");
const updated = document.getElementById("updated");
const refreshButton = document.getElementById("refresh");
const dialog = document.getElementById("confirm");
const toast = document.getElementById("toast");
const lastStatus = new Map();

startClock(document.getElementById("clock"));

let services = [];
let busy = new Set();
let timer = null;
let toastTimer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  list.replaceChildren(
    ...services.map((s) => {
      const item = el("div", "item");
      const main = el("div", "item-main");
      main.append(el("div", "t", s.name));
      if (s.description) main.append(el("div", "meta", s.description));
      if (s.detail && !["running", "stopped"].includes(s.detail.toLowerCase())) main.append(el("div", "detail", s.detail));

      const side = el("div", "item-side");
      const changed = lastStatus.has(s.id) && lastStatus.get(s.id) !== s.status;
      lastStatus.set(s.id, s.status);
      side.append(el("span", `flap ${s.status}${changed ? " flip" : ""}`, LABELS[s.status] ?? s.status));
      if (s.canRestart) {
        const button = el("button", "", busy.has(s.id) ? "Restarting…" : s.status === "down" ? "Start" : "Restart");
        button.type = "button";
        button.disabled = busy.has(s.id);
        button.addEventListener("click", () => askRestart(s));
        side.append(button);
      }
      item.append(main, side);
      const row = el("li", "");
      row.append(item);
      return row;
    })
  );

  const down = services.filter((s) => s.status !== "up").length;
  summary.textContent = !services.length
    ? "No services set up."
    : down === 0
      ? "Everything is running."
      : `${down} of ${services.length} not running.`;
  summary.classList.toggle("bad", down > 0);
  if (services.length) updated.textContent = `Updated ${new Date().toLocaleTimeString()}.`;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 5000);
}

async function load() {
  try {
    const response = await fetch("api/services", { cache: "no-store" });
    if (!response.ok) throw new Error(`Server answered ${response.status}`);
    services = (await response.json()).services;
    render();
  } catch {
    summary.textContent = "Can't reach the board. Is the PC on and Tailscale connected?";
    summary.classList.add("bad");
  }
}

function askRestart(service) {
  document.getElementById("confirm-title").textContent = `${service.status === "down" ? "Start" : "Restart"} ${service.name}?`;
  document.getElementById("confirm-text").textContent = service.restartWarning || "This usually takes a few seconds.";
  dialog.returnValue = "cancel";
  dialog.addEventListener("close", () => dialog.returnValue === "ok" && restart(service), { once: true });
  dialog.showModal();
}

async function restart(service) {
  busy.add(service.id);
  render();
  try {
    const response = await fetch(`api/services/${encodeURIComponent(service.id)}/restart`, { method: "POST" });
    const result = await response.json();
    showToast(result.message || (response.ok ? "Done." : "That didn't work."));
  } catch {
    showToast("Lost contact with the PC. If you restarted Tailscale, wait a moment and refresh.");
  } finally {
    busy.delete(service.id);
    await load();
  }
}

function schedule() {
  clearInterval(timer);
  if (!document.hidden) timer = setInterval(load, REFRESH_MS);
}

refreshButton.addEventListener("click", load);
document.addEventListener("visibilitychange", () => {
  schedule();
  if (!document.hidden) load();
});

load();
schedule();
