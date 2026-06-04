const fs = require("fs");
const fp = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";
let c = fs.readFileSync(fp, "utf-8");

// 1. 修复 tickerName='' -> 从消息提取
c = c.replace("tickerName=''", "tickerName={extractTickerName(messages, ticker)}");

// 2. 添加 extractTickerName 函数
c = c.replace(
  "export default function AnalysisPage",
  `function extractTickerName(msgs, fallback) {
  for (const m of msgs) {
    const match = m.content.match(/(?:股票名称|股票名|名称|name)[：:]+([^\\n]+)/i);
    if (match) return match[1].trim();
  }
  return fallback;
}

export default function AnalysisPage`
);

// 3. 把Agent推理过程改成默认收起（collapseAll在一开始调用）
c = c.replace(
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});",
  "const [expanded, setExpanded] = useState<Record<string, boolean>>({});\n  const [showReports, setShowReports] = useState(false);"
);

// 4. 完整报告区域改成折叠
const reportStart = c.indexOf('<div className="p-6 bg-[#161616]');
const reportEnd = c.indexOf('<div className="text-center py-4">', reportStart);
if (reportStart > 0 && reportEnd > 0) {
  let reportSection = c.substring(reportStart, reportEnd);
  // 改成折叠版
  let folded = reportSection
    .replace(
      '<h2 className="text-lg font-bold text-[#f5f1eb] mb-4">📄 完整分析报告</h2>',
      '<div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2><button onClick={()=>setShowReports(!showReports)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showReports?"收起":"查看"}</button></div>'
    )
    .replace(
      '{report.split',
      '{showReports && report.split'
    );
  c = c.substring(0, reportStart) + folded + c.substring(reportEnd);
}

// 5. Agent推理过程也默认折叠（但保留可展开功能保持不变）
const agentHeader = c.indexOf('<div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">');
if (agentHeader > 0) {
  // 在Agent推理过程上方添加一个状态控制头
  const beforeAgent = c.lastIndexOf('<h2 className="text-sm font-semibold', agentHeader);
  if (beforeAgent > 0) {
    // 找到完整的Agent推理过程区域结束
    const agentEnd = c.indexOf('<div ref={msgEndRef}', agentHeader);
    const agentSection = c.substring(beforeAgent, agentEnd + 200);
    
    // 在Agent推理过程上面加个折叠按钮
    const newAgentSection = agentSection.replace(
      '<div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">',
      '<div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#1a1a1a]">\n          <button onClick={()=>setShowDebug(!showDebug)} className="flex items-center gap-2 text-sm text-[#888] hover:text-[#f5f1eb] transition-colors">\n            <span className="text-xs">{showDebug?"▼":"▶"}🧠 Agent推理过程</span>\n            <span className="text-xs text-[#555]">({messages.length}条)</span>\n          </button>\n          {showDebug && <div className="flex gap-3"><button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">展开全部</button><button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">收起全部</button></div>}'
    );
    
    // 把原来的 h2 和按钮替换掉
    newAgentSection.replace(
      '<div className="flex items-center gap-2">\n            <h2 className="text-sm font-semibold text-[#f5f1eb]">🧠 Agent 推理过程</h2>\n            {!done && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}\n            <span className="text-xs text-[#555]">（{messages.length} 条）</span>\n          </div>\n          <div className="flex gap-3">\n            <button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">展开全部</button>\n            <button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">收起全部</button>\n          </div>',
      ''
    );
    
    // 把内容区域也包起来
    newAgentSection.replace(
      '<div className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto">',
      '{showDebug && <div className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto">'
    );
    
    // 不够准确，简单粗暴：寻找原来h2的位置直接替换
    const origHeader = c.substring(beforeAgent, agentHeader + 300);
    const newHeader = origHeader.replace(
      '<h2 className="text-sm font-semibold text-[#f5f1eb]">🧠 Agent 推理过程</h2>',
      ''
    ).replace(
      '<div className="flex items-center gap-2">\n            <h2 className="text-sm font-semibold text-[#f5f1eb]">🧠 Agent 推理过程</h2>',
      '<div className="flex items-center gap-2">'
    );
    
    // 检查是否有showDebug状态
    if (!c.includes('showDebug')) {
      c = c.replace(
        'const [showReports, setShowReports]',
        'const [showDebug, setShowDebug] = useState(false);\n  const [showReports, setShowReports]'
      );
    }
    
    // 在Agent推理过程div上添加条件渲染
    // 找到 divide-y 开始位置
    const dividePos = c.indexOf('className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto"');
    if (dividePos > 0) {
      const lineStart = c.lastIndexOf('\n', dividePos);
      c = c.substring(0, lineStart) + '\n          {showDebug && (\n' + c.substring(lineStart + 1);
    }
    
    // 在 msgEndRef 后面加上关闭括号
    c = c.replace(
      '<div ref={msgEndRef} />\n          </div>',
      '<div ref={msgEndRef} />\n          </div>\n          )}'
    );
  }
}

fs.writeFileSync(fp, c, "utf-8");
console.log("Done: " + c.length + " chars");
