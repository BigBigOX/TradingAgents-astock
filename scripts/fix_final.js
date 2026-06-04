const fs = require("fs");
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
let c = fs.readFileSync(fp, "utf-8");

// 1. 加 showDebug 状态
c = c.replace(
  "const [showReports",
  "const [showDebug, setShowDebug] = useState(false);\n  const [showReports"
);

// 2. 找 Agent 区域的开头
const agentDiv = 'className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden"';
const agentIdx = c.indexOf(agentDiv, c.indexOf("Agent"));
if (agentIdx > 0) {
  // 用 showDebug 包裹整个 Agent 区域
  const wrapper = 
    '{showDebug && (\n' +
    '        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">\n' +
    '          <button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">\n' +
    '            <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>\n' +
    '            <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>\n' +
    '            <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>\n' +
    '          </button>\n';
  
  // 在 agent 区域前面插入折叠头
  c = c.substring(0, agentIdx) + wrapper + '{showDebug && (\n            <div>\n' + c.substring(agentIdx);
  
  // 在 msgEndRef 区域后面补闭合
  const msgEnd = c.indexOf('ref={msgEndRef}');
  if (msgEnd > 0) {
    // 找到这个区域的最后一个 </div> (Agent div 的闭合)
    let closeCount = 0;
    let pos = msgEnd;
    while (closeCount < 5 && pos > 0 && pos < c.length) {
      pos = c.indexOf("</div>", pos + 1);
      if (pos < 0) break;
      closeCount++;
    }
    if (pos > 0) {
      c = c.substring(0, pos + 6) + "\n            )}\n          </div>\n        )}" + c.substring(pos + 6);
    }
  }
}

// 3. 首页缓存检查
const homePage = "D:/project/TradingAgents-astock/app/page.tsx";
if (fs.existsSync(homePage)) {
  let h = fs.readFileSync(homePage, "utf-8");
  h = h.replace(
    'const date = new Date().toISOString().slice(0, 10);\n    router.push',
    'const date = new Date().toISOString().slice(0, 10);\n    try {\n      const r = await fetch("/api/analyze", {\n        method: "POST", headers: {"Content-Type":"application/json"},\n        body: JSON.stringify({ticker:code,date}),\n      });\n      const d = await r.json();\n      if (d.taskId) { router.push("/analysis/"+encodeURIComponent(code)+"?date="+date+"&taskId="+d.taskId); return; }\n    } catch(_){}\n    router.push'
  );
  fs.writeFileSync(homePage, h, "utf-8");
}

fs.writeFileSync(fp, c, "utf-8");
console.log("Done");
