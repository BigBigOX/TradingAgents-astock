/**
 * A 股数据工具函数 — ticker 标准化 + 中文解析
 * 对应 Python dataflows/utils.py
 */

/** 标准化为 6 位代码 */
export function normalizeTicker(symbol: string): string {
  if (!symbol) return symbol;
  let code = symbol.replace(/^[sz|sh|bj]/i, '').replace(/\.(ss|sz|sh)$/i, '').replace(/[^\d]/g, '').trim();
  while (code.length < 6) code = '0' + code;
  return code;
}

/** 获取 API 市场前缀 sh/sz/bj */
export function getMarketPrefix(code: string): string {
  const c = code.trim();
  if (c.startsWith('6') || c.startsWith('9')) return 'sh';
  if (c.startsWith('0') || c.startsWith('3')) return 'sz';
  if (c.startsWith('4') || c.startsWith('8')) return 'bj';
  return 'sh';
}

interface NameCodeMap { nameToCode: Record<string, string>; codeToName: Record<string, string>; lastFetch: number; }
let nameCodeCache: NameCodeMap | null = null;
const CACHE_TTL = 3600000;

async function buildNameCodeMap(): Promise<NameCodeMap> {
  const now = Date.now();
  if (nameCodeCache && now - nameCodeCache.lastFetch < CACHE_TTL) return nameCodeCache;
  const nameToCode: Record<string, string> = {};
  const codeToName: Record<string, string> = {};
  for (const mc of [{ fs: 'm:1+t:2,m:1+t:23' }, { fs: 'm:0+t:6,m:0+t:80' }, { fs: 'm:0+t:81+s:2048' }]) {
    try {
      // 东方财富限制每页最多100条，需要分页获取
      let page = 1, total = 0, fetched = 0;
      do {
        const params = new URLSearchParams({ pn: String(page), pz: '100', po: '0', np: '1', fltt: '2', invt: '2', fs: mc.fs, fields: 'f12,f14' });
        const resp = await fetch('https://push2.eastmoney.com/api/qt/clist/get?' + params.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await resp.json();
        if (page === 1) total = json?.data?.total || 0;
        const items = json?.data?.diff || [];
        fetched += items.length;
        for (const item of items) {
          const code = String(item.f12 || ''), name = String(item.f14 || '');
          if (code && name) { nameToCode[name] = normalizeTicker(code); codeToName[normalizeTicker(code)] = name; }
        }
        page++;
      } while (fetched < total && page <= 50); // 最多取50页（5000条）
    } catch { }
  }
  nameCodeCache = { nameToCode, codeToName, lastFetch: Date.now() };
  return nameCodeCache;
}

export async function resolveTicker(userInput: string): Promise<string> {
  if (!userInput?.trim()) return userInput;
  const t = userInput.trim();
  if (/^([szshbjSZSHBJ]{0,2})?\d+$/.test(t)) return normalizeTicker(t);
  try {
    const map = await buildNameCodeMap();
    if (map.nameToCode[t]) return map.nameToCode[t];
    for (const [name, code] of Object.entries(map.nameToCode)) { if (name.includes(t) || t.includes(name)) return code; }
  } catch { }
  return t;
}

export async function getStockName(code: string): Promise<string> {
  const c = normalizeTicker(code);
  try { return (await buildNameCodeMap()).codeToName[c] || c; } catch { return c; }
}

export function clearNameCache(): void { nameCodeCache = null; }
