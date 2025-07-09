let socket;
let username = "";
let publicKey, privateKey;
const peers = {};

const log = (msg) => {
  const el = document.createElement("div");
  el.textContent = msg;
  document.getElementById("chatLog").appendChild(el);
  el.scrollIntoView();
};

const logE2EE = (msg) => {
  const el = document.createElement("div");
  el.textContent = msg;
  document.getElementById("e2eeLog").appendChild(el);
  el.scrollIntoView();
};

async function connect() {
  username = document.getElementById("username").value.trim();
  if (!username) return alert("Username required");

  const keys = await generateKeyPair();
  publicKey = keys.base64;
  privateKey = keys.privateKey;

  socket = io();
  socket.emit("join", { username, publicKey });

  document.getElementById("chatUI").classList.remove("hidden");
  logE2EE(`[${username}] 🔑 ECDH key generated`);

  socket.on("message", (msg) => log(msg));

  socket.on("dm", async ({ from, encryptedMessage }) => {
    logE2EE(`📥 Encrypted message from ${from}`);
    const theirKey = await getPeerKey(from);
    const sharedKey = await deriveAESKey(theirKey);
    try {
      const plain = await decrypt(sharedKey, encryptedMessage);
      log(`[DM from ${from}]: ${plain}`);
      logE2EE(`🔓 Decrypted: ${plain}`);
    } catch {
      log(`⚠️ Failed to decrypt DM from ${from}`);
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
}

async function sendMessage() {
  const input = document.getElementById("message");
  const msg = input.value.trim();
  if (!msg) return;

  if (msg.startsWith("/dm ")) {
    const [, to, ...rest] = msg.split(" ");
    const content = rest.join(" ");
    const theirKey = await getPeerKey(to);
    const sharedKey = await deriveAESKey(theirKey);
    const encrypted = await encrypt(sharedKey, content);
    log(`[You → ${to}]: ${content}`);
    logE2EE(`📤 Encrypted DM to ${to}: ${encrypted}`);
    socket.emit("dm", { to, encryptedMessage: encrypted });
  } else {
    socket.emit("message", msg);
  }

  input.value = "";
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
  return await new Promise((res) => {
    socket.emit("getPublicKey", name, async (key) => {
      peers[name] = key;
      res(await importPeerKey(key));
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
  logE2EE(`🔐 Shared AES key derived`);
  return key;
}

async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(text);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  const out = new Uint8Array([...iv, ...new Uint8Array(cipher)]);
  return btoa(String.fromCharCode(...out));
}

async function decrypt(key, b64) {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const data = buf.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
