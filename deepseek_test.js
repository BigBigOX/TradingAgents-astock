const http = require('https');
const data = JSON.stringify({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'hi' }],
  max_tokens: 10
});
const options = {
  hostname: 'api.deepseek.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-ab1ae1f72acc42ff9afb8da6434e56f2',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body.slice(0,500)));
});
req.on('error', e => console.log('ERROR:', e.message));
req.write(data);
req.end();