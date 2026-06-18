#!/usr/bin/env node
// CORS proxy for Babylon.js GUI MCP Session Server
// Proxies localhost:3001 adding CORS headers for gui.babylonjs.com
// Usage: node tools/cors-proxy.mjs [targetPort=3001] [proxyPort=3002]

import http from 'node:http';
import { URL } from 'node:url';

const TARGET_PORT = parseInt(process.argv[2] || '3001', 10);
const PROXY_PORT = parseInt(process.argv[3] || '3002', 10);
const TARGET_HOST = '127.0.0.1';

const server = http.createServer((req, res) => {
  // CORS headers — allow everything from gui.babylonjs.com
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Build target URL
  const targetPath = req.url;
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Pass through status and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`CORS proxy: http://0.0.0.0:${PROXY_PORT} → http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`GUI Editor session URL: http://localhost:${PROXY_PORT}/session/<session-id>`);
});
