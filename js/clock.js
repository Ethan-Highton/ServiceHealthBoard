// Split-flap clock in the top bar, like the other library apps.
let key = "";

export function startClock(el) {
  function tick() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const text = `${String(h).padStart(2, " ")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (text === key) return;
    const prev = key;
    key = text;
    el.replaceChildren(
      ...[...text].map((c, i) => {
        const span = document.createElement("span");
        span.className = c === ":" ? "colon" : `digit${prev && prev[i] !== c ? " flip" : ""}`;
        span.textContent = c === " " ? "" : c;
        return span;
      })
    );
    const ampm = document.createElement("span");
    ampm.className = "digit ampm";
    ampm.textContent = d.getHours() < 12 ? "AM" : "PM";
    el.append(ampm);
  }
  tick();
  setInterval(tick, 1000);
}
