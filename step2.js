var fs = require("fs");

var b64 = fs.readFileSync("D:\\project\\TradingAgents-astock\\components\\rep_b64.txt", "utf-8");
var c = Buffer.from(b64, "base64").toString("utf-8");

// ?? getRatingStyle
c = c.replace(
  "export default function ReportSlideshow",
  "function getRatingStyle(rating) {\n  switch (rating) {\n    case \"strong_buy\":\n    case \"buy\":\n      return { color: \"#00E676\", bg: \"rgba(0,230,118,0.12)\", border: \"rgba(0,230,118,0.3)\" };\n    case \"sell\":\n    case \"strong_sell\":\n      return { color: \"#FF5252\", bg: \"rgba(255,82,82,0.12)\", border: \"rgba(255,82,82,0.3)\" };\n    default:\n      return { color: \"#FFD740\", bg: \"rgba(255,215,64,0.12)\", border: \"rgba(255,215,64,0.3)\" };\n  }\n}\n\nexport default function ReportSlideshow"
);

// const TOTAL = 5 -> TOTAL_PAGES = 10
c = c.replace("const TOTAL = 5;", "const TOTAL_PAGES = 10;");

// ? TOTAL_PAGES ???????
var insert = '\n  var rating = signal?.rating || "hold";\n' +
  '  var ratingText = RATING_MAP[rating] || rating;\n' +
  '  var ratingTextCN = RATING_CN[rating] || rating;\n' +
  '  var ratingStyle = getRatingStyle(rating);\n' +
  '  var isBullish = rating === "strong_buy" || rating === "buy";\n' +
  '  var isBearish = rating === "sell" || rating === "strong_sell";\n' +
  '  var marketContent = getFromMsg(messages, "market");\n' +
  '  var socialContent = getFromMsg(messages, "social");\n' +
  '  var hotMoneyContent = getFromMsg(messages, "hot_money");\n' +
  '  var kpiItems = [];\n' +
  '  var actionItems = [];\n' +
  '  var coveragePct = 100;\n';

c = c.replace("const TOTAL_PAGES = 10;", "const TOTAL_PAGES = 10;" + insert);

fs.writeFileSync("D:\\project\\TradingAgents-astock\\components\\ReportSlideshow.tsx", c, "utf-8");
console.log("step2 done, has ratingStyle:", c.includes("ratingStyle"));
