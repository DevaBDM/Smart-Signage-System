require("dotenv").config();
const http = require("http");
const initSocket = require("./websocket/socket");
const app = require("./app");
const piBridge = require("./services/piBridge");

const server = http.createServer(app);

const { emitToDeviceAck } = initSocket(server);
piBridge.setEmitter(emitToDeviceAck);

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
