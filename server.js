const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket server
const wss = new WebSocketServer({ server });

// Store the latest parameters to send to new clients
let latestParams = null;

wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  // Send the latest parameters to the newly connected client
  if (latestParams) {
    ws.send(JSON.stringify({
      type: 'params',
      data: latestParams
    }));
  }

  // Handle messages from clients
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'params') {
        // Update the latest parameters
        latestParams = msg.data;

        // Broadcast to ALL other connected clients
        const message = JSON.stringify({ type: 'params', data: latestParams });
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
          }
        });
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('[WS] Invalid message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  🎛️  Gabor Noise Synthesizer\n`);
  console.log(`  Control Panel : http://localhost:${PORT}`);
  console.log(`  Visual Output : http://localhost:${PORT}/visual.html`);
  console.log(`  WebSocket     : ws://localhost:${PORT}\n`);
});
