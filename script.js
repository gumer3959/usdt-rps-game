window.addEventListener("DOMContentLoaded", () => {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const nextBtn = document.getElementById("nextBtn");

  let localStream;
  let peerConnection;
  let ws;

  const SIGNAL_URL = "wss://chatroulette-signal.onrender.com";

  async function init() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      connectToSignaling();
    } catch (err) {
      console.error("Ошибка камеры:", err);
    }
  }

  function connectToSignaling() {
    ws = new WebSocket(SIGNAL_URL);

    ws.onopen = () => {
      console.log("✅ WebSocket открыт");
      ws.send(JSON.stringify({ type: "join" }));
    };

    ws.onmessage = async (event) => {
      let msg;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch (err) {
        console.warn("Неправильный JSON:", err);
        return;
      }

      if (!msg) return;

      if (msg.type === "partner-found") {
        createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      } else if (msg.type === "offer") {
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", answer }));
      } else if (msg.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      } else if (msg.type === "candidate") {
        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } else if (msg.type === "partner-left") {
        closeConnection();
      }
    };
  }

  function createPeerConnection() {
    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onnegotiationneeded = async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", offer }));
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
    ws.close();
    setTimeout(init, 500);
  };

  init();
});