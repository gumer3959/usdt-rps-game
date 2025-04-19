const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const nextButton = document.getElementById("nextButton");

let localStream;
let peerConnection;
let socket;
let isMakingOffer = false;

const signalingServer = "wss://chatroulette-signal.onrender.com"; // Адрес твоего Render WebSocket

startCamera();

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      connectToServer();
    })
    .catch(error => console.error("Ошибка доступа к камере:", error));
}

function connectToServer() {
  socket = new WebSocket(signalingServer);

  socket.addEventListener("open", () => {
    console.log("WebSocket открыт");
    socket.send(JSON.stringify({ type: "join" }));
  });

  socket.addEventListener("message", async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("Ошибка JSON:", err);
      return;
    }

    if (message.type === "offer") {
      await handleOffer(message.offer);
    } else if (message.type === "answer") {
      await handleAnswer(message.answer);
    } else if (message.type === "candidate") {
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (e) {
          console.error("Ошибка добавления ICE:", e);
        }
      }
    } else if (message.type === "partner-left") {
      closeConnection();
    }
  });

  nextButton.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "next" }));
    closeConnection();
  });
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.addEventListener("track", event => {
    remoteVideo.srcObject = event.streams[0];
  });

  peerConnection.addEventListener("icecandidate", event => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  });

  peerConnection.addEventListener("negotiationneeded", async () => {
    try {
      isMakingOffer = true;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.send(JSON.stringify({ type: "offer", offer }));
    } catch (e) {
      console.error("Ошибка при создании оффера:", e);
    } finally {
      isMakingOffer = false;
    }
  });
}

async function handleOffer(offer) {
  if (peerConnection) peerConnection.close();
  createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.send(JSON.stringify({ type: "answer", answer }));
}

async function handleAnswer(answer) {
  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } else {
    console.warn("Ответ уже получен");
  }
}

function closeConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}
