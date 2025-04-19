const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');

let localStream;
let peerConnection;
let ws;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function start() {
  console.log("🚀 Запуск камеры и WebSocket");
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  ws = new WebSocket('wss://chatroulette-signal.onrender.com');

  ws.onopen = () => console.log("🔌 WebSocket открыт");

  ws.onmessage = async (event) => {
    const text = event.data instanceof Blob ? await event.data.text() : event.data;
    const msg = JSON.parse(text);

    if (msg.type === 'partner-found') {
      createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', offer }));
    } else if (msg.type === 'offer') {
      createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', answer }));
    } else if (msg.type === 'answer') {
      if (peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    } else if (msg.type === 'candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } else if (msg.type === 'partner-left') {
      closeConnection();
    }
  };

  nextBtn.onclick = () => {
    closeConnection();
    ws.close();
    remoteVideo.srcObject = null;
    setTimeout(start, 500);
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
  };
}

function closeConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

start();