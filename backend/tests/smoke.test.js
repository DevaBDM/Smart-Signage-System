const request = require("supertest");
const app = require("../src/app");
const { createGroup, createUser, createPost, createPostImage, createDevice } = require("./helpers");

/** Mock the socket bridge so signage routes don't fail in tests. */
beforeAll(() => {
  app.set(
    "emitToDeviceAck",
    jest.fn(() => Promise.resolve({ ok: true, asset: { asset_id: "mock-asset" } })),
  );
});

describe("POST /api/posts", () => {
  it("creates a post and returns it", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Hello World")
      .field("group_ids", JSON.stringify([group.id]))
      .field("publish_to_feed", "true")
      .field("status", "draft");

    expect(res.status).toBe(200);
    expect(res.body.posts).toBeInstanceOf(Array);
    expect(res.body.posts[0].title).toBe("Hello World");
    expect(res.body.count).toBe(1);
  });

  it("rejects post without group access", async () => {
    const groupA = await createGroup();
    const groupB = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: groupA.id });

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Nope")
      .field("group_ids", JSON.stringify([groupB.id]));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid group access/);
  });
});

describe("PUT /api/posts/:id", () => {
  it("updates a post title", async () => {
    const group = await createGroup();
    const { user, token } = await createUser({ role: "creator", group_id: group.id });
    const post = await createPost({ group_id: group.id, created_by: user.id });

    const res = await request(app)
      .put(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Updated Title");

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
  });

  it("prevents creator from editing another creator's post", async () => {
    const group = await createGroup();
    const { user: owner } = await createUser({ role: "creator", group_id: group.id });
    const { token: otherToken } = await createUser({
      role: "creator",
      group_id: group.id,
      can_manage_other_posts: false,
    });
    const post = await createPost({ group_id: group.id, created_by: owner.id });

    const res = await request(app)
      .put(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .field("title", "Hacked");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin approval/);
  });
});

describe("POST /api/signage/publish", () => {
  it("publishes a post to an approved online device", async () => {
    const group = await createGroup();
    const { user, token } = await createUser({ role: "creator", group_id: group.id });
    const post = await createPost({
      group_id: group.id,
      created_by: user.id,
      status: "published",
      allowed_on_signage: true,
    });
    await createPostImage(post.id);
    const device = await createDevice({
      group_id: group.id,
      is_approved: true,
      status: "online",
    });

    const res = await request(app)
      .post("/api/signage/publish")
      .set("Authorization", `Bearer ${token}`)
      .send({
        post_id: post.id,
        device_id: device.id,
        duration_seconds: 15,
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("blocks publish to unapproved device", async () => {
    const group = await createGroup();
    const { user, token } = await createUser({ role: "creator", group_id: group.id });
    const post = await createPost({
      group_id: group.id,
      created_by: user.id,
      allowed_on_signage: true,
    });
    await createPostImage(post.id);
    const device = await createDevice({
      group_id: group.id,
      is_approved: false,
      status: "online",
    });

    const res = await request(app)
      .post("/api/signage/publish")
      .set("Authorization", `Bearer ${token}`)
      .send({
        post_id: post.id,
        device_id: device.id,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/pending approval/);
  });
});

describe("DELETE /api/signage/devices/:id/assets/:asset_id", () => {
  it("deletes an asset from a device", async () => {
    const group = await createGroup();
    const { user, token } = await createUser({ role: "creator", group_id: group.id });
    const post = await createPost({ group_id: group.id, created_by: user.id });
    const device = await createDevice({
      group_id: group.id,
      is_approved: true,
      status: "online",
    });

    // Seed a tracked asset
    const { prisma } = require("./helpers");
    await prisma.signageAsset.create({
      data: {
        device_id: device.id,
        post_id: post.id,
        asset_id: "test-asset-1",
        asset_name: "Test Asset",
        is_enabled: true,
      },
    });

    const res = await request(app)
      .delete(`/api/signage/devices/${device.id}/assets/test-asset-1`)
      .set("Authorization", `Bearer ${token}`);

    expect([200, 503]).toContain(res.status);
  });
});

describe("POST /api/devices/:id/approve", () => {
  it("approves a pending device and applies pending changes", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "admin" });
    const device = await createDevice({
      is_approved: false,
      pending_name: "New Name",
      pending_ip: "192.168.1.200",
    });

    const res = await request(app)
      .post(`/api/devices/${device.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ group_id: group.id });

    expect(res.status).toBe(200);
    expect(res.body.is_approved).toBe(true);
    expect(res.body.device_name).toBe("New Name");
    expect(res.body.ip_address).toBe("192.168.1.200");
  });

  it("rejects approval by non-admin", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });
    const device = await createDevice({ is_approved: false });

    const res = await request(app)
      .post(`/api/devices/${device.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ group_id: group.id });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    const { password } = await createUser({
      username: "logintest",
      role: "admin",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "logintest", password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe("admin");
  });

  it("rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "wrong" });

    expect(res.status).toBe(401);
  });
});
