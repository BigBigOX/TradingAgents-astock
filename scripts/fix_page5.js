const fs = require("fs");

// Read current analysis page
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
let c = fs.readFileSync(fp, "utf-8");

// 1. Add extractTickerName before export function
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

// 2. Fix tickerName
c = c.replace("tickerName=''", "tickerName={extractTickerName(messages, ticker)}");

// 3. Add showDebug + showFullReport state
c = c.replace(
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});",
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});\n  const [showDebug, setShowDebug] = useState(false);\n  const [showFullReport, setShowFullReport] = useState(false);"
);

// 4. Full report folding
c = c.replace(
  '<h2 className="text-lg font-bold text-[#f5f1eb] mb-4">📄 完整分析报告</h2>',
  '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2><button onClick={()=>setShowFullReport(!showFullReport)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showFullReport?"收起":"查看"}</button></div>'
);
c = c.replace(
  "report.split('---')",
  "showFullReport && report.split('---')"
);

// 5. Agent section folding
// Find the Agent section container div
const agentDiv = '<div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">';
const agentPos = c.indexOf(agentDiv, c.indexOf("Agent"));
if (agentPos > 0) {
  // Find the next sibling div that ends the Agent section
  // By finding the loading section start
  const loadSection = "正在启动分析引擎";
  const loadPos = c.indexOf(loadSection);
  
  if (loadPos > agentPos) {
    // Go backwards from loadPos to find the closing </div> that ends Agent section
    const beforeLoad = c.lastIndexOf("</div>", loadPos);
    const beforeLoad2 = c.lastIndexOf("</div>", beforeLoad - 1);
    
    // Replace Agent section with folded version
    const agentSection = c.substring(agentPos, beforeLoad2 + 6);
    
    // Count nesting levels to find correct closing
    const foldedAgent = 
      '<div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">' +
      '\n          <button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">' +
      '\n            <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>' +
      '\n            <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>' +
      '\n            <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>' +
      '\n          </button>' +
      '\n          {showDebug && (' +
      '\n            <div>' +
      // Keep the inner content (messages display part)
      agentSection.substring(agentSection.indexOf('<div className="flex items-center justify-between px-4 py-3 border-b'));
      
    // Close the showDebug wrapper
    const closingIdx = foldedAgent.lastIndexOf("</div>");
    const finalAgentSection = foldedAgent.substring(0, closingIdx) + '\n            </div>' + '\n          )}' + foldedAgent.substring(closingIdx);
    
    c = c.substring(0, agentPos) + finalAgentSection + c.substring(beforeLoad2 + 6);
  }
}

fs.writeFileSync(fp + ".tmp", c, "utf-8");
console.log("Done");
