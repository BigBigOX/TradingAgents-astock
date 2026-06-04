const fs = require("fs");

// === 1. 分析页面 ===
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
const lines = fs.readFileSync(fp, "utf-8").split("\n");

// 找各种标记的行号
const exportIdx = lines.findIndex(l => l.includes("export default function AnalysisPage"));
const expandedIdx = lines.findIndex(l => l.includes("const [expanded, setExpanded]"));
const reportStartH2 = lines.findIndex(l => l.includes("完整分析报告") && l.includes("</h2>"));
const reportSplitLine = lines.findIndex(l => l.includes("report.split"));
const tickerNameLine = lines.findIndex(l => l.includes("tickerName=''"));
const agentH2 = lines.findIndex(l => l.includes("Agent") && l.includes("推理过程") && l.includes("<h2"));
const endIdx = lines.findIndex(l => l.trim() === "}") - 1; // 最后几行

console.log("exportIdx:", exportIdx, "expandedIdx:", expandedIdx, "reportH2:", reportStartH2, "tickerNameLine:", tickerNameLine, "agentH2:", agentH2);

// 在 export function 前插入 extractTickerName
const extractFn = [
  "function extractTickerName(msgs: any[], fallback: string): string {",
  "  for (const m of msgs) {",
  '    const match = m.content.match(/(?:股票名称|股票名|名称|name)[：:]+([^\\n]+)/i);',
  "    if (match) return match[1].trim();",
  "  }",
  "  return fallback;",
  "}",
  "",
];
lines.splice(exportIdx, 0, ...extractFn);

// 更新行号（插入后之前的行号变了）
const newExportIdx = exportIdx + extractFn.length + 0; // extractFn + 1空行

// tickerName
const newTickerNameLine = lines.findIndex(l => l.includes("tickerName=''"));
if (newTickerNameLine >= 0) {
  lines[newTickerNameLine] = lines[newTickerNameLine].replace("tickerName=''", "tickerName={extractTickerName(messages, ticker)}");
}

// showDebug + showFullReport state
const newExpandedIdx = lines.findIndex(l => l.includes("const [expanded, setExpanded]"));
if (newExpandedIdx >= 0) {
  lines.splice(newExpandedIdx + 1, 0, "  const [showDebug, setShowDebug] = useState(false);", "  const [showFullReport, setShowFullReport] = useState(false);");
}

// 完整报告折叠
const newReportH2 = lines.findIndex(l => l.includes("完整分析报告") && l.includes("</h2>"));
const newReportSplit = lines.findIndex(l => l.includes("report.split"));
if (newReportH2 >= 0 && newReportSplit >= 0) {
  lines[newReportH2] = lines[newReportH2].replace(
    '<h2 className="text-lg font-bold text-[#f5f1eb] mb-4">📄 完整分析报告</h2>',
    '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2><button onClick={()=>setShowFullReport(!showFullReport)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showFullReport?"收起":"查看"}</button></div>'
  );
  lines[newReportSplit] = lines[newReportSplit].replace("{report.split", "{showFullReport && report.split");
}

// Agent推理过程折叠 - 替换为折叠版本
const newAgentH2 = lines.findIndex(l => l.includes("Agent") && l.includes("推理过程") && l.includes("<h2"));
if (newAgentH2 >= 0) {
  // 找到 <div className="bg-[#161616] 开始
  const agentDivStart = lines.slice(0, newAgentH2+1).reverse().findIndex(l => l.includes('className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden"'));
  const actualStart = newAgentH2 - agentDivStart;
  
  // 找到 msgEndRef 行的位置（Agent内容结束）
  const msgEndLine = lines.findIndex(l => l.includes("ref={msgEndRef}"));
  
  // 替换整个 Agent 区域
  // 删除从 actualStart 到 msgEnd 之后几行的所有行
  const agentEndLine = msgEndLine + 3; // 包括 </div> 等
  
  const agentSection = lines.slice(actualStart, agentEndLine);
  
  // 构建新的折叠版Agent区域
  const newAgentSection = [
    '        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">',
    '          <button onClick={()=>setShowDebug(!showDebug)}',
    '            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">',
    '            <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>',
    '            <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>',
    '            <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>',
    '          </button>',
    '          {showDebug && (',
    '            <div>',
    '              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#1a1a1a]">',
    '                <div className="flex gap-3">',
    '                  <button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">展开全部</button>',
    '                  <button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">收起全部</button>',
    '                </div>',
    '              </div>',
  ];
  
  // 添加原消息内容（过滤掉原来的标题行）
  for (const l of agentSection) {
    if (l.includes("推理过程") || l.includes("展开全部") || l.includes("收起全部") || l.includes("Agent 推理过程")) continue;
    if (l.includes("flex items-center justify-between px-4 py-3 border-b")) continue;
    newAgentSection.push(l);
  }
  
  // 加上折叠闭合
  newAgentSection.push("            )}");
  newAgentSection.push("          </div>");
  newAgentSection.push("        )}");
  
  // 替换
  lines.splice(actualStart, agentEndLine - actualStart, ...newAgentSection);
}

fs.writeFileSync(fp, lines.join("\n"), "utf-8");
console.log("Analysis page done: " + lines.length + " lines");

// === 2. 首页缓存检查 ===
const homePage = "D:/project/TradingAgents-astock/app/page.tsx";
let h = fs.readFileSync(homePage, "utf-8");
h = h.replace(
  "const date = new Date().toISOString().slice(0, 10);\n    router.push",
  'const date = new Date().toISOString().slice(0, 10);\n    try {\n      const r = await fetch("/api/analyze", {\n        method: "POST", headers: {"Content-Type":"application/json"},\n        body: JSON.stringify({ticker:code,date}),\n      });\n      const d = await r.json();\n      if (d.taskId) { router.push("/analysis/"+encodeURIComponent(code)+"?date="+date+"&taskId="+d.taskId); return; }\n    } catch(_){}\n    router.push'
);
fs.writeFileSync(homePage, h, "utf-8");
console.log("Home page with cache check done");
