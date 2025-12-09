// =============== SETTINGS ===============
const STUDIO_URL = "https://www.fitx.de/fitnessstudios/karlsruhe-oststadt";

const FITX_ORANGE    = new Color("#ff6a00");
const FITX_DARK_BG   = new Color("#101010");
const GRID_COLOR     = new Color("#333333");
const TEXT_PRIMARY   = Color.white();
const TEXT_SECONDARY = new Color("#aaaaaa");

const COLOR_NO_DATA   = new Color("#777777");
const COLOR_NOT_BUSY  = new Color("#2ecc71");
const COLOR_MOD_BUSY  = new Color("#f1c40f");
const COLOR_BUSY      = new Color("#e67e22");
const COLOR_VERY_BUSY = new Color("#e74c3c");

const NOT_BUSY        = "25";
const MOD_BUSY        = "50";
const BUSY            = "75";

const FITX_LOGO_URL =
  "https://raw.githubusercontent.com/aghyy/FitX-Widget/main/public/fitx.png";


// =============== HELPERS ===============
function studioNameFromUrl(url) {
  let slug = url.split("/").filter(p => p).pop() || "Unknown";
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractSeriesByAttr(html, attrName) {
  const patterns = [
    new RegExp(attrName + '="(\\[.*?\\])"'),
    new RegExp(attrName + "='(\\[.*?\\])'"),
    new RegExp(attrName + "=&quot;(\\[.*?\\])&quot;")
  ];
  for (let re of patterns) {
    let m = html.match(re);
    if (m && m[1]) {
      let raw = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim();
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
  }
  return null;
}

// Realtime + Forecast from attributes
function extractSeriesPair(html) {
  const current = extractSeriesByAttr(html, "data-current-day-data");
  const visitorData = extractSeriesByAttr(html, "data-visitordata");

  let forecast = null;
  if (visitorData && Array.isArray(visitorData) && visitorData.length >= 7) {
    // visitorData[0] = Monday ... [6] = Sunday
    const jsDay = new Date().getDay(); // 0=Sun..6=Sat
    const mondayIndex = (jsDay + 6) % 7; // map JS day -> 0=Monday
    forecast = visitorData[mondayIndex] || null;
  }
  if (!forecast && current) forecast = current;
  
  return { current, forecast };
}

function statusLabel(pct) {
  if (pct == null || isNaN(pct)) return "No data";
  if (pct < NOT_BUSY) return "Not busy";
  if (pct < MOD_BUSY) return "Moderately busy";
  if (pct < BUSY) return "Busy";
  return "Very busy";
}

function statusColor(pct) {
  if (pct == null || isNaN(pct)) return COLOR_NO_DATA;
  if (pct < NOT_BUSY) return COLOR_NOT_BUSY;
  if (pct < MOD_BUSY) return COLOR_MOD_BUSY;
  if (pct < BUSY) return COLOR_BUSY;
  return COLOR_VERY_BUSY;
}

function currentDayRatio() {
  let now = new Date();
  let minutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, Math.min(1, minutes / 1440));
}

// Chart builder
// lineEndIndex = index of current realtime value (Y)
// nowRatio     = 0..1 position of "now" along the X axis
function buildChart(actualSeries, forecastSeries, width, height, lineEndIndex, nowRatio) {
  let ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const padLeft   = 1;
  const padRight  = 4;
  const padTop    = 2;
  const padBottom = 14;

  const left   = padLeft;
  const right  = width - padRight;
  const top    = padTop;
  const bottom = height - padBottom;

  const plotWidth  = right - left;
  const plotHeight = bottom - top;
  const maxVal     = 100;

  const clampedNowRatio = Math.max(0, Math.min(1, nowRatio));

  function xForForecast(i, count) {
    if (count <= 1) return left;
    let t = i / (count - 1);
    return left + t * plotWidth;
  }

  function xForRealtime(i, endIndex) {
    if (endIndex <= 0) return left;
    let t = i / endIndex; // 0..1 over the realtime part
    return left + t * (plotWidth * clampedNowRatio);
  }

  function yForValue(v) {
    if (v == null || isNaN(v)) v = 0;
    v = Math.max(0, Math.min(maxVal, v));
    let t = v / maxVal;
    return bottom - t * plotHeight;
  }

  // Grid
  ctx.setStrokeColor(GRID_COLOR);
  ctx.setLineWidth(1);
  [0, 50, 100].forEach(val => {
    let y = yForValue(val);
    let p = new Path();
    p.move(new Point(left, y));
    p.addLine(new Point(right, y));
    ctx.addPath(p);
    ctx.strokePath();
  });

  // Forecast area (full width)
  if (forecastSeries && forecastSeries.length > 1) {
    let area = new Path();
    area.move(new Point(left, bottom));
    for (let i = 0; i < forecastSeries.length; i++) {
      let x = xForForecast(i, forecastSeries.length);
      let y = yForValue(Number(forecastSeries[i]));
      area.addLine(new Point(x, y));
    }
    area.addLine(new Point(right, bottom));
    area.closeSubpath();
    ctx.addPath(area);
    ctx.setFillColor(new Color("#ff6a00", 0.25));
    ctx.fillPath();
  }

  // Realtime line (only up to "now", using lineEndIndex + nowRatio)
  if (
    actualSeries &&
    actualSeries.length > 1 &&
    typeof lineEndIndex === "number" &&
    lineEndIndex >= 0
  ) {
    const endIdx = Math.min(lineEndIndex, actualSeries.length - 1);
    if (endIdx >= 1) {
      let line = new Path();
      for (let i = 0; i <= endIdx; i++) {
        let x = xForRealtime(i, endIdx);
        let y = yForValue(Number(actualSeries[i]));
        if (i === 0) line.move(new Point(x, y));
        else line.addLine(new Point(x, y));
      }
      ctx.addPath(line);
      ctx.setStrokeColor(Color.white());
      ctx.setLineWidth(2);
      ctx.strokePath();
    }
  }

  // Vertical "now" line at time position (independent of index)
  {
    let xNow = left + clampedNowRatio * plotWidth;
    let nowPath = new Path();
    nowPath.move(new Point(xNow, top));
    nowPath.addLine(new Point(xNow, bottom));
    ctx.addPath(nowPath);
    ctx.setStrokeColor(new Color("#ffffff", 0.7));
    ctx.setLineWidth(1);
    ctx.strokePath();
  }

  // Legend
  const legendY = bottom + 2;
  const dotRadius = 3;

  let actualDot = new Path();
  actualDot.addRoundedRect(
    new Rect(left, legendY, dotRadius * 2, dotRadius * 2),
    dotRadius,
    dotRadius
  );
  ctx.addPath(actualDot);
  ctx.setFillColor(Color.white());
  ctx.fillPath();

  ctx.setTextColor(TEXT_SECONDARY);
  ctx.setFont(Font.systemFont(9));
  ctx.drawText("Realtime", new Point(left + 10, legendY - 2));

  let forecastX = left + 65;
  let forecastDot = new Path();
  forecastDot.addRoundedRect(
    new Rect(forecastX, legendY, dotRadius * 2, dotRadius * 2),
    dotRadius,
    dotRadius
  );
  ctx.addPath(forecastDot);
  ctx.setFillColor(FITX_ORANGE);
  ctx.fillPath();
  ctx.drawText("Forecast", new Point(forecastX + 10, legendY - 2));

  return ctx.getImage();
}

// =============== FETCH DATA ===============
let mainStudio = {
  name: studioNameFromUrl(STUDIO_URL),
  currentPct: null,
  status: "No data",
  actualSeries: null,
  forecastSeries: null
};

try {
  let req = new Request(STUDIO_URL);
  req.headers = { "User-Agent": "Mozilla/5.0 (Scriptable Widget)" };
  let html = await req.loadString();

  let pair = extractSeriesPair(html);
  let actual = pair.current;
  let forecast = pair.forecast;
  
  if (actual && actual.length > 0) {
    let lastIdx = actual.length - 1;
  
    // Index of the current realtime value.
    // Here we assume 1 value per hour starting at midnight.
    let now = new Date();
    let hour = now.getHours();           // 0..23
    let currentIndex = Math.min(lastIdx, hour);
  
    let current = Number(actual[currentIndex]);
  
    mainStudio.currentIndex   = currentIndex;                 // index for realtime data
    mainStudio.nowRatio       = currentDayRatio();            // 0..1, for X position
    mainStudio.currentPct     = isNaN(current) ? null : current;
    mainStudio.status         = statusLabel(mainStudio.currentPct);
    mainStudio.actualSeries   = actual;
    mainStudio.forecastSeries = forecast;
  }
} catch (e) {
  mainStudio.status = "Error";
}


// =============== BUILD WIDGET ===============
let widget = new ListWidget();

widget.setPadding(30, 29, 30, 17);
widget.backgroundColor = FITX_DARK_BG;


// ---- HEADER ROW ----
let headerRow = widget.addStack();
headerRow.layoutHorizontally();
headerRow.centerAlignContent();

let logoWrapper = headerRow.addStack();
logoWrapper.layoutHorizontally();

logoWrapper.setPadding(0, -3, 0, 0);

try {
  let logoReq = new Request(FITX_LOGO_URL);
  let logoImg = await logoReq.loadImage();
  let logoView = logoWrapper.addImage(logoImg);
  logoView.imageSize = new Size(64, 28);
  logoView.cornerRadius = 4;
} catch (e) {
  let logoText = logoWrapper.addText("FITX");
  logoText.font = Font.heavySystemFont(22);
  logoText.textColor = FITX_ORANGE;
}

headerRow.addSpacer(8);

// TITLES
let titleStack = headerRow.addStack();
titleStack.layoutVertically();

let title = titleStack.addText("Current Capacity");
title.font = Font.mediumSystemFont(13);
title.textColor = TEXT_PRIMARY;

let subTitle = titleStack.addText(mainStudio.name);
subTitle.font = Font.systemFont(11);
subTitle.textColor = TEXT_SECONDARY;

// % on the right
headerRow.addSpacer();

let pctLabel =
  mainStudio.currentPct == null
    ? "–"
    : `${Math.round(mainStudio.currentPct)} %`;
let pctText = headerRow.addText(pctLabel);
pctText.font = Font.boldSystemFont(16);
pctText.textColor = FITX_ORANGE;

widget.addSpacer(8);


// ---- CHART ----
let model = Device.model();
let isPad = model.includes("iPad");

if (mainStudio.actualSeries && mainStudio.actualSeries.length > 1) {
  let chartWidth  = isPad ? 350 : 335;
  let chartHeight = 85;

  let idx = typeof mainStudio.currentIndex === "number"
    ? mainStudio.currentIndex
    : mainStudio.actualSeries.length - 1;

  let nowRatio = typeof mainStudio.nowRatio === "number"
    ? mainStudio.nowRatio
    : 1;

  let chartImage = buildChart(
    mainStudio.actualSeries,
    mainStudio.forecastSeries,
    chartWidth,
    chartHeight,
    idx,       // lineEndIndex (which sample = current value)
    nowRatio   // where "now" is on the X-axis (0..1)
  );

  let chartStack = widget.addStack();
  chartStack.layoutHorizontally();

  let imgView = chartStack.addImage(chartImage);
  imgView.imageSize = new Size(chartWidth, chartHeight);

  chartStack.addSpacer();
} else {
  let noDataText = widget.addText("No capacity data available.");
  noDataText.font = Font.systemFont(11);
  noDataText.textColor = TEXT_SECONDARY;
}

widget.addSpacer(4);

// ---- BOTTOM ROW ----
let bottomRow = widget.addStack();
bottomRow.layoutHorizontally();
bottomRow.centerAlignContent();

// Timestamp
let now = new Date();
let ts = bottomRow.addText(
  "Updated: " +
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
);
ts.font = Font.systemFont(9);
ts.textColor = TEXT_SECONDARY;

bottomRow.addSpacer();

// Status chip
let chip = bottomRow.addStack();
chip.layoutHorizontally();
chip.setPadding(3, 10, 3, 10);
chip.cornerRadius = 999;

// dynamic color based on percentage
chip.backgroundColor = statusColor(mainStudio.currentPct);

let statusText = chip.addText(mainStudio.status);
statusText.font = Font.boldSystemFont(11);
statusText.textColor = FITX_DARK_BG;

// =============== AUTO REFRESH ===============
if (config.runsInWidget && widget.refreshAfterDate) {
  let next = new Date();
  next.setMinutes(next.getMinutes() + 30);
  widget.refreshAfterDate(next);
}


// =============== SHOW ===============
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}

Script.complete();