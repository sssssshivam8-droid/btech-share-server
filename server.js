// BTECH Share - minimal WebRTC signaling server
// Only relays small JSON messages (offer/answer/ICE). Never touches file data.
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// room code -> Set of sockets
const rooms = new Map();

function joinRoom(ws, code) {
  ws.room = code;
  if (!rooms.has(code)) rooms.set(code, new Set());
  rooms.get(code).add(ws);
}

function leaveRoom(ws) {
  if (ws.room && rooms.has(ws.room)) {
    rooms.get(ws.room).delete(ws);
    if (rooms.get(ws.room).size === 0) rooms.delete(ws.room);
  }
}

function relay(ws, raw) {
  if (!ws.room || !rooms.has(ws.room)) return;
  const text = raw.toString(); // force text frame so browsers get a string, not a Blob
  for (const peer of rooms.get(ws.room)) {
    if (peer !== ws && peer.readyState === WebSocket.OPEN) {
      peer.send(text);
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'join') {
      joinRoom(ws, String(msg.room));
      const peerCount = rooms.get(ws.room).size;
      ws.send(JSON.stringify({ type: 'joined', peers: peerCount - 1 }));
      // tell existing peers someone new arrived
      relay(ws, JSON.stringify({ type: 'peer-joined' }));
      return;
    }

    // everything else (offer/answer/ice) just gets relayed as-is
    relay(ws, raw);
  });

  ws.on('close', () => leaveRoom(ws));
});

console.log('BTECH Share signaling server running on port ' + PORT);
