var fs = require("fs");

// 1. ????
var b64 = fs.readFileSync("D:\\project\\TradingAgents-astock\\components\\rep_b64.txt", "utf-8");
var c = Buffer.from(b64, "base64").toString("utf-8");

// 2. ?? getRatingStyle
c = c.replace(
  "export default function ReportSlideshow",
  "function getRatingStyle(rating) {\n  switch (rating) {\n    case \"strong_buy\":\n    case \"buy\":\n      return { color: \"#00E676\", bg: \"rgba(0,230,118,0.12)\", border: \"rgba(0,230,118,0.3)\" };\n    case \"sell\":\n    case \"strong_sell\":\n      return { color: \"#FF5252\", bg: \"rgba(255,82,82,0.12)\", border: \"rgba(255,82,82,0.3)\" };\n    default:\n      return { color: \"#FFD740\", bg: \"rgba(255,215,64,0.12)\", border: \"rgba(255,215,64,0.3)\" };\n  }\n}\n\nexport default function ReportSlideshow"
);

// 3. TOTAL = 5 -> TOTAL_PAGES = 10
c = c.replace("var TOTAL = 5;", "var TOTAL_PAGES = 10;");

// 4. ????
fs.writeFileSync("D:\\project\\TradingAgents-astock\\components\\ReportSlideshow.tsx", c, "utf-8");
console.log("step1 done, length:", c.length);
console.log("has getRatingStyle:", c.includes("getRatingStyle"));
console.log("has TOTAL_PAGES:", c.includes("TOTAL_PAGES = 10"));
console.log("ratingStyle refs:", (c.match(/ratingStyle/g) || []).length);
