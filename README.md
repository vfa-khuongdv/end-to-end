# 🔐 End-to-End Encrypted Chat

A real-time chat application built with **Node.js**, **Socket.IO**, and **Tailwind CSS**, featuring **end-to-end encryption** using **ECDH key exchange** and **AES-GCM encryption** via the Web Crypto API.

> 🧪 Perfect for demonstrating how end-to-end encryption works in the browser!

---

## 🚀 Features

- ✅ Real-time messaging via Socket.IO
- 🔐 End-to-End Encrypted Direct Messages (ECDH + AES-GCM)
- 📜 Tailwind CSS-based UI
- 👥 Live user list with click-to-DM
- 🪵 In-browser E2EE debug log
- 📦 Lightweight and dependency-free frontend (no bundlers)

---

## 🧱 Tech Stack

| Layer    | Tool/Tech                          |
| -------- | ---------------------------------- |
| Server   | Node.js, Express, Socket.IO        |
| Frontend | HTML, Tailwind CSS, Web Crypto API |
| Security | ECDH (P-256), AES-256-GCM          |

---

## 📦 Installation

```bash
git clone git@github.com:vfa-khuongdv/end-to-end.git
cd end-to-end
npm install
```

---

## 🧪 Run the App

```bash
node server.js
```

Then open:
➡️ `http://localhost:3000` in **two browsers or tabs**
➡️ Enter different usernames to test encrypted messages

---

## ✍️ Usage

- Send public messages by typing directly.
- Send encrypted direct messages using:

```bash
/dm <username> <message>
```

OR click a username from the **user list** to auto-fill `/dm`.

---

## 🧠 How E2EE Works

1. On join, each browser generates an ECDH key pair (P-256).
2. Public keys are shared via the server.
3. On DM:

   - Shared AES key is derived via `ECDH.computeSecret`.
   - Message is encrypted with `AES-GCM`.
   - Server never sees the plaintext.

4. On receive:

   - Shared AES key is re-derived.
   - Message is decrypted with Web Crypto.

> 🔍 All cryptographic steps are logged in the **E2EE Debug Log** panel.

---

## 📁 Project Structure

```
e2ee-chat/
├── public/
│   └── index.html         # Frontend UI + encryption logic
├── server.js              # Socket.IO server
├── package.json
└── .gitignore
```

---

## 🛡️ Security Notes

- Public keys are ephemeral per session.
- No keys or messages are stored.
- AES-GCM provides integrity + confidentiality.
- No forward secrecy (ECDH session key reused for duration).

---

## 📘 License

MIT — feel free to fork, modify, and use for learning or demos.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## 📧 Contact

For questions or feedback, please reach out to [khuongdv@vitalify.asia](mailto:khuongdv@vitalify.asia).
