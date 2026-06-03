const http = require('http');
const data = JSON.stringify({ticker:'000001',date:'2026-06-03'});
const opts = {hostname:'127.0.0.1',port:3001,path:'/api/analyze',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
let firstByte = true;
const req = http.request(opts, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  let buf = '';
  res.on('data', chunk => {
    if (firstByte) { console.log('First byte received'); firstByte = false; }
    buf += chunk.toString();
    // 打印前 500 字节
    if (buf.length > 0 && buf.length <= 2000) console.log('DATA:', chunk.toString().slice(0,500));
  });
  res.on('end', () => console.log('=== DONE ===, total:', buf.length));
});
req.setTimeout(60000, () => { console.log('TIMEOUT'); process.exit(1); });
req.write(data);
req.end();