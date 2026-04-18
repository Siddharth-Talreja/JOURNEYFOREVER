/* api.js — JourneyForever backend client */
const BASE = "http://localhost:3001/api";

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const API = {
  // Itineraries
  listItineraries:   ()       => req("GET",    "/itineraries"),
  getItinerary:      (id)     => req("GET",    `/itineraries/${id}`),
  saveItinerary:     (data)   => req("POST",   "/itineraries", data),
  updateItinerary:   (id, d)  => req("PUT",    `/itineraries/${id}`, d),
  deleteItinerary:   (id)     => req("DELETE", `/itineraries/${id}`),
  saveDayAISummary:  (id, day, summary) =>
                       req("PATCH", `/itineraries/${id}/day/${day}/ai-summary`, { summary }),

  // Gemini — core
  generateItinerary: ({ destName, country, days, travelers, budget }) =>
                       req("POST", "/gemini/generate-itinerary", { destName, country, days, travelers, budget }),
  getDayNarrative:   (destName, country, day, theme, activities) =>
                       req("POST", "/gemini/day-narrative", { destName, country, day, theme, activities }),
  destinationSearch: (query) =>
                       req("POST", "/gemini/destination-search", { query }),
  getPackingList:    (destinations, totalDays, budget) =>
                       req("POST", "/gemini/packing-list", { destinations, totalDays, budget }),
  getTripTitle:      (destinations, travelers, budget) =>
                       req("POST", "/gemini/trip-title", { destinations, travelers, budget }),

  // PDF
  exportPDF: async (id) => {
    const res = await fetch(`${BASE}/pdf/${id}`, { method: "POST" });
    if (!res.ok) throw new Error("PDF export failed");
    return res.blob();
  },
};
