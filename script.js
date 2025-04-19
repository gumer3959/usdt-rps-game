const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');

let localStream;
let peerConnection;
let ws;
let reconnectTimer;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function start() {
  console.log("🚀 Запуск камеры и WebSocket");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  connectWebSocket();
}

function connectWebSocket() {
  ws = new WebSocket('wss://chatroulette-signal.onrender.com');

  ws.onopen = () => {
    console.log("🔌 WebSocket открыт");
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      console.warn("⏳ Не найден партнёр — повторное подключение");
      ws.close();
      connectWebSocket();
    }, 10000);
  };

  ws.onmessage = async (event) => {
    const text = event.data instanceof Blob ? await event.data.text() : event.data;
    const msg = JSON.parse(text);

    if (msg.type === 'partner-found') {
      console.log("🤝 Партнёр найден");
      createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', offer }));
    } else if (msg.type === 'offer') {
      console.log("📦 Получен offer");
      createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', answer }));
    } else if (msg.type === 'answer') {
      console.log("📦 Получен answer");
      if (peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    } else if (msg.type === 'candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } else if (msg.type === 'partner-left') {
      console.log("👋 Партнёр отключился");
      closeConnection();
    }
  };

  ws.onclose = () => {
    console.warn("❌ WebSocket закрыт");
  };
}

function createPeerConnection() {
  if (peerConnection) peerConnection.close();
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteStream = new MediaStream();
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    remoteVideo.srcObject = remoteStream;

    remoteVideo.onloadedmetadata = () => {
      remoteVideo.play().catch(e => console.warn("Ошибка воспроизведения:", e));
    };

    console.log("📺 Получен медиапоток от партнёра");
  };
}

function closeConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

nextBtn.onclick = () => {
  closeConnection();
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  setTimeout(start, 500);
};

start();
