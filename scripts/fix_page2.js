const fs = require("fs");

// ============ 1. 修复分析页面 page.tsx ============
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
let c = fs.readFileSync(fp, "utf-8");

// 把 Agent 推理过程改成默认折叠
// 在状态声明区加入 showDebug
if (!c.includes("showDebug")) {
  c = c.replace(
    "const [showReports",
    "const [showDebug, setShowDebug] = useState(false);\n  const [showReports"
  );
}

// 找到 Agent 区域的开始
const agentMarker = 'className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden"';
const agentIdx = c.indexOf(agentMarker, c.indexOf("Agent"));
if (agentIdx > 0) {
  // 在 Agent 区域前插入折叠标题
  const beforeDiv = c.lastIndexOf("<div", agentIdx);
  const headerHtml =
    '<button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 bg-[#161616] border border-[#2a2a2a] rounded-xl hover:bg-[#1a1a1a] text-left transition-colors">\n' +
    '          <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>\n' +
    '          <span className="text-sm">🧠 Agent推理过程</span>\n' +
    '          <span className="text-xs text-[#555]">({messages.length}条)</span>\n' +
    '        </button>\n' +
    '        {showDebug && (';
  
  // 在 Agent div 前面插入折叠按钮
  c = c.substring(0, agentIdx) + headerHtml + c.substring(agentIdx);
  
  // 在 Agent 区域结束处补上闭合括号
  // 找到 </div><!-- Agent 推理过程结束 --> 之后的第一个 </div>
  const endRefMarker = '<div ref={msgEndRef}';
  const endRefPos = c.indexOf(endRefMarker);
  if (endRefPos > 0) {
    const afterEndRef = c.indexOf("</div>", endRefPos) + 6;
    // 再加上 )} 来闭合 showDebug
    c = c.substring(0, afterEndRef) + "\n          )}" + c.substring(afterEndRef);
  }
  
  // 删除旧的多余展开/收起按钮和标签（因为我们已经用折叠标题替代了）
  // 注意不要删除过多
  
  // 把旧标题区域替换成空的
  const oldHeaderArea = '<div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">';
  const oldHeaderEnd = c.indexOf("</div>", c.indexOf(oldHeaderArea)) + 6;
  if (oldHeaderEnd > 6) {
    const oldHeader = c.substring(c.indexOf(oldHeaderArea), oldHeaderEnd);
    // 替换成空的div，只保留边框
    c = c.replace(oldHeader, '<div className="px-4 py-0 border-b border-[#2a2a2a] hidden"></div>');
  }
}

fs.writeFileSync(fp, c, "utf-8");
console.log("Analysis page fixed");

// ============ 2. 首页添加缓存检查 ============
const homePage = "D:/project/TradingAgents-astock/app/page.tsx";
let h = fs.readFileSync(homePage, "utf-8");

// 把直接跳转改成先 POST /api/analyze 检查缓存
if (h.includes("router.push(")) {
  h = h.replace(
    "setLoading(true);\n    const date = new Date().toISOString().slice(0, 10);\n    router.push",
    'setLoading(true);\n    const date = new Date().toISOString().slice(0, 10);\n    try {\n      const r = await fetch("/api/analyze", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ ticker: code, date }),\n      });\n      const d = await r.json();\n      if (d.taskId) {\n        router.push("/analysis/" + encodeURIComponent(code) + "?date=" + date + "&taskId=" + d.taskId);\n        return;\n      }\n    } catch (_) {}\n    router.push'
  );
}

fs.writeFileSync(homePage, h, "utf-8");
console.log("Home page cache check added");
