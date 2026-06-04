var fs = require("fs");
var b64 = fs.readFileSync("D:\\project\\TradingAgents-astock\\components\\rep_b64.txt", "utf-8");
var c = Buffer.from(b64, "base64").toString("utf-8");

// ? export default ??? getRatingStyle
var fnStart = "export default function ReportSlideshow({ ticker, tickerName, tradeDate, signal, messages, report }: SlideshowProps) {";
var getRatingFn = [
  "",
  "function getRatingStyle(rating: string) {",
  "  switch (rating) {",
  "    case \"strong_buy\": case \"buy\":",
  "      return { color: \"#00E676\", bg: \"rgba(0,230,118,0.12)\", border: \"rgba(0,230,118,0.3)\" };",
  "    case \"sell\": case \"strong_sell\":",
  "      return { color: \"#FF5252\", bg: \"rgba(255,82,82,0.12)\", border: \"rgba(255,82,82,0.3)\" };",
  "    default:",
  "      return { color: \"#FFD740\", bg: \"rgba(255,215,64,0.12)\", border: \"rgba(255,215,64,0.3)\" };",
  "  }",
  "}",
  "const TOTAL_PAGES = 10;",
  "",
].join(String.fromCharCode(10));
c = c.replace(fnStart, getRatingFn + String.fromCharCode(10) + fnStart);

// ?? const TOTAL = 5 ? const TOTAL_PAGES = 10
c = c.replace("const TOTAL = 5;", "const TOTAL_PAGES = 10;");

// ? TOTAL_PAGES ?????
var varBlock = [
  "const rating = signal?.rating || \"hold\";",
  "const ratingText = RATING_MAP[rating] || rating;",
  "const ratingTextCN = RATING_CN[rating] || rating;",
  "const ratingStyle = getRatingStyle(rating);",
  "const isBullish = rating === \"strong_buy\" || rating === \"buy\";",
  "const isBearish = rating === \"sell\" || rating === \"strong_sell\";",
  "const marketContent = getFromMsg(messages, \"market\");",
  "const socialContent = getFromMsg(messages, \"social\");",
  "const hotMoneyContent = getFromMsg(messages, \"hot_money\");",
  "",
  "const kpiItems: any[] = [",
  "  { label: \"Close\", value: extractReg(marketContent, /(?:close|price|Close|Price)[:\\\s]*([0-9.]+)/) || \"--\" },\",
  "  { label: \"Chg\", value: extractReg(marketContent, /(?:change|chg|Change|Chg)[:\\\s]*([+-]?[0-9.]+%)/) || \"--\" },\",
  "  { label: \"Turnover\", value: extractReg(marketContent, /(?:turnover|Turnover|rate|???)[:\\\s]*([0-9.]+%)/) || \"--\" },\",
  "  { label: \"Volume\", value: extractReg(hotMoneyContent, /(?:volume|Volume|vol|???|??)[:\\\s]*([0-9.]+)/) || extractReg(marketContent, /(?:volume|Volume|vol|???|??)[:\\\s]*([0-9.]+)/) || \"--\" },\",
  "];",
  "",
  "const actionItems: any[] = isBullish",
  "  ? [",
  "      { role: \"Holder\", emoji: \"H\", action: \"Hold with stop-loss\", color: \"#00E676\" },\",
  "      { role: \"Watcher\", emoji: \"W\", action: \"Small test position on dips\", color: \"#FFD740\" },\",
  "      { role: \"Fisher\", emoji: \"F\", action: \"Add after support confirmed\", color: \"#FF6B00\" },\",
  "    ]",
  "  : isBearish",
  "  ? [",
  "      { role: \"Holder\", emoji: \"H\", action: \"Reduce position, control risk\", color: \"#FF5252\" },\",
  "      { role: \"Watcher\", emoji: \"W\", action: \"Wait for stabilization signal\", color: \"#FFD740\" },\",
  "      { role: \"Fisher\", emoji: \"F\", action: \"Avoid blind bottom-fishing\", color: \"#888\" },\",
  "    ]",
  "  : [",
  "      { role: \"Holder\", emoji: \"H\", action: \"Hold cautiously\", color: \"#FFD740\" },\",
  "      { role: \"Watcher\", emoji: \"W\", action: \"Wait for clear direction\", color: \"#FFD740\" },\",
  "      { role: \"Fisher\", emoji: \"F\", action: \"Small trial position only\", color: \"#FF6B00\" },\",
  "    ];",
  "",
  "const coverageDims = [",
  "  { key: \"market\", score: extractScore(marketContent) },\",
  "  { key: \"social\", score: extractScore(socialContent) },\",
  "  { key: \"hot_money\", score: extractScore(hotMoneyContent) },\",
  "  { key: \"fundamentals\", score: extractScore(getFromMsg(messages, \"fundamentals\")) },\",
  "  { key: \"policy\", score: extractScore(getFromMsg(messages, \"policy\")) },\",
  "];",
  "const coveragePct = coverageDims.filter(function(d) { return d.score !== null; }).length / coverageDims.length * 100;",
].join(String.fromCharCode(10));
c = c.replace("const TOTAL_PAGES = 10;", "const TOTAL_PAGES = 10;" + String.fromCharCode(10) + varBlock);

fs.writeFileSync("D:\\project\\TradingAgents-astock\\components\\ReportSlideshow.tsx", c, "utf-8");
console.log("build done");