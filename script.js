// =============== SETTINGS ===============
const STUDIO_URL = "https://www.fitx.de/fitnessstudios/karlsruhe-oststadt";

const FITX_ORANGE    = new Color("#ff6a00");
const FITX_DARK_BG   = new Color("#101010");
const GRID_COLOR     = new Color("#333333");
const TEXT_PRIMARY   = Color.white();
const TEXT_SECONDARY = new Color("#aaaaaa");
const CHIP_BG        = new Color("#222222");

// Logo source (PNG preview of official SVG)
const FITX_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Logo_FitX_Deutschland_GmbH.svg/512px-Logo_FitX_Deutschland_GmbH.svg.png";


// =============== HELPERS ===============
function studioNameFromUrl(url) {
  let slug = url.split("/").filter(p => p).pop() || "Unbekannt";
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

// Echtzeit + Prognose
function extractSeriesPair(html) {
  const current = extractSeriesByAttr(html, "data-current-day-data");
  const visitorData = extractSeriesByAttr(html, "data-visitordata");

  let forecast = null;
  if (visitorData && Array.isArray(visitorData) && visitorData.length >= 7) {
    // visitorData[0] = Mo ... [6] = So
    const jsDay = new Date().getDay(); // 0=So..6=Sa
    const mondayIndex = (jsDay + 6) % 7; // 0=Mo
    forecast = visitorData[mondayIndex] || null;
  }
  if (!forecast && current) forecast = current;

  return { current, forecast };
}

function statusLabel(pct) {
  if (pct == null || isNaN(pct)) return "Keine Daten";
  if (pct < 25) return "Wenig besucht";
  if (pct < 60) return "Mäßig besucht";
  if (pct < 85) return "Gut besucht";
  return "Sehr voll";
}

function statusEmoji(pct) {
  if (pct == null || isNaN(pct)) return "⚪️";
  if (pct < 25) return "🟢";
  if (pct < 60) return "🟡";
  if (pct < 85) return "🟠";
  return "🔴";
}

function currentDayRatio() {
  let now = new Date();
  let minutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, Math.min(1, minutes / 1440));
}

// Chart builder
function buildChart(actualSeries, forecastSeries, width, height, currentIndex) {
  let ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  // internal padding (tuned for smaller chart)
  const padLeft   = 4;
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

  function xForIndex(i, count) {
    if (count <= 1) return left;
    let t = i / (count - 1);
    return left + t * plotWidth;
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

  // Forecast area
  if (forecastSeries && forecastSeries.length > 1) {
    let area = new Path();
    area.move(new Point(left, bottom));
    for (let i = 0; i < forecastSeries.length; i++) {
      let x = xForIndex(i, forecastSeries.length);
      let y = yForValue(Number(forecastSeries[i]));
      area.addLine(new Point(x, y));
    }
    area.addLine(new Point(right, bottom));
    area.closeSubpath();
    ctx.addPath(area);
    ctx.setFillColor(new Color("#ff6a00", 0.25));
    ctx.fillPath();
  }

  // Echtzeit line (only up to currentIndex)
  if (
    actualSeries &&
    actualSeries.length > 1 &&
    typeof currentIndex === "number" &&
    currentIndex >= 0
  ) {
    const maxIdx = Math.min(currentIndex, actualSeries.length - 1);
    if (maxIdx >= 1) {
      let line = new Path();
      for (let i = 0; i <= maxIdx; i++) {
        let x = xForIndex(i, actualSeries.length);
        let y = yForValue(Number(actualSeries[i]));
        if (i === 0) line.move(new Point(x, y));
        else line.addLine(new Point(x, y));
      }
      ctx.addPath(line);
      ctx.setStrokeColor(Color.white());
      ctx.setLineWidth(2);
      ctx.strokePath();
    }

    // Vertical "now" line
    let xNow = xForIndex(maxIdx, actualSeries.length);
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
  ctx.drawText("Echtzeit", new Point(left + 10, legendY - 2));

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
  ctx.drawText("Voraussichtliche", new Point(forecastX + 10, legendY - 2));

  return ctx.getImage();
}


// =============== FETCH DATA ===============
let mainStudio = {
  name: studioNameFromUrl(STUDIO_URL),
  currentPct: null,
  status: "Keine Daten",
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
    let current = Number(actual[actual.length - 1]);
    mainStudio.currentPct     = isNaN(current) ? null : current;
    mainStudio.status         = statusLabel(current);
    mainStudio.actualSeries   = actual;
    mainStudio.forecastSeries = forecast;
  }
} catch (e) {
  mainStudio.status = "Fehler";
}


// =============== BUILD WIDGET ===============
let widget = new ListWidget();

// Extra vertical space + slight right shift
widget.setPadding(30, 26, 30, 20); // top, left, bottom, right
widget.backgroundColor = FITX_DARK_BG;

// ---- HEADER ROW (logo + titles on left, percentage on right) ----
let headerRow = widget.addStack();
headerRow.layoutHorizontally();
headerRow.centerAlignContent();

// Left block: logo + titles
let headerLeft = headerRow.addStack();
headerLeft.layoutHorizontally();

// Logo
try {
  let logoReq = new Request(FITX_LOGO_URL);
  let logoImg = await logoReq.loadImage();
  let logoView = headerLeft.addImage(logoImg);
  logoView.imageSize = new Size(64, 28);
  logoView.cornerRadius = 4;
} catch (e) {
  let logoText = headerLeft.addText("FITX");
  logoText.font = Font.heavySystemFont(22);
  logoText.textColor = FITX_ORANGE;
}

headerLeft.addSpacer(8);

// Titles
let titleStack = headerLeft.addStack();
titleStack.layoutVertically();

let title = titleStack.addText("Aktuelle Auslastung");
title.font = Font.mediumSystemFont(13);
title.textColor = TEXT_PRIMARY;

let subTitle = titleStack.addText(mainStudio.name);
subTitle.font = Font.systemFont(11);
subTitle.textColor = TEXT_SECONDARY;

// Right side: percentage
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

// Smaller height to allow more top/bottom padding
let chartWidth  = isPad ? 330 : 320;
let chartHeight = 70;

if (mainStudio.actualSeries && mainStudio.actualSeries.length > 1) {
  let ratio = currentDayRatio();
  let lastIdx = mainStudio.actualSeries.length - 1;
  let currentIndex = Math.round(ratio * lastIdx);

  let chartImage = buildChart(
    mainStudio.actualSeries,
    mainStudio.forecastSeries,
    chartWidth,
    chartHeight,
    currentIndex
  );

  let chartStack = widget.addStack();
  chartStack.layoutHorizontally();

  let imgView = chartStack.addImage(chartImage);
  imgView.imageSize = new Size(chartWidth, chartHeight);

  chartStack.addSpacer();
} else {
  let noDataText = widget.addText("Keine Auslastungsdaten verfügbar.");
  noDataText.font = Font.systemFont(11);
  noDataText.textColor = TEXT_SECONDARY;
}

widget.addSpacer(4);

// ---- BOTTOM ROW (timestamp left, status chip right) ----
let bottomRow = widget.addStack();
bottomRow.layoutHorizontally();
bottomRow.centerAlignContent();

// Timestamp on left
let now = new Date();
let ts = bottomRow.addText(
  "Stand: " +
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
);
ts.font = Font.systemFont(9);
ts.textColor = TEXT_SECONDARY;

bottomRow.addSpacer();

// Status chip bottom-right
let chip = bottomRow.addStack();
chip.layoutHorizontally();
chip.setPadding(3, 10, 3, 10);
chip.cornerRadius = 999;
chip.backgroundColor = CHIP_BG;

let statusText = chip.addText(
  `${statusEmoji(mainStudio.currentPct)}  ${mainStudio.status}`
);
statusText.font = Font.systemFont(11);
statusText.textColor = TEXT_PRIMARY;


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