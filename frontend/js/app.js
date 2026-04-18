/* app.js — JourneyForever | Full AI-driven itinerary planner */
import { API }  from "../../frontend/js/api.js";
import {
  ACTIVITY_ICONS, CATEGORY_ICONS,
  BUDGET_RATES, BUDGET_LABELS,
  SUGGESTED_DESTINATIONS, formatINR,
} from "../../frontend/js/data.js";

// ══ State ════════════════════════════════════════════════════════════════════
const S = {
  step:        "home",
  destinations: [],   // [{ destName, country, emoji, color, days, overview, generatedDays[] }]
  itinerary:   null,  // saved MongoDB doc
  activeDay:   1,
  travelers:   2,
  budget:      "mid",
  title:       "",
  searchResults: [],
};

// ══ Shortcuts ════════════════════════════════════════════════════════════════
const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

const totalDays = () => S.destinations.reduce((a, d) => a + (d.days || 3), 0);
const totalCost = () => totalDays() * S.travelers * BUDGET_RATES[S.budget];

// ══ Toast ════════════════════════════════════════════════════════════════════
let _tt;
function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg; el.className = `show ${type}`;
  clearTimeout(_tt); _tt = setTimeout(() => el.className = "", 3400);
}

function showOverlay(v) { $("#overlay").classList.toggle("show", v); }

// ══ Navigation ═══════════════════════════════════════════════════════════════
const STEPS = ["home", "search", "configure", "view"];

function goTo(step) {
  const wrap = $(".page-wrap");
  wrap?.classList.remove("in");
  setTimeout(() => {
    $$(".screen").forEach(s => s.classList.remove("visible"));
    S.step = step;
    updateNav();
    renderStep();
    $(`#screen-${step}`)?.classList.add("visible");
    requestAnimationFrame(() => requestAnimationFrame(() => wrap?.classList.add("in")));
  }, 60);
}

function updateNav() {
  const idx = STEPS.indexOf(S.step);
  $$(".step-bar").forEach((el, i) => el.classList.toggle("active", i <= idx));
  $$(".step-lbl").forEach((el, i) => el.classList.toggle("active", i <= idx));
}

function renderStep() {
  ({ home: renderHome, search: renderSearch, configure: renderConfigure, view: renderView })[S.step]?.();
}

// ══ HOME ═════════════════════════════════════════════════════════════════════
function renderHome() {
  const c = $("#floating-cards");
  c.innerHTML = "";
  // Show first 8 suggested destinations — Rajasthan is always first (index 0)
  SUGGESTED_DESTINATIONS.slice(0, 8).forEach((d) => {
    const div = document.createElement("div");
    div.className = "float-card";
    div.title = d.blurb;
    div.innerHTML = `
      <img src="${d.img}" alt="${d.destName}" loading="lazy">
      <div class="ov" style="background:linear-gradient(to top,${d.color}dd 10%,transparent 65%)"></div>
      <div class="lbl">
        <span style="font-size:16px">${d.emoji}</span>
        <span>${d.destName}</span>
      </div>`;
    div.style.cursor = "pointer";
    div.addEventListener("click", () => {
      addDestination({ ...d, days: 3 });
      goTo("search");
    });
    c.appendChild(div);
  });
}

// ══ SAVED PANEL ══════════════════════════════════════════════════════════════
async function openSavedPanel() {
  $("#saved-panel").classList.add("open");
  const list = $("#saved-list");
  list.innerHTML = `<div class="saved-empty">Loading…</div>`;
  try {
    const items = await API.listItineraries();
    if (!items.length) { list.innerHTML = `<div class="saved-empty">No saved itineraries yet.</div>`; return; }
    list.innerHTML = "";
    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "saved-item";
      const dests = (it.destinations || []).map(d => (d.emoji || "✈️") + " " + d.destName).join(" · ") || "—";
      row.innerHTML = `
        <div style="font-size:24px">${it.destinations?.[0]?.emoji || "✈️"}</div>
        <div style="flex:1">
          <div class="si-title">${it.title}</div>
          <div class="si-meta">${it.totalDays} days · ${it.travelers} traveler${it.travelers > 1 ? "s" : ""} · ${BUDGET_LABELS[it.budget] || it.budget} · ${formatINR(it.totalCost || 0)}<br>${dests}</div>
        </div>
        <button class="si-del" data-id="${it._id}">✕</button>`;
      row.addEventListener("click", async (e) => {
        if (e.target.classList.contains("si-del")) return;
        $("#saved-panel").classList.remove("open");
        await loadSaved(it._id);
      });
      row.querySelector(".si-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        await API.deleteItinerary(it._id);
        row.remove();
        toast("Deleted");
        if (!list.querySelector(".saved-item")) list.innerHTML = `<div class="saved-empty">No saved itineraries yet.</div>`;
      });
      list.appendChild(row);
    });
  } catch(e) { list.innerHTML = `<div class="saved-empty">Error: ${e.message}</div>`; }
}

async function loadSaved(id) {
  showOverlay(true);
  try {
    const doc = await API.getItinerary(id);
    S.itinerary   = doc;
    S.destinations = doc.destinations;
    S.travelers   = doc.travelers;
    S.budget      = doc.budget;
    S.title       = doc.title;
    S.activeDay   = 1;
    goTo("view");
    toast("Itinerary loaded ✓", "success");
  } catch(e) { toast("Failed: " + e.message, "error"); }
  finally { showOverlay(false); }
}

// ══ SEARCH / ADD DESTINATIONS ═════════════════════════════════════════════════
function renderSearch() {
  renderSearchDestList();
  renderSuggestedChips();
}

function renderSearchDestList() {
  // Show added destinations at the top
  const container = $("#added-destinations");
  if (!container) return;
  container.innerHTML = "";

  if (S.destinations.length === 0) {
    container.innerHTML = `<p class="added-empty">No destinations added yet. Search below or pick a suggestion.</p>`;
    return;
  }

  S.destinations.forEach((d, idx) => {
    const card = document.createElement("div");
    card.className = "added-dest-card";
    card.style.borderColor = d.color || "#E8A87C";
    card.innerHTML = `
      <div class="adc-left">
        <span class="adc-emoji">${d.emoji || "✈️"}</span>
        <div>
          <div class="adc-name">${d.destName}</div>
          <div class="adc-country">${d.country}</div>
          ${d.overview ? `<div class="adc-overview">${d.overview}</div>` : ""}
        </div>
      </div>
      <div class="adc-right">
        <div class="adc-days-ctrl">
          <button class="days-btn" data-idx="${idx}" data-op="dec">−</button>
          <span class="days-val">${d.days || 3} days</span>
          <button class="days-btn" data-idx="${idx}" data-op="inc">+</button>
        </div>
        <button class="adc-remove" data-idx="${idx}">✕ Remove</button>
      </div>`;
    container.appendChild(card);
  });

  // Days +/- controls
  container.querySelectorAll(".days-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const op  = btn.dataset.op;
      const d   = S.destinations[idx];
      if (op === "inc") d.days = Math.min(14, (d.days || 3) + 1);
      if (op === "dec") d.days = Math.max(1,  (d.days || 3) - 1);
      renderSearchDestList();
    });
  });

  container.querySelectorAll(".adc-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      S.destinations.splice(+btn.dataset.idx, 1);
      renderSearchDestList();
      updateSearchContinueBtn();
    });
  });

  updateSearchContinueBtn();
}

function renderSuggestedChips() {
  const chips = $("#suggested-chips");
  if (!chips) return;
  chips.innerHTML = "";
  SUGGESTED_DESTINATIONS.forEach(d => {
    const already = S.destinations.some(x => x.destName === d.destName);
    const chip = document.createElement("button");
    chip.className = `sugg-chip${already ? " added" : ""}`;
    chip.innerHTML = `${d.emoji} ${d.destName}`;
    chip.title = d.blurb;
    chip.disabled = already || S.destinations.length >= 4;
    chip.addEventListener("click", () => addDestination({ ...d, days: 3, color: "#E8A87C" }));
    chips.appendChild(chip);
  });
}

function updateSearchContinueBtn() {
  const btn = $("#btn-continue-search");
  if (btn) btn.disabled = S.destinations.length === 0;
}

async function doSearch(query) {
  if (!query.trim()) return;
  const resultsEl = $("#search-results");
  resultsEl.innerHTML = `<div class="search-loading">✦ Searching…</div>`;

  try {
    const results = await API.destinationSearch(query);
    S.searchResults = results;
    resultsEl.innerHTML = "";

    if (!results.length) {
      resultsEl.innerHTML = `<div class="search-loading">No results found. Try a different query.</div>`;
      return;
    }

    results.forEach(r => {
      const already = S.destinations.some(x => x.destName === r.destName);
      const row = document.createElement("div");
      row.className = `search-result-row${already ? " added" : ""}`;
      row.innerHTML = `
        <span class="sr-emoji">${r.emoji}</span>
        <div class="sr-info">
          <div class="sr-name">${r.destName}, ${r.country}</div>
          <div class="sr-blurb">${r.blurb}</div>
        </div>
        <button class="sr-add" ${already || S.destinations.length >= 4 ? "disabled" : ""}>
          ${already ? "Added ✓" : "+ Add"}
        </button>`;
      row.querySelector(".sr-add").addEventListener("click", () => {
        addDestination({ ...r, days: 3, color: "#E8A87C" });
        resultsEl.innerHTML = "";
        $("#search-input").value = "";
      });
      resultsEl.appendChild(row);
    });
  } catch(e) {
    resultsEl.innerHTML = `<div class="search-loading">Error: ${e.message}</div>`;
  }
}

function addDestination(dest) {
  if (S.destinations.length >= 4) { toast("Max 4 destinations", "error"); return; }
  if (S.destinations.some(d => d.destName === dest.destName)) { toast("Already added", "error"); return; }
  S.destinations.push({ ...dest, days: dest.days || 3 });
  renderSearchDestList();
  renderSuggestedChips();
  toast(`${dest.emoji} ${dest.destName} added`, "success");
}

// ══ CONFIGURE ════════════════════════════════════════════════════════════════
function renderConfigure() {
  // Destination summary tags
  const tags = $("#cfg-dest-tags");
  tags.innerHTML = S.destinations.map(d =>
    `<div class="dest-tag" style="background:${d.color || '#E8A87C'}22;border:1px solid ${d.color || '#E8A87C'}55">
      ${d.emoji || "✈️"} ${d.destName} <span style="color:${d.color || '#E8A87C'};font-size:11px">${d.days}d</span>
    </div>`
  ).join("");

  $("#cfg-sub").textContent = `${totalDays()} total days across ${S.destinations.length} destination${S.destinations.length > 1 ? "s" : ""}`;

  renderTravelers();
  renderBudget();
  renderEstimate();

  const ti = $("#trip-title-input");
  if (ti) ti.value = S.title || S.destinations.map(d => d.destName).join(" · ");
}

function renderTravelers() {
  const row = $("#traveler-row");
  row.innerHTML = "";
  [1,2,3,4,5,6].forEach(n => {
    const b = document.createElement("button");
    b.className = `trav-btn${S.travelers === n ? " active" : ""}`;
    b.textContent = n;
    b.addEventListener("click", () => { S.travelers = n; renderTravelers(); renderEstimate(); });
    row.appendChild(b);
  });
}

function renderBudget() {
  const BUDS = [
    { id:"budget", label:"Budget",    icon:"🎒", sub:"~₹3,500/day"  },
    { id:"mid",    label:"Mid-Range", icon:"✈️", sub:"~₹8,500/day"  },
    { id:"luxury", label:"Luxury",    icon:"💎", sub:"~₹25,000/day" },
  ];
  const row = $("#budget-row");
  row.innerHTML = "";
  BUDS.forEach(b => {
    const btn = document.createElement("button");
    btn.className = `bud-btn${S.budget === b.id ? " active" : ""}`;
    btn.innerHTML = `<div class="bud-icon">${b.icon}</div><div class="bud-name">${b.label}</div><div class="bud-rate">${b.sub}</div>`;
    btn.addEventListener("click", () => { S.budget = b.id; renderBudget(); renderEstimate(); });
    row.appendChild(btn);
  });
}

function renderEstimate() {
  const el = $("#estimate-amount");
  const mt = $("#estimate-meta");
  if (el) el.textContent = formatINR(totalCost());
  if (mt) mt.innerHTML   = `<div>${totalDays()} days</div><div>${S.travelers} traveler${S.travelers > 1 ? "s" : ""}</div><div>Approx. estimate</div>`;
}

// ══ GENERATE + SAVE ═══════════════════════════════════════════════════════════
async function generateAndSave() {
  if (!S.destinations.length) return;
  showOverlay(true);

  try {
    // 1. For each destination, call Gemini to generate the full itinerary
    toast("✦ Generating itinerary with Gemini…");

    const enrichedDests = [];
    for (const dest of S.destinations) {
      const result = await API.generateItinerary({
        destName:  dest.destName,
        country:   dest.country,
        days:      dest.days,
        travelers: S.travelers,
        budget:    S.budget,
      });

      enrichedDests.push({
        ...dest,
        emoji:    result.emoji    || dest.emoji    || "✈️",
        color:    result.color    || dest.color    || "#E8A87C",
        overview: result.overview || dest.overview || "",
        generatedDays: result.days || [],
      });
    }

    S.destinations = enrichedDests;

    // 2. Flatten all days into one numbered sequence
    const allDays = [];
    let dayCount = 0;
    enrichedDests.forEach(dest => {
      (dest.generatedDays || []).forEach(d => {
        dayCount++;
        allDays.push({
          day:         dayCount,
          localDay:    d.day,
          theme:       d.theme        || "",
          destName:    dest.destName,
          destCountry: dest.country,
          destEmoji:   dest.emoji,
          destColor:   dest.color,
          destImg:     `https://source.unsplash.com/800x400/?${encodeURIComponent(dest.destName)},travel`,
          activities:  d.activities   || [],
          accommodation: d.accommodation || "",
          localTip:    d.localTip     || "",
          aiSummary:   null,
        });
      });
    });

    // 3. Read the title
    const titleEl = $("#trip-title-input");
    S.title = titleEl?.value?.trim() || S.destinations.map(d => d.destName).join(" · ");

    // 4. Save to MongoDB
    const payload = {
      title:        S.title,
      travelers:    S.travelers,
      budget:       S.budget,
      totalCost:    totalCost(),
      totalDays:    dayCount,
      destinations: S.destinations.map(d => ({
        id:      d.id || Date.now(),
        destName: d.destName,
        country:  d.country,
        emoji:    d.emoji,
        color:    d.color,
        days:     d.days,
        overview: d.overview,
      })),
      days: allDays,
    };

    const doc = await API.saveItinerary(payload);
    S.itinerary = doc;
    S.activeDay = 1;

    toast("Itinerary ready ✓", "success");
    goTo("view");
  } catch(e) {
    toast("Error: " + e.message, "error");
    console.error(e);
  } finally {
    showOverlay(false);
  }
}

// ══ ITINERARY VIEW ════════════════════════════════════════════════════════════
function renderView() {
  renderSidebar();
  renderDayContent();
}

function renderSidebar() {
  const body = $("#sidebar-body");
  body.innerHTML = "";

  const days  = S.itinerary?.days || [];
  const dests = S.itinerary?.destinations || S.destinations;

  dests.forEach(dest => {
    const destDays = days.filter(d => d.destName === dest.destName);
    const sec = document.createElement("div");
    sec.className = "sb-dest";
    sec.innerHTML = `
      <div class="sb-dest-hdr">
        <span class="sb-emoji">${dest.emoji || "✈️"}</span>
        <div>
          <div class="sb-dname">${dest.destName}</div>
          <div class="sb-dmeta">${dest.country} · ${dest.days}d</div>
        </div>
      </div>`;
    destDays.forEach(d => {
      const btn = document.createElement("button");
      btn.className = `day-btn${S.activeDay === d.day ? " active" : ""}`;
      btn.style.cssText = S.activeDay === d.day
        ? `background:${dest.color}2a;border-color:${dest.color}55` : "";
      btn.innerHTML = `<span>Day ${d.day}</span><span class="sb-day-theme">${d.theme || dest.destName}</span>`;
      btn.addEventListener("click", () => { S.activeDay = d.day; renderSidebar(); renderDayContent(); });
      sec.appendChild(btn);
    });
    body.appendChild(sec);
  });
}

function renderDayContent() {
  const days = S.itinerary?.days || [];
  const day  = days.find(d => d.day === S.activeDay);
  if (!day) return;

  const td   = days.length;
  const main = $("#day-main");

  const actsHTML = day.activities.map(a => `
    <div class="act-card">
      <div class="act-icon" style="background:${day.destColor}22">
        ${ACTIVITY_ICONS[a.time] || "📍"}
        <span class="act-cat-badge">${CATEGORY_ICONS[a.category] || ""}</span>
      </div>
      <div>
        <div class="act-time" style="color:${day.destColor}">${a.time}</div>
        <div class="act-title">${a.title}</div>
        <div class="act-desc">${a.desc}</div>
      </div>
    </div>`).join("");

  const tipHTML = day.localTip
    ? `<div class="local-tip"><span>💡</span><span>${day.localTip}</span></div>` : "";

  const accomHTML = day.accommodation
    ? `<div class="accommodation">🏨 <strong>Stay in:</strong> ${day.accommodation}</div>` : "";

  const aiHTML = day.aiSummary
    ? `<div class="ai-block">
        <div class="ai-block-label">✦ AI Travel Narrative</div>
        <div class="ai-block-text">${day.aiSummary}</div>
       </div>`
    : `<div class="ai-block">
        <div class="ai-block-label">✦ AI Travel Narrative</div>
        <p style="font-family:var(--sans);font-size:13px;color:var(--fg-dim);margin-bottom:14px">
          Get a rich, magazine-style narrative for this day written by Gemini AI.
        </p>
        <button class="btn-load-ai" id="btn-load-ai">✦ Generate Narrative</button>
       </div>`;

  main.innerHTML = `
    <div class="day-eyebrow" style="color:${day.destColor}">
      Day ${day.day} of ${td} · ${day.destName}, ${day.destCountry}
    </div>
    <h2 class="day-title">${day.destEmoji || "✈️"} ${day.theme || "Day " + day.day}</h2>
    <p class="day-subtitle">Local day ${day.localDay} in ${day.destName}</p>

    <div class="dest-banner">
      <img src="${day.destImg}" alt="${day.destName}" onerror="this.style.background='#1a1a2e'">
      <div class="bov" style="background:linear-gradient(to right,${day.destColor}99,transparent)"></div>
      <div class="btxt">
        <div class="banner-name">${day.destName}</div>
        <div class="banner-country">${day.destCountry}</div>
      </div>
    </div>

    ${tipHTML}
    <div class="activities">${actsHTML}</div>
    ${accomHTML}
    ${aiHTML}

    <div class="day-nav">
      <button class="btn-ghost" id="btn-prev-day" ${S.activeDay === 1 ? "disabled" : ""}>← Previous Day</button>
      <span class="day-counter">${S.activeDay} / ${td}</span>
      <button class="${S.activeDay < td ? "btn-primary" : "btn-ghost"}" id="btn-next-day"
        style="${S.activeDay < td ? "padding:12px 32px;font-size:14px;" : "opacity:.28"}"
        ${S.activeDay >= td ? "disabled" : ""}>Next Day →</button>
    </div>`;

  $("#btn-prev-day")?.addEventListener("click", () => {
    if (S.activeDay > 1) { S.activeDay--; renderSidebar(); renderDayContent(); }
  });
  $("#btn-next-day")?.addEventListener("click", () => {
    if (S.activeDay < td) { S.activeDay++; renderSidebar(); renderDayContent(); }
  });
  $("#btn-load-ai")?.addEventListener("click", () => loadNarrative(day));
}

async function loadNarrative(day) {
  const block = $("#btn-load-ai")?.closest(".ai-block");
  if (!block) return;
  block.innerHTML = `
    <div class="ai-block-label">✦ AI Travel Narrative · Writing…</div>
    <div class="ai-block-skeleton">
      <div class="sk-line"></div><div class="sk-line"></div><div class="sk-line"></div>
    </div>`;
  try {
    const res = await API.getDayNarrative(day.destName, day.destCountry, day.day, day.theme, day.activities);
    if (S.itinerary?._id) {
      await API.saveDayAISummary(S.itinerary._id, day.day, res.narrative);
    }
    const local = S.itinerary?.days?.find(d => d.day === day.day);
    if (local) local.aiSummary = res.narrative;
    block.innerHTML = `
      <div class="ai-block-label">✦ AI Travel Narrative</div>
      <div class="ai-block-text">${res.narrative}</div>`;
    toast("Narrative generated ✓", "success");
  } catch(e) {
    block.innerHTML = `
      <div class="ai-block-label">✦ AI Travel Narrative</div>
      <button class="btn-load-ai" id="btn-load-ai">↻ Retry</button>`;
    $("#btn-load-ai")?.addEventListener("click", () => loadNarrative(day));
    toast("Gemini error: " + e.message, "error");
  }
}

// ══ PDF EXPORT ════════════════════════════════════════════════════════════════
async function exportPDF() {
  if (!S.itinerary?._id) { toast("Save your itinerary first", "error"); return; }
  const btn = $("#btn-export");
  btn?.classList.add("loading");
  if (btn) btn.innerHTML = "⏳ Generating…";
  try {
    const blob = await API.exportPDF(S.itinerary._id);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `${S.title || "itinerary"}.pdf` });
    a.click();
    URL.revokeObjectURL(url);
    toast("PDF downloaded ✓", "success");
  } catch(e) { toast("PDF failed: " + e.message, "error"); }
  finally { btn?.classList.remove("loading"); if (btn) btn.innerHTML = "📄 Export PDF"; }
}

// ══ AI TITLE ══════════════════════════════════════════════════════════════════
async function suggestTitle() {
  const btn = $("#btn-ai-title");
  if (!btn) return;
  btn.textContent = "✦ Thinking…"; btn.disabled = true;
  try {
    const res    = await API.getTripTitle(S.destinations, S.travelers, S.budget);
    const titles = res.titles || [];
    if (titles.length) {
      const pick = titles[Math.floor(Math.random() * titles.length)];
      $("#trip-title-input").value = pick;
      S.title = pick;
    }
  } catch(e) { toast("AI title error: " + e.message, "error"); }
  finally { btn.textContent = "✦ Suggest Title"; btn.disabled = false; }
}

// ══ BIND EVENTS ═══════════════════════════════════════════════════════════════
function bindEvents() {
  // Home
  $("#btn-start")?.addEventListener("click", () => goTo("search"));
  $("#btn-view-saved")?.addEventListener("click", openSavedPanel);
  $("#btn-close-saved")?.addEventListener("click", () => $("#saved-panel").classList.remove("open"));
  $("#saved-panel")?.addEventListener("click", e => {
    if (e.target === $("#saved-panel")) $("#saved-panel").classList.remove("open");
  });

  // Search screen
  let searchTimer;
  $("#search-input")?.addEventListener("input", e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { $("#search-results").innerHTML = ""; return; }
    searchTimer = setTimeout(() => doSearch(q), 500);
  });
  $("#search-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doSearch(e.target.value.trim());
  });
  $("#btn-back-home")?.addEventListener("click",   () => { S.destinations = []; goTo("home"); });
  $("#btn-continue-search")?.addEventListener("click", () => goTo("configure"));

  // Configure
  $("#btn-back-search")?.addEventListener("click", () => goTo("search"));
  $("#btn-generate")?.addEventListener("click",    generateAndSave);
  $("#btn-ai-title")?.addEventListener("click",    suggestTitle);
  $("#trip-title-input")?.addEventListener("input", e => S.title = e.target.value);

  // View
  $("#btn-new-trip")?.addEventListener("click", () => {
    S.destinations = []; S.itinerary = null; S.activeDay = 1; S.title = "";
    goTo("home");
  });
  $("#btn-export")?.addEventListener("click", exportPDF);
}

// ══ INIT ══════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  goTo("home");
});
