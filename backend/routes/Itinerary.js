const express    = require("express");
const router     = express.Router();
const Itinerary  = require("../models/Itinerary");

// ── GET /api/itineraries ─ list all (newest first) ───────────────────────────
router.get("/", async (_req, res, next) => {
  try {
    const list = await Itinerary.find({}, "title travelers budget totalDays totalCost destinations createdAt")
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (e) { next(e); }
});

// ── GET /api/itineraries/:id ─ full detail ────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Itinerary.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Itinerary not found" });
    res.json(doc);
  } catch (e) { next(e); }
});

// ── POST /api/itineraries ─ create ────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { title, travelers, budget, totalCost, totalDays, destinations, days } = req.body;

    if (!destinations?.length || !days?.length)
      return res.status(400).json({ error: "destinations and days are required" });

    const doc = await Itinerary.create({
      title:        title || buildTitle(destinations),
      travelers:    travelers || 1,
      budget:       budget   || "mid",
      totalCost:    totalCost || 0,
      totalDays:    totalDays || 0,
      destinations,
      days,
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// ── PUT /api/itineraries/:id ─ update ─────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const doc = await Itinerary.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: "Itinerary not found" });
    res.json(doc);
  } catch (e) { next(e); }
});

// ── DELETE /api/itineraries/:id ───────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Itinerary.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Itinerary not found" });
    res.json({ message: "Itinerary deleted", id: req.params.id });
  } catch (e) { next(e); }
});

// ── PATCH /api/itineraries/:id/day/:day/ai-summary ─ store Gemini summary ────
router.patch("/:id/day/:day/ai-summary", async (req, res, next) => {
  try {
    const { summary } = req.body;
    if (!summary) return res.status(400).json({ error: "summary is required" });

    const doc = await Itinerary.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Itinerary not found" });

    const dayEntry = doc.days.find(d => d.day === Number(req.params.day));
    if (!dayEntry) return res.status(404).json({ error: "Day not found" });

    dayEntry.aiSummary = summary;
    await doc.save();
    res.json({ message: "AI summary saved", day: dayEntry.day });
  } catch (e) { next(e); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTitle(destinations) {
  const names = destinations.slice(0, 3).map(d => d.name);
  return names.join(" · ");
}

module.exports = router;