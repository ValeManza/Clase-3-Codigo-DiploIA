const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Parse JSON bodies (for preset API)
app.use(express.json({ limit: '10mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  Preset Storage (shared across all users via JSON file)
// ============================================================

const PRESETS_PATH = path.join(__dirname, 'presets.json');

// Beautiful default presets shipped with the app
const DEFAULT_PRESETS = {
  "Cebra": {
    frequency: "3", amplitude: "2.4", sigma: "1.75", orientation: "0.2",
    warp: "0.1", rippleAmount: "0.05", rippleFreq: "0.2", rippleSpeed: "0.8",
    glowIntensity: "1.3", glowRadius: "0.65",
    brightness: "1.0", contrast: "1.0",
    color1: "#000000", color2: "#da9b72", color3: "#ffeddb"
  },
  "Gotas": {
    frequency: "14.9", amplitude: "1.55", sigma: "2", orientation: "0.35",
    warp: "0.3", rippleAmount: "1", rippleFreq: "2", rippleSpeed: "0.95",
    glowIntensity: "1.1", glowRadius: "1.45",
    brightness: "1.0", contrast: "1.0",
    color1: "#a9c1ae", color2: "#1217b5", color3: "#9ec9db"
  },
  "Paisaje cyber": {
    frequency: "7.7", amplitude: "3", sigma: "1.5", orientation: "0.6",
    warp: "0.5", rippleAmount: "0.05", rippleFreq: "0.4", rippleSpeed: "0.7",
    glowIntensity: "1.3", glowRadius: "0.65",
    brightness: "1.0", contrast: "1.0",
    color1: "#51b883", color2: "#000000", color3: "#ee05ff"
  },
  "Seda": {
    frequency: "0.5", amplitude: "1.8", sigma: "1", orientation: "0",
    warp: "1.2", rippleAmount: "0.15", rippleFreq: "1", rippleSpeed: "1",
    glowIntensity: "1", glowRadius: "1.2",
    brightness: "1.0", contrast: "1.0",
    color1: "#ffffff", color2: "#2f99a7", color3: "#003329"
  }
};

// In-memory preset store
let presetStore = {};

function loadPresets() {
  try {
    if (fs.existsSync(PRESETS_PATH)) {
      const data = fs.readFileSync(PRESETS_PATH, 'utf-8');
      presetStore = JSON.parse(data);
      console.log(`[Presets] Cargados ${Object.keys(presetStore).length} presets`);
    } else {
      // Seed with defaults on first run
      presetStore = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
      savePresets();
      console.log(`[Presets] Creados ${Object.keys(presetStore).length} presets por defecto`);
    }
  } catch (err) {
    console.error('[Presets] Error al cargar:', err.message);
    presetStore = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
  }
}

function savePresets() {
  try {
    fs.writeFileSync(PRESETS_PATH, JSON.stringify(presetStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Presets] Error al guardar:', err.message);
  }
}

loadPresets();

// ---- Preset REST API ----

// GET /api/presets — returns all presets (without thumbnail data URLs to reduce bandwidth)
app.get('/api/presets', (req, res) => {
  const list = {};
  for (const [name, preset] of Object.entries(presetStore)) {
    const { thumbnail, ...data } = preset;
    list[name] = data;
  }
  res.json(list);
});

// POST /api/presets — create or update a preset
app.post('/api/presets', (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) {
    return res.status(400).json({ error: 'Se requiere nombre y datos del preset' });
  }
  presetStore[name] = data;
  savePresets();
  console.log(`[Presets] Guardado: "${name}"`);
  res.json({ success: true, name });
});

// DELETE /api/presets/:name — delete a preset
app.delete('/api/presets/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (presetStore[name]) {
    delete presetStore[name];
    savePresets();
    console.log(`[Presets] Eliminado: "${name}"`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Preset no encontrado' });
  }
});

// ============================================================
//  WebSocket Server
// ============================================================

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
