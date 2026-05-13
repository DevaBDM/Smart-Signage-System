import { io } from "socket.io-client";

const BASE =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

// Single shared instance — connect only once
const socket = io(BASE, { autoConnect: false });

export default socket;
