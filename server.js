const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 8080;

const ALLOWED_ORIGINS = [
  'https://jarviszone.com',
  'https://www.jarviszone.com'
];

function setCORS(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function proxyPost(targetUrl, headers, body, res) {
  const url = new URL(targetUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
  };

  const req = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json'
    });
    proxyRes.pipe(res);
  });

  req.on('error', (e) => {
    console.error('Proxy error:', e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Proxy error' }));
  });

  req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  setCORS(req, res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Chat endpoint
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      proxyPost(
        'https://api.anthropic.com/v1/messages',
        {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body,
        res
      );
    });
    return;
  }

  // Speak endpoint
  if (req.method === 'POST' && req.url === '/speak') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const voiceId = 'AmY1pcgcEc15wyuIj50p';
      const payload = JSON.stringify({
        text: parsed.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.55, similarity_boost: 0.85 }
      });

      const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'audio/mpeg' });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Voice error' }));
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
