require("dotenv").config();
const http = require("http");
const initSocket = require("./websocket/socket");
const app = require("./app");
const piBridge = require("./services/piBridge");

const server = http.createServer(app);

const { emitToDevice, emitToDeviceAck } = initSocket(server);
app.set("emitToDevice", emitToDevice);
piBridge.setEmitter(emitToDeviceAck);

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
