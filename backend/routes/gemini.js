const express                = require("express");
const router                 = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function askGemini(prompt) {

  const model  = genAI.getGenerativeModel({ model: "gemma-3-1b-it" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── POST /api/gemini/generate-itinerary ───────────────────────────────────────
router.post("/generate-itinerary", async (req, res, next) => {
  try {
    const { destName, country, days, travelers, budget } = req.body;
    if (!destName || !days)
      return res.status(400).json({ error: "destName and days are required" });

    const prompt = `
You are an expert travel planner. Generate a detailed ${days}-day itinerary for ${destName}, ${country || ""}.
Travelers: ${travelers || 1}. Budget: ${budget || "mid-range"}.

Return ONLY a valid JSON object. No markdown, no code fences, no explanation.

{
  "destName": "${destName}",
  "country": "<correct country name>",
  "emoji": "<one relevant emoji>",
  "color": "<hex color evocative of this place, e.g. #C8472A>",
  "overview": "<2 sentence punchy overview>",
  "days": [
    {
      "day": 1,
      "theme": "<short evocative day theme>",
      "activities": [
        { "time": "Morning",   "title": "<real place name>", "desc": "<1-2 sentences + tip>", "category": "<sightseeing|food|adventure|culture|nature|shopping|nightlife>" },
        { "time": "Afternoon", "title": "<real place name>", "desc": "<1-2 sentences + tip>", "category": "<category>" },
        { "time": "Evening",   "title": "<real place name>", "desc": "<1-2 sentences + tip>", "category": "<category>" }
      ],
      "accommodation": "<recommended neighborhood to stay>",
      "localTip": "<one practical insider tip for this day>"
    }
  ]
}

Rules:
- Use REAL specific place names, not generic descriptions
- Spread activities geographically across days
- Each day has exactly 3 activities: Morning, Afternoon, Evening
- Color should be culturally evocative (Santorini=deep blue, Morocco=amber, Japan=red)
- Return ONLY the JSON, nothing else
`;

    const raw  = await askGemini(prompt);
    const clean = raw.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (e) { console.error(e.message); next(e); }
});

// ── POST /api/gemini/day-narrative ────────────────────────────────────────────
router.post("/day-narrative", async (req, res, next) => {
  try {
    const { destName, country, day, theme, activities } = req.body;
    if (!destName || !activities?.length)
      return res.status(400).json({ error: "destName and activities required" });

    const actList = activities.map(a => `- ${a.time}: ${a.title} — ${a.desc}`).join("\n");

    const prompt = `
You are a luxury travel writer. Write a vivid 3-paragraph narrative for Day ${day} in ${destName}, ${country}.
Day theme: "${theme}"

Activities:
${actList}

Requirements:
- Open with atmospheric, sensory description of the destination that morning
- Weave in historical/cultural context for each activity naturally  
- Include 1-2 genuine insider tips (timing, what to order, what to avoid)
- Close with an evocative evening sentence

Tone: warm, inspiring, journalistic. Pure flowing prose only. No bullet points, no headings, no markdown.
`;

    const text = await askGemini(prompt);
    res.json({ day, narrative: text.trim() });
  } catch (e) { next(e); }
});

// ── POST /api/gemini/destination-search ───────────────────────────────────────
router.post("/destination-search", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });

    const prompt = `
User typed "${query}" in a travel destination search box.
Return ONLY a JSON array of up to 5 matching destinations. No markdown.

[
  { "destName": "<city/region>", "country": "<country>", "emoji": "<emoji>", "blurb": "<one sentence why visit>" }
]

Return ONLY the JSON array.
`;

    const raw   = await askGemini(prompt);
    const clean = raw.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (e) { next(e); }
});

// ── POST /api/gemini/packing-list ─────────────────────────────────────────────
router.post("/packing-list", async (req, res, next) => {
  try {
    const { destinations, totalDays, budget } = req.body;
    if (!destinations?.length) return res.status(400).json({ error: "destinations required" });

    const destList = destinations.map(d => `${d.destName} (${d.country})`).join(", ");
    const prompt = `
Packing list for a ${totalDays}-day ${budget} trip to: ${destList}.
Return ONLY JSON, no markdown:
{ "essentials": [], "clothing": [], "toiletries": [], "tech": [], "destination_specific": [] }
Each category: 4-7 specific items.
`;

    const raw = await askGemini(prompt);
    res.json({ packingList: JSON.parse(raw.replace(/```json|```/g, "").trim()) });
  } catch (e) { next(e); }
});

// ── POST /api/gemini/trip-title ───────────────────────────────────────────────
router.post("/trip-title", async (req, res, next) => {
  try {
    const { destinations, travelers, budget } = req.body;
    const names = destinations.map(d => d.destName).join(", ");
    const prompt = `
3 creative trip title ideas for a ${budget} trip to ${names} for ${travelers} traveller(s).
Return ONLY a JSON array of 3 strings. No markdown.
`;
    const raw = await askGemini(prompt);
    res.json({ titles: JSON.parse(raw.replace(/```json|```/g, "").trim()) });
  } catch (e) { next(e); }
});

module.exports = router;
