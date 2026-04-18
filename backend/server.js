require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const mongoose   = require("mongoose");
const path       = require("path");

const itineraryRoutes = require("./routes/Itinerary");
const geminiRoutes    = require("./routes/gemini");
const pdfRoutes       = require("./routes/pdf");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3001")
  .split(",").map(o => o.trim());

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/itineraries", itineraryRoutes);
app.use("/api/gemini",      geminiRoutes);
app.use("/api/pdf",         pdfRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ── Catch-all for SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── DB + Listen ───────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅  MongoDB connected");
    app.listen(PORT, () => console.log(`🚀  API running → http://localhost:${PORT}`));
  })
  .catch(err => { console.error("❌  MongoDB connection failed:", err.message); process.exit(1); });
