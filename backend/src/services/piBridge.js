/**
 * Pi Bridge – thin wrapper around the Socket.IO emitter.
 * Avoids storing the emitter on Express app state (req.app.get).
 */
let _emitter = null;

const setEmitter = (fn) => {
  _emitter = fn;
};

const getEmitter = () => _emitter;

const emitToDeviceAck = (device_id, event, data, timeout = 10000) => {
  if (!_emitter) {
    return Promise.resolve({
      ok: false,
      error: "Socket bridge is not ready",
    });
  }
  return _emitter(device_id, event, data, timeout);
};

module.exports = { setEmitter, getEmitter, emitToDeviceAck };
