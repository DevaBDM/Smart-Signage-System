import { io } from "socket.io-client";
import { assetOrigin } from "../config/apiBase";

const origin = assetOrigin();
const socket = origin
  ? io(origin, { autoConnect: false })
  : io({ autoConnect: false });

export default socket;
