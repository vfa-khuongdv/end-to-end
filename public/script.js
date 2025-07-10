let socket;
let username = "";
let publicKey, privateKey;
const peers = {};

const log = (msg) => {
  const line = document.createElement("div");
  line.textContent = msg;
  document.getElementById("chatLog").appendChild(line);
  line.scrollIntoView();
};

const logE2EE = (msg) => {
  const line = document.createElement("div");
  line.textContent = msg;
  document.getElementById("e2eeLog").appendChild(line);
  line.scrollIntoView();
};

async function connect() {
  username = document.getElementById("username").value.trim();
  if (!username) return alert("Username is required");

  const kp = await generateKeyPair();
  publicKey = kp.base64;
  privateKey = kp.privateKey;

  socket = io();

  // Set up event listeners BEFORE joining
  socket.on("message", (msg) => {
    console.log("Received message:", msg);
    log(msg);
  });

  socket.on("dm", async ({ from, encryptedMessage }) => {
    const peerKey = await getPeerKey(from);
    const sharedKey = await deriveAESKey(peerKey);
    try {
      const decrypted = await decrypt(sharedKey, encryptedMessage);
      log(`[DM from ${from}]: ${decrypted}`);
      const preview = encryptedMessage.slice(0, 10) + "...";
      logE2EE(`📥 Received encrypted from ${from}: ${preview}`);
      logE2EE(`🔓 Decrypted DM from ${from}: ${decrypted}`);
    } catch {
      log(`⚠️ Failed to decrypt message from ${from}`);
    }
  });

  socket.on("userList", (users) => {
    const list = document.getElementById("userList");
    list.innerHTML = "";
    users.forEach((user) => {
      const btn = document.createElement("button");
      btn.textContent = user;
      btn.className =
        "block w-full text-left px-2 py-1 rounded hover:bg-gray-200";
      if (user === username) {
        btn.classList.add("text-gray-400", "italic");
        btn.disabled = true;
      } else {
        btn.onclick = () => {
          document.getElementById("message").value = `/dm ${user} `;
          document.getElementById("message").focus();
        };
      }
      list.appendChild(btn);
    });
  });

  // Now emit join after event listeners are set up
  socket.emit("join", { username, publicKey });

  document.getElementById("chatUI").classList.remove("hidden");
  logE2EE(`[${username}] 🔑 ECDH key generated`);
}

async function sendMessage() {
  const input = document.getElementById("message");
  const raw = input.value.trim();
  input.value = "";
  input.style.height = "auto"; // reset textarea height

  if (!raw) return;

  if (raw.startsWith("/dm ")) {
    const [, to, ...rest] = raw.split(" ");
    const msg = rest.join(" ");
    const peerKey = await getPeerKey(to);
    const sharedKey = await deriveAESKey(peerKey);
    const encrypted = await encrypt(sharedKey, msg);

    const preview = encrypted.slice(0, 10) + "...";
    log(`[You → ${to}]: ${msg}`);
    logE2EE(`📤 Encrypted DM to ${to}: ${preview}`);
    logE2EE(`🔐 Using shared AES key for ${to}`);

    socket.emit("dm", { to, encryptedMessage: encrypted });
  } else {
    console.log("Sending message:", raw);
    socket.emit("message", raw);
  }
}

async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return {
    base64: btoa(String.fromCharCode(...new Uint8Array(raw))),
    privateKey: keyPair.privateKey,
  };
}

async function getPeerKey(name) {
  if (peers[name]) return importPeerKey(peers[name]);
  return await new Promise((resolve) => {
    socket.emit("getPublicKey", name, async (key) => {
      peers[name] = key;
      resolve(await importPeerKey(key));
    });
  });
}

async function importPeerKey(base64) {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

async function deriveAESKey(theirPubKey) {
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPubKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  logE2EE("🔐 Derived shared AES key");
  return key;
}

async function encrypt(key, msg) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(msg);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const full = new Uint8Array([...iv, ...new Uint8Array(ciphertext)]);
  return btoa(String.fromCharCode(...full));
}

async function decrypt(key, base64) {
  const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const data = buf.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

// Enter key support for sending messages
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message");
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});

// Tab switching on mobile
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.add("hidden"));
    document.getElementById(`tab-${target}`).classList.remove("hidden");
  });
});
