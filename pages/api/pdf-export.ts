/**
 * PDF 报告导出 — HTML 渲染
 * 对应 Python web/pdf_export.py
 */

export interface ExportOptions {
  title: string; ticker: string; tradeDate: string; content: string;
  language?: 'zh' | 'en'; includeDisclaimer?: boolean;
}

export function generateReportHtml(options: ExportOptions): string {
  const disclaimer = options.includeDisclaimer !== false
    ? '<div style="margin-top:40px;padding:15px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:10pt;color:#856404;"><p><strong>Disclaimer:</strong> For research purposes only. Not investment advice.</p></div>'
    : '';
  return `<!DOCTYPE html><html lang="${options.language === 'en' ? 'en' : 'zh-CN'}">
<head><meta charset="UTF-8"><title>${e(options.title)}</title>
<style>@page{margin:2cm}body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;font-size:12pt;line-height:1.8;color:#333}h1{color:#1a1a2e;border-bottom:2px solid #e94560;padding-bottom:8px}h2{color:#16213e;margin-top:24px}h3{color:#0f3460}.header{text-align:center;margin-bottom:30px}.header h1{border-bottom:none;font-size:20pt}.meta{color:#666;font-size:10pt;text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ddd;padding:6px 10px;font-size:10pt}th{background:#f5f5f5}</style></head>
<body><div class="header"><h1>${e(options.title)}</h1><div class="meta">${e(options.ticker)} | ${e(options.tradeDate)}</div></div>
<div>${md(options.content)}</div>${disclaimer}</body></html>`;
}

function md(s: string): string {
  return '<p>' + s.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

export function getExportFilename(ticker: string, tradeDate: string, ext = 'pdf'): string {
  return ticker + '_' + tradeDate.replace(/-/g, '') + '_report.' + ext;
}

function e(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
