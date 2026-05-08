const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 10000;

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = Buffer.from(body);
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': data.length
        }
      };
      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (e) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      });
      proxyReq.write(data);
      proxyReq.end();
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/speak') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const voiceId = 'AmY1pcgcEc15wyuIj50p';
      const payload = Buffer.from(JSON.stringify({
        text: parsed.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.55, similarity_boost: 0.85 }
      }));
      const options = {
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Length': payload.length
        }
      };
      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'audio/mpeg' });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (e) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      });
      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Jarvis proxy running on port ${PORT}`);
});
