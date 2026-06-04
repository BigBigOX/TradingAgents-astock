const fs = require("fs");

// ===== 1. 分析页面 =====
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
let c = fs.readFileSync(fp, "utf-8");

// 1a. tickerName提取
c = c.replace("tickerName=''", "tickerName={extractTickerName(messages, ticker)}");

c = c.replace(
  "export default function AnalysisPage",
  `function extractTickerName(msgs: any[], fallback: string): string {
  for (const m of msgs) {
    const match = m.content.match(/(?:股票名称|股票名|名称|name)[：:]+([^\\n]+)/i);
    if (match) return match[1].trim();
  }
  return fallback;
}

export default function AnalysisPage`
);

// 1b. 加入 showDebug 和 showFullReport 状态
c = c.replace(
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});",
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});\n  const [showDebug, setShowDebug] = useState(false);\n  const [showFullReport, setShowFullReport] = useState(false);"
);

// 1c. Agent推理过程区域用showDebug包裹
const agentStart = c.indexOf('<div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">');
const agentStart2 = c.indexOf('<div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">', agentStart + 10);
if (agentStart2 > 0) {
  // 在Agent区域前插入折叠按钮
  const foldBtn = `{showDebug && (\n        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">\n          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">`;
  c = c.substring(0, agentStart2) + foldBtn + c.substring(agentStart2 + (agentStart2 - agentStart));
  
  // 替换旧标题 - 在折叠按钮上面再加一个总的折叠标题
  // 在 Agent 区域最前面加总折叠标题
  const agentSectionStart = c.indexOf('<div className="bg-[#161616]', c.indexOf('showDebug'));
  const headerDiv = '<div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">';
  const headerPos = c.indexOf(headerDiv, agentSectionStart);
  
  // 在 Agent 区域之前加上总的折叠标题
  const newAgentHeader =
    '<div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">\n' +
    '        <button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">\n' +
    '          <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>\n' +
    '          <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>\n' +
    '          <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>\n' +
    '        </button>\n' +
    '        {showDebug && (\n' +
    '          <div>\n' +
    '            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#1a1a1a]">\n' +
    '              <div className="flex gap-3">\n' +
    '                <button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">展开全部</button>\n' +
    '                <button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">收起全部</button>\n' +
    '              </div>\n' +
    '            </div>';
  
  c = c.substring(0, agentSectionStart) + newAgentHeader + c.substring(agentSectionStart);
  
  // 找到 Agent 内容的结束位置，添加 )}}
  const agentEnd = c.indexOf('<div ref={msgEndRef}');
  const afterRef = c.indexOf('</div>', c.indexOf('</div>', c.indexOf('</div>', c.indexOf('ref={msgEndRef}'))+6)+6)+6;
  // 简单点：找第4个 </div> 从 msgEndRef 之后
  let divCount = 0;
  let pos = agentEnd;
  while (divCount < 4 && pos < c.length) {
    pos = c.indexOf('</div>', pos);
    if (pos < 0) break;
    divCount++;
    pos += 6;
  }
  if (pos > 0 && pos < c.length) {
    c = c.substring(0, pos) + '\n            )}\n          </div>\n        )}' + c.substring(pos);
  }
}

// 1d. 完整报告加上 showFullReport
c = c.replace(
  '<h2 className="text-lg font-bold text-[#f5f1eb] mb-4">📄 完整分析报告</h2>',
  '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2><button onClick={()=>setShowFullReport(!showFullReport)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showFullReport?"收起":"查看"}</button></div>'
);
c = c.replace(
  '{report.split',
  '{showFullReport && report.split'
);

fs.writeFileSync(fp, c, "utf-8");
console.log("1. Analysis page patched");

// ===== 2. 首页缓存检查 =====
const homePage = "D:/project/TradingAgents-astock/app/page.tsx";
let h = fs.readFileSync(homePage, "utf-8");

if (h.includes("router.push")) {
  h = h.replace(
    "const date = new Date().toISOString().slice(0, 10);\n    router.push",
    'const date = new Date().toISOString().slice(0, 10);\n    try {\n      const r = await fetch("/api/analyze", {\n        method: "POST", headers: {"Content-Type":"application/json"},\n        body: JSON.stringify({ticker:code,date}),\n      });\n      const d = await r.json();\n      if (d.taskId) { router.push("/analysis/"+encodeURIComponent(code)+"?date="+date+"&taskId="+d.taskId); return; }\n    } catch(_){}\n    router.push'
  );
  fs.writeFileSync(homePage, h, "utf-8");
  console.log("2. Home page cache check added");
}

// ===== 3. 确认编译 =====
const { execSync } = require("child_process");
try {
  const r = execSync("npx tsc --noEmit", { cwd: "D:/project/TradingAgents-astock", encoding: "utf-8", timeout: 30000 });
  console.log("3. TypeScript OK:" + (r || "no errors"));
} catch(e) {
  console.log("3. TypeScript errors:\n" + e.stdout);
}
