const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = new Map(); // socket.id -> username
const sockets = new Map(); // username -> socket
const pubKeys = new Map(); // username -> publicKey base64

function broadcastUserList() {
  const allUsers = Array.from(sockets.keys());
  io.emit("userList", allUsers);
}

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("join", ({ username, publicKey }) => {
    users.set(socket.id, username);
    sockets.set(username, socket);
    pubKeys.set(username, publicKey);
    socket.broadcast.emit("message", `${username} joined the chat.`);
    broadcastUserList();
  });

  socket.on("getPublicKey", (to, cb) => {
    cb(pubKeys.get(to) || null);
  });

  socket.on("dm", ({ to, encryptedMessage }) => {
    const from = users.get(socket.id);
    const target = sockets.get(to);
    if (from && target) {
      target.emit("dm", { from, encryptedMessage });
    }
  });

  socket.on("message", (msg) => {
    const username = users.get(socket.id);
    if (username) {
      const fullMessage = `${username}: ${msg}`;
      console.log(`Processing message from ${username}: ${msg}`);
      console.log(`Sending back to sender: ${fullMessage}`);
      socket.emit("message", fullMessage); // 👈 Send to sender
      socket.broadcast.emit("message", fullMessage); // 👈 Send to others
    }
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      sockets.delete(user);
      pubKeys.delete(user);
      socket.broadcast.emit("message", `${user} left.`);
      broadcastUserList();
    }
  });
});

server.listen(3000, () => {
  console.log("🚀 Server listening on http://localhost:3000");
});
