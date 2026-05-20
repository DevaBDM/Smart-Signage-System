const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/prisma");
const { createGroup, createUser } = require("./helpers");

describe("GET /api/live-streams", () => {
  it("returns empty array when no streams exist", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });
    const res = await request(app)
      .get("/api/live-streams")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists streams scoped to creator's group", async () => {
    const groupA = await createGroup();
    const groupB = await createGroup();
    const { token, user } = await createUser({ role: "creator", group_id: groupA.id });

    await prisma.liveStream.create({
      data: {
        title: "Stream A",
        stream_type: "HLS",
        source_url: "https://example.com/stream.m3u8",
        group_id: groupA.id,
        created_by: user.id,
      },
    });
    await prisma.liveStream.create({
      data: {
        title: "Stream B",
        stream_type: "HLS",
        source_url: "https://example.com/other.m3u8",
        group_id: groupB.id,
        created_by: user.id,
      },
    });

    const res = await request(app)
      .get("/api/live-streams")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Stream A");
  });
});

describe("POST /api/live-streams", () => {
  it("creates an HLS stream", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });

    const res = await request(app)
      .post("/api/live-streams")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test HLS",
        stream_type: "HLS",
        source_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        group_id: group.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Test HLS");
    expect(res.body.stream_type).toBe("HLS");
    expect(res.body.source_url).toMatch(/\.m3u8$/);
    expect(res.body.status).toBe("idle");
  });

  it("creates an RTMP stream with auto-generated key", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });

    const res = await request(app)
      .post("/api/live-streams")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "OBS Feed",
        stream_type: "RTMP",
        group_id: group.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.stream_type).toBe("RTMP");
    expect(res.body.stream_key).toBeTruthy();
    expect(res.body.stream_key.length).toBe(32);
  });

  it("rejects invalid HLS URL", async () => {
    const group = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: group.id });

    const res = await request(app)
      .post("/api/live-streams")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Bad URL",
        stream_type: "HLS",
        source_url: "https://example.com/not-an-m3u8",
        group_id: group.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not match expected pattern/);
  });

  it("rejects creation in another group", async () => {
    const groupA = await createGroup();
    const groupB = await createGroup();
    const { token } = await createUser({ role: "creator", group_id: groupA.id });

    const res = await request(app)
      .post("/api/live-streams")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Sneaky",
        stream_type: "HLS",
        source_url: "https://example.com/stream.m3u8",
        group_id: groupB.id,
      });

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/live-streams/:id", () => {
  it("updates stream title and source_url", async () => {
    const group = await createGroup();
    const { token, user } = await createUser({ role: "creator", group_id: group.id });
    const stream = await prisma.liveStream.create({
      data: {
        title: "Old Title",
        stream_type: "HLS",
        source_url: "https://old.example.com/stream.m3u8",
        group_id: group.id,
        created_by: user.id,
      },
    });

    const res = await request(app)
      .put(`/api/live-streams/${stream.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "New Title",
        source_url: "https://new.example.com/stream.m3u8",
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
    expect(res.body.source_url).toBe("https://new.example.com/stream.m3u8");
  });
});

describe("DELETE /api/live-streams/:id", () => {
  it("deletes a stream with no published posts", async () => {
    const group = await createGroup();
    const { token, user } = await createUser({ role: "creator", group_id: group.id });
    const stream = await prisma.liveStream.create({
      data: {
        title: "Deletable",
        stream_type: "HLS",
        source_url: "https://example.com/stream.m3u8",
        group_id: group.id,
        created_by: user.id,
      },
    });

    const res = await request(app)
      .delete(`/api/live-streams/${stream.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("blocks delete if published posts reference the stream", async () => {
    const group = await createGroup();
    const { token, user } = await createUser({ role: "creator", group_id: group.id });
    const stream = await prisma.liveStream.create({
      data: {
        title: "In Use",
        stream_type: "HLS",
        source_url: "https://example.com/stream.m3u8",
        group_id: group.id,
        created_by: user.id,
      },
    });
    await prisma.post.create({
      data: {
        title: "Live Post",
        slug: `live-post-${Date.now()}`,
        group_id: group.id,
        created_by: user.id,
        status: "published",
        allowed_on_signage: true,
        live_stream_id: stream.id,
      },
    });

    const res = await request(app)
      .delete(`/api/live-streams/${stream.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Cannot delete/);
  });
});
