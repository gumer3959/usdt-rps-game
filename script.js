console.log('🚀 Запуск камеры и WebSocket');

const localVideo = document.querySelectorAll('video')[0];
const remoteVideo = document.querySelectorAll('video')[1];
const nextButton = document.getElementById('nextButton');

let localStream;
let peerConnection;
let socket;
let reconnectTimeout;

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

async function startLocalVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createSocket() {
  socket = new WebSocket('wss://chatroulette-signal.onrender.com');

  socket.onopen = () => {
    console.log('📡 WebSocket открыт');
    socket.send(JSON.stringify({ type: 'join' }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'partner-found') {
        console.log('🤝 Партнёр найден');
        startWebRTC();
      } else if (data.type === 'offer') {
        console.log('📦 Получен offer', data.offer);
        await createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'answer', answer }));
      } else if (data.type === 'answer') {
        console.log('📦 Получен answer', data.answer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate') {
        console.log('🧊 ICE candidate получен');
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('❌ Ошибка при добавлении ICE:', e);
        }
      }
    } catch (err) {
      console.warn('Ошибка обработки сообщения:', err);
    }
  };
}

async function createPeerConnection() {
  if (peerConnection) {
    console.warn('⚠️ Предыдущий peerConnection всё ещё существует. Закрываем.');
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(iceConfig);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  peerConnection.ontrack = event => {
    console.log('📺 Получен медиапоток от партнёра');
    remoteVideo.srcObject = event.streams[0];
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}

async function startWebRTC() {
  await createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.send(JSON.stringify({ type: 'offer', offer }));
}

nextButton.onclick = () => {
  peerConnection?.close();
  remoteVideo.srcObject = null;
  socket?.close();
  clearTimeout(reconnectTimeout);
  setTimeout(() => {
    createSocket();
  }, 200);
};

startLocalVideo().then(createSocket);
