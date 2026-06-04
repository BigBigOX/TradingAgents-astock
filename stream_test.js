const http = require('http');
let buf = '';
const data = JSON.stringify({ticker:'000001',date:'2026-06-03'});
const opts = {hostname:'127.0.0.1',port:3001,path:'/api/analyze',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opts, res => {
  res.on('data', chunk => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === 'stage') console.log('[STAGE]', JSON.stringify(d));
        else if (d.type === 'agent_report') console.log('[REPORT]', d.agent, 'len=' + (d.content||'').length);
        else if (d.type === 'error') console.log('[ERROR]', d.message);
        else if (d.type === 'complete') console.log('[COMPLETE]', d.signal || d.decision);
        else console.log('[' + d.type + ']', JSON.stringify(d).slice(0,200));
      } catch(e) {}
    }
  });
  res.on('end', () => console.log('=== DONE ==='));
});
req.setTimeout(120000, () => { console.log('TIMEOUT'); process.exit(1); });
req.write(data);
req.end();