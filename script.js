window.addEventListener('DOMContentLoaded', () => {
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const nextBtn = document.getElementById('nextBtn');

  let localStream;
  let peerConnection;
  let ws;
  let isInitiator = false;

  const SIGNAL_SERVER_URL = 'wss://chatroulette-signal.onrender.com';

  const iceConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  function startWebSocket() {
    ws = new WebSocket(SIGNAL_SERVER_URL);

    ws.onopen = () => {
      console.log('WebSocket открыт');
      ws.send(JSON.stringify({ type: 'join' }));
    };

    ws.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log('Сообщение от сервера:', data);

      switch (data.type) {
        case 'offer':
          if (!peerConnection) createPeerConnection();
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', answer }));
          break;

        case 'answer':
          if (peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
          break;

        case 'candidate':
          if (peerConnection) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.error('Ошибка добавления кандидата:', err);
            }
          }
          break;

        case 'partner-found':
          isInitiator = true;
          createPeerConnection();
          break;

        case 'partner-left':
          closeConnection();
          break;
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket ошибка:', err);
    };
  }

  async function startCamera() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (err) {
      console.error('Ошибка доступа к камере/микрофону:', err);
    }
  }

  function createPeerConnection() {
    if (peerConnection) {
      peerConnection.close();
    }

    peerConnection = new RTCPeerConnection(iceConfig);

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
      }
    };

    peerConnection.ontrack = (e) => {
      remoteVideo.srcObject = e.streams[0];
    };

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    if (isInitiator) {
      peerConnection.onnegotiationneeded = async () => {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', offer }));
      };
    }
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
    ws.send(JSON.stringify({ type: 'next' }));
  };

  console.log('🚀 Запуск камеры и WebSocket');
  await startCamera();
  startWebSocket();
});
