const { io } = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");
const chalk = require("chalk");

const socket = io("http://localhost:3000");

// ✅ Generate ephemeral ECDH key pair
const ecdh = crypto.createECDH("secp256k1");
ecdh.generateKeys();
const publicKey = ecdh.getPublicKey("base64");

let username = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function encryptWithSharedKey(sharedKey, message) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sharedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(message, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptWithSharedKey(sharedKey, encryptedBase64) {
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", sharedKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

rl.question("Enter your name: ", (name) => {
  username = name;
  socket.emit("join", { username, publicKey });
  rl.setPrompt("> ");
  rl.prompt();

  socket.on("message", (msg) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    console.log(chalk.green(msg));
    rl.prompt();
  });

  socket.on("dm", async ({ from, encryptedMessage }) => {
    socket.emit("getPublicKey", from, (pubKeyBase64) => {
      if (!pubKeyBase64) return;
      const pubKeyBuffer = Buffer.from(pubKeyBase64, "base64");
      const sharedKey = ecdh.computeSecret(pubKeyBuffer).slice(0, 32);
      try {
        const decrypted = decryptWithSharedKey(sharedKey, encryptedMessage);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        console.log(chalk.magentaBright(`[DM from ${from}]: ${decrypted}`));
        rl.prompt();
      } catch (err) {
        console.error(chalk.red("Failed to decrypt DM."));
      }
    });
  });

  rl.on("line", async (input) => {
    if (input.startsWith("/dm ")) {
      const [, to, ...rest] = input.split(" ");
      const message = rest.join(" ");
      const theirPubKeyBase64 = await new Promise((res) =>
        socket.emit("getPublicKey", to, (key) => res(key))
      );
      if (!theirPubKeyBase64) {
        console.log(chalk.red(`User "${to}" not found.`));
        rl.prompt();
        return;
      }

      const theirKey = Buffer.from(theirPubKeyBase64, "base64");
      const sharedKey = ecdh.computeSecret(theirKey).slice(0, 32);
      const encryptedMessage = encryptWithSharedKey(sharedKey, message);

      console.log(chalk.gray(`[Encrypted → ${to}]: ${encryptedMessage}`));
      console.log(chalk.blue(`[You → ${to}]: ${message}`));

      socket.emit("dm", { to, encryptedMessage });
    } else {
      socket.emit("message", input);
    }
    rl.prompt();
  });
});
