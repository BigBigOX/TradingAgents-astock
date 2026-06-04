const http = require('http');
const data = JSON.stringify({ticker:'600000',date:'2026-06-03'});
const opts = {hostname:'127.0.0.1',port:3001,path:'/api/analyze',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opts, res => {
  let buf = '';
  res.on('data', chunk => buf += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', buf.slice(0,1000)));
});
req.setTimeout(15000, () => { console.log('TIMEOUT 15s'); process.exit(1); });
req.write(data);
req.end();