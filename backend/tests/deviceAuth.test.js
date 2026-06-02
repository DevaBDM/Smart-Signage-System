const request = require("supertest");
const app = require("../src/app");
const { io } = require("socket.io-client");
const prisma = require("../src/db/prisma");
const { createDevice, createGroup, createUser, createPost, createPostImage, createTestServer, waitForEvent } = require("./helpers");

describe("Device Authentication & Pi Script Alignment", () => {
  let server;
  let socketCleanup;
  let serverPort;
  let clientSocket;

  beforeAll(async () => {
    const result = createTestServer();
    server = result.server;
    socketCleanup = result.cleanup;
    serverPort = await result.ready;
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.removeAllListeners();
      clientSocket.close();
    }
    if (socketCleanup) socketCleanup();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    if (clientSocket) {
      clientSocket.removeAllListeners();
      clientSocket.close();
      clientSocket = null;
    }
  });

  // ── Step 1: The "New Pi" Registration Flow ──────────────────
  describe("Step 1: New Pi registration flow", () => {
    it("pre-registered device without token receives device_token on first heartbeat", async () => {
      // Admin pre-registers the device (no token yet, not approved)
      const device = await createDevice({
        id: 999,
        device_name: "Pi-Display-999",
        is_approved: false,
        status: "offline",
      });
      expect(device.device_token).toBeNull();

      // Pi connects without a token
      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, { transports: ["websocket"] });
      await waitForEvent(clientSocket, "connect");

      // Pi sends heartbeat
      clientSocket.emit("heartbeat", {
        device_id: 999,
        device_name: "Pi-Display-999",
        ip_address: "192.168.1.99",
        location: "Test Lab",
        status: "online",
      });

      // Verify server emits device_token
      const tokenEvent = await waitForEvent(clientSocket, "device_token");
      expect(tokenEvent.device_id).toBe(999);
      expect(tokenEvent.token).toBeTruthy();
      expect(typeof tokenEvent.token).toBe("string");
      expect(tokenEvent.token.length).toBeGreaterThanOrEqual(32);

      // Verify DB state
      const updated = await prisma.device.findUnique({ where: { id: 999 } });
      expect(updated.device_token).toBe(tokenEvent.token);
      expect(updated.is_approved).toBe(false);
      expect(updated.status).toBe("online");
    });

    it("pre-registered device WITH existing token rejects unauthenticated heartbeat", async () => {
      const existingToken = "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234";
      await createDevice({
        id: 998,
        device_name: "Pi-Display-998",
        is_approved: true,
        device_token: existingToken,
        status: "offline",
      });

      // Pi connects without token (lost config) — should be rejected
      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, { transports: ["websocket"] });
      await waitForEvent(clientSocket, "connect");

      clientSocket.emit("heartbeat", {
        device_id: 998,
        device_name: "Pi-Display-998",
        ip_address: "192.168.1.98",
        location: "Test Lab",
        status: "online",
      });

      // Wait for server to process and disconnect
      await new Promise((r) => setTimeout(r, 600));
      expect(clientSocket.connected).toBe(false);
    });
  });

  // ── Step 2: Valid Authenticated Heartbeat ───────────────────
  describe("Step 2: Valid authenticated heartbeat", () => {
    it("reconnecting with correct token updates last_seen and keeps socket alive", async () => {
      const deviceToken = "validtoken999validtoken999validtoken999valid";
      await createDevice({
        id: 997,
        device_name: "Pi-Display-997",
        is_approved: true,
        device_token: deviceToken,
        status: "offline",
        last_seen: new Date("2020-01-01"),
      });

      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, {
        transports: ["websocket"],
        auth: { token: deviceToken },
      });
      await waitForEvent(clientSocket, "connect");

      clientSocket.emit("heartbeat", {
        device_id: 997,
        device_name: "Pi-Display-997",
        ip_address: "192.168.1.97",
        location: "Floor 3",
        status: "online",
      });

      // Give the server time to process
      await new Promise((r) => setTimeout(r, 300));

      const updated = await prisma.device.findUnique({ where: { id: 997 } });
      expect(updated.status).toBe("online");
      expect(updated.last_seen.getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());

      // Socket should still be connected
      expect(clientSocket.connected).toBe(true);
    });
  });

  // ── Step 3: The "Spoofing" Vulnerability ────────────────────
  describe("Step 3: Spoofing vulnerability (Finding 1.1)", () => {
    it("rejects heartbeat from known device_id WITHOUT a token", async () => {
      const deviceToken = "secrettoken888secrettoken888secrettoken888sec";
      await createDevice({
        id: 996,
        device_name: "Pi-Display-996",
        is_approved: true,
        device_token: deviceToken,
        status: "offline",
      });

      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, { transports: ["websocket"] });
      await waitForEvent(clientSocket, "connect");

      clientSocket.emit("heartbeat", {
        device_id: 996,
        device_name: "Pi-Display-996",
        ip_address: "192.168.1.96",
        location: "Floor 3",
        status: "online",
      });

      // Server should force-disconnect the socket
      await new Promise((r) => setTimeout(r, 600));
      expect(clientSocket.connected).toBe(false);
    });

    it("rejects connection with a WRONG token", async () => {
      const deviceToken = "correcttoken777correcttoken777correcttoken777";
      await createDevice({
        id: 995,
        device_name: "Pi-Display-995",
        is_approved: true,
        device_token: deviceToken,
        status: "offline",
      });

      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, {
        transports: ["websocket"],
        auth: { token: "wrong-token-995-wrong-token-995-wrong" },
      });

      // Connection should error at handshake level
      await expect(waitForEvent(clientSocket, "connect", 2000)).rejects.toThrow();
    });

    it("rejects heartbeat from UNKNOWN device_id even without token", async () => {
      const baseUrl = `http://127.0.0.1:${serverPort}`;
      clientSocket = io(baseUrl, { transports: ["websocket"] });
      await waitForEvent(clientSocket, "connect");

      clientSocket.emit("heartbeat", {
        device_id: 9000, // unknown ID
        device_name: "Fake-Pi",
        ip_address: "10.0.0.1",
        location: "Nowhere",
        status: "online",
      });

      // Server should force-disconnect the socket
      await new Promise((r) => setTimeout(r, 600));
      expect(clientSocket.connected).toBe(false);
    });
  });

  // ── Step 4: Identity Theft / Horizontal Isolation ─────────────
  describe("Step 4: Identity theft / horizontal isolation (Finding 1.2)", () => {
    it("Device B token cannot access Device A deployments", async () => {
      const group = await createGroup();
      const { user } = await createUser({ role: "creator", group_id: group.id });
      const post = await createPost({
        group_id: group.id,
        created_by: user.id,
        status: "published",
        allowed_on_signage: true,
      });
      await createPostImage(post.id);

      const tokenA = "tokenfordeviceaaaatokenfordeviceaaaa";
      const tokenB = "tokenfordevicebbbbtokenfordevicebbbb";
      const deviceA = await createDevice({
        id: 100,
        device_name: "Device-A",
        is_approved: true,
        device_token: tokenA,
        group_id: group.id,
      });
      const deviceB = await createDevice({
        id: 101,
        device_name: "Device-B",
        is_approved: true,
        device_token: tokenB,
        group_id: group.id,
      });

      // Create a deployment for device A
      await prisma.signageDeployment.create({
        data: {
          device_id: deviceA.id,
          post_id: post.id,
          status: "active",
          priority: 1,
        },
      });

      // Device B tries to pull Device A's deployments
      const res = await request(app)
        .get("/api/signage/device/100/deployments")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Device token does not match requested device/);
    });

    it("Device A token can access its own deployments", async () => {
      const group = await createGroup();
      const { user } = await createUser({ role: "creator", group_id: group.id });
      const post = await createPost({
        group_id: group.id,
        created_by: user.id,
        status: "published",
        allowed_on_signage: true,
      });
      await createPostImage(post.id);

      const tokenA = "tokenfordeviceaaatokenfordeviceaaaaa";
      const deviceA = await createDevice({
        id: 102,
        device_name: "Device-A",
        is_approved: true,
        device_token: tokenA,
        group_id: group.id,
      });

      await prisma.signageDeployment.create({
        data: {
          device_id: deviceA.id,
          post_id: post.id,
          status: "active",
          priority: 1,
        },
      });

      const res = await request(app)
        .get("/api/signage/device/102/deployments")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].post_id).toBe(post.id);
    });
  });

  // ── Step 5: Unauthorized Public Access ──────────────────────
  describe("Step 5: Unauthorized public access", () => {
    it("returns 401 when no token is provided for /deployments", async () => {
      await createDevice({ id: 200, device_name: "Public-Test", is_approved: true });

      const res = await request(app).get("/api/signage/device/200/deployments");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Access denied\. No device token provided/);
    });

    it("returns 401 when an invalid token is provided for /deployments", async () => {
      await createDevice({ id: 201, device_name: "Invalid-Token-Test", is_approved: true });

      const res = await request(app)
        .get("/api/signage/device/201/deployments")
        .set("Authorization", "Bearer totally-invalid-token");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid device token/);
    });
  });
});
