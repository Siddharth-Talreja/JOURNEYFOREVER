const express    = require("express");
const router     = express.Router();
const puppeteer  = require("puppeteer");
const Itinerary  = require("../models/Itinerary");

// ── POST /api/pdf/:id  ─ generate & stream PDF ───────────────────────────────
router.post("/:id", async (req, res, next) => {
  let browser;
  try {
    const doc = await Itinerary.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Itinerary not found" });

    const html = buildHTML(doc);

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });

    await browser.close();

    const filename = encodeURIComponent(doc.title.replace(/[^a-zA-Z0-9 ]/g, "")) || "itinerary";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    next(e);
  }
});

// ── HTML template for PDF ─────────────────────────────────────────────────────
function buildHTML(doc) {
  const destTags = doc.destinations.map(d =>
    `<span class="dest-tag" style="border-color:${d.color};color:${d.color}">${d.emoji} ${d.destName || d.name}</span>`
  ).join(" ");

  const dayCards = doc.days.map(day => {
    const acts = day.activities.map(a => `
      <div class="activity">
        <span class="act-time">${a.time}</span>
        <div>
          <strong>${a.title}</strong>
          <p>${a.desc}</p>
        </div>
      </div>
    `).join("");

    const aiBlock = day.aiSummary
      ? `<div class="ai-summary"><span class="ai-label">✦ AI Insights</span><p>${day.aiSummary}</p></div>`
      : "";

    return `
      <div class="day-card" style="border-top:4px solid ${day.destColor}">
        <div class="day-header">
          <div>
            <span class="day-num">Day ${day.day}</span>
            <span class="day-dest">${day.destEmoji} ${day.destName}, ${day.destCountry}</span>
          </div>
          <span class="day-local">Local day ${day.localDay}</span>
        </div>
        <div class="activities">${acts}</div>
        ${aiBlock}
      </div>
    `;
  }).join("");

  const budgetLabel = { budget: "🎒 Budget", mid: "✈️ Mid-Range", luxury: "💎 Luxury" }[doc.budget] || doc.budget;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #fff; color: #1a1a2e; font-size: 13px; line-height: 1.6; }

  /* Cover */
  .cover { background: #0A0A0F; color: #F0EDE8; padding: 48px 40px 40px; margin-bottom: 32px; border-radius: 8px; }
  .cover-brand { font-family: 'DM Serif Display', serif; font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase; color: #E8A87C; margin-bottom: 20px; }
  .cover-title { font-family: 'DM Serif Display', serif; font-size: 38px; color: #F0EDE8; margin-bottom: 24px; line-height: 1.15; }
  .cover-meta { display: flex; gap: 32px; font-size: 13px; color: rgba(240,237,232,0.55); margin-bottom: 24px; }
  .cover-meta span strong { color: #E8A87C; display: block; font-size: 18px; font-family: 'DM Serif Display', serif; }
  .dest-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .dest-tag { border: 1px solid; border-radius: 50px; padding: 4px 14px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }

  /* Day cards */
  .day-card { margin-bottom: 24px; border-radius: 10px; border: 1px solid #e8e8e8; overflow: hidden; page-break-inside: avoid; }
  .day-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px 12px; background: #fafafa; }
  .day-num { font-family: 'DM Serif Display', serif; font-size: 22px; margin-right: 10px; color: #0A0A0F; }
  .day-dest { font-size: 14px; color: #555; font-weight: 600; }
  .day-local { font-size: 11px; color: #aaa; padding-top: 4px; }

  .activities { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .activity { display: flex; gap: 14px; align-items: flex-start; }
  .act-time { min-width: 80px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; font-weight: 600; padding-top: 2px; }
  .activity strong { font-size: 13px; color: #1a1a2e; display: block; margin-bottom: 2px; }
  .activity p { font-size: 12px; color: #666; margin: 0; }

  .ai-summary { background: #fffbf5; border-top: 1px solid #f0e8d8; padding: 14px 20px; }
  .ai-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #E8A87C; font-weight: 600; display: block; margin-bottom: 6px; }
  .ai-summary p { font-size: 12px; color: #555; line-height: 1.7; font-style: italic; }

  .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #bbb; padding: 20px 0; border-top: 1px solid #eee; }
</style>
</head>
<body>

  <div class="cover">
    <div class="cover-brand">✦ JourneyForever Itinerary</div>
    <div class="cover-title">${doc.title}</div>
    <div class="cover-meta">
      <span><strong>${doc.totalDays}</strong>Days</span>
      <span><strong>${doc.travelers}</strong>Traveler${doc.travelers > 1 ? "s" : ""}</span>
      <span><strong>${budgetLabel}</strong>Budget</span>
      <span><strong>₹${doc.totalCost.toLocaleString("en-IN")}</strong>Est. Cost</span>
    </div>
    <div class="dest-tags">${destTags}</div>
  </div>

  ${dayCards}

  <div class="footer">
    Generated by JourneyForever · ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
  </div>

</body>
</html>`;
}

module.exports = router;
