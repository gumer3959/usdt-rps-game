window.addEventListener("DOMContentLoaded", () => {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const nextBtn = document.getElementById("nextBtn");

  let localStream;
  let peerConnection;
  let ws;

  async function startLocalVideo() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (err) {
      console.error("Ошибка доступа к камере:", err);
    }
  }

  function connectToServer() {
    ws = new WebSocket("wss://chatroulette-signal.onrender.com");

    ws.addEventListener("open", () => {
      console.log("WebSocket открыт");
      ws.send(JSON.stringify({ type: "join" }));
    });

    ws.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "offer":
            await createPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer }));
            break;

          case "answer":
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
            break;

          case "candidate":
            if (msg.candidate) {
              await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
            break;

          case "partner-found":
            createPeerConnection();
            break;
        }
      } catch (err) {
        console.warn("Ошибка при обработке сообщения:", err);
      }
    });
  }

  async function createPeerConnection() {
    if (peerConnection) {
      peerConnection.close();
    }

    peerConnection = new RTCPeerConnection();

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
  }

  nextBtn.addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "next" }));
    remoteVideo.srcObject = null;
  });

  startLocalVideo();
  connectToServer();
});
