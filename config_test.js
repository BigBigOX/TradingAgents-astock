const http = require('http');
const data = JSON.stringify({});
const opts = {hostname:'127.0.0.1',port:3001,path:'/api/config',method:'GET'};
const req = http.request(opts, res => {
  let buf = '';
  res.on('data', chunk => buf += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', buf.slice(0,500)));
});
req.setTimeout(10000, () => { console.log('TIMEOUT'); process.exit(1); });
req.end();