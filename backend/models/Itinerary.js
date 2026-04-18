const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  time:     { type: String, enum: ["Morning","Afternoon","Evening"], required: true },
  title:    { type: String, required: true },
  desc:     { type: String, required: true },
  category: { type: String, default: "sightseeing" },
}, { _id: false });

const DaySchema = new mongoose.Schema({
  day:          { type: Number, required: true },
  localDay:     { type: Number, required: true },
  theme:        { type: String, default: "" },
  destName:     { type: String, required: true },
  destCountry:  { type: String, required: true },
  destEmoji:    { type: String },
  destColor:    { type: String },
  destImg:      { type: String },
  activities:   [ActivitySchema],
  accommodation:{ type: String, default: "" },
  localTip:     { type: String, default: "" },
  aiSummary:    { type: String, default: null },
}, { _id: false });

const DestinationSchema = new mongoose.Schema({
  destName: String,
  country:  String,
  emoji:    String,
  color:    String,
  days:     Number,
  overview: String,
}, { _id: false });

const ItinerarySchema = new mongoose.Schema({
  title:        { type: String, default: "My Itinerary" },
  travelers:    { type: Number, default: 1 },
  budget:       { type: String, enum: ["budget","mid","luxury"], default: "mid" },
  totalCost:    { type: Number, default: 0 },
  totalDays:    { type: Number, default: 0 },
  destinations: { type: [DestinationSchema], default: [] },
  days:         { type: [DaySchema],         default: [] },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
}, { versionKey: false });

ItinerarySchema.pre("save", function(next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model("Itinerary", ItinerarySchema);
