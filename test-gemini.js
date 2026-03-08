const https = require('https');
const data = JSON.stringify({
  model: 'gemini-2.0-flash',
  messages: [{ role: 'user', content: 'hello' }]
});
const req = https.request('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test',
    'Content-Type': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});
req.write(data);
req.end();
