require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS) || 8000;
const PORT = parseInt(process.env.PORT) || 3001;

// ---- In-memory cache ----
let rateCache = {
  rate: null,
  lastUpdated: null,
  source: "Twelve Data",
  pair: "USD/PHP",
  error: null,
};

// ---- Polling function (the "movie" that keeps playing) ----
async function fetchRate() {
  try {
    const url = `https://api.twelvedata.com/price?symbol=USD/PHP&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.price) {
      rateCache = {
        rate: parseFloat(data.price),
        lastUpdated: new Date().toISOString(),
        source: "Twelve Data",
        pair: "USD/PHP",
        error: null,
      };
      console.log(`[${rateCache.lastUpdated}] USD/PHP = ${rateCache.rate}`);
    } else {
      rateCache.error = data.message || "Unknown error from Twelve Data";
      console.error(`[ERROR] ${rateCache.error}`);
    }
  } catch (err) {
    rateCache.error = err.message;
    console.error(`[FETCH ERROR] ${err.message}`);
  }
}

// ---- API endpoints ----

// Main endpoint — your frontend calls this
app.get("/api/rate", (req, res) => {
  if (!rateCache.rate) {
    return res.status(503).json({
      error: "Rate not available yet. Server is starting up.",
    });
  }
  res.json(rateCache);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    cacheAge: rateCache.lastUpdated
      ? `${((Date.now() - new Date(rateCache.lastUpdated).getTime()) / 1000).toFixed(1)}s ago`
      : "not yet fetched",
    pollInterval: `${POLL_INTERVAL / 1000}s`,
  });
});

// ---- Start server and polling ----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Polling Twelve Data every ${POLL_INTERVAL / 1000} seconds`);
  console.log(`Endpoints:`);
  console.log(`  GET http://localhost:${PORT}/api/rate    — current USD/PHP rate`);
  console.log(`  GET http://localhost:${PORT}/api/health  — server health check`);

  // Fetch immediately on startup, then every POLL_INTERVAL ms
  fetchRate();
  setInterval(fetchRate, POLL_INTERVAL);
});
