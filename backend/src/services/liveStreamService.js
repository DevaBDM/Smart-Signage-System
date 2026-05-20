const crypto = require("crypto");
const liveStreamRepo = require("../repositories/liveStreamRepo");
const { canManage, getActorGroupIds } = require("../utils/permissions");

const URL_PATTERNS = {
  HLS: /^https?:\/\/.+\.m3u8(\?.*)?$/i,
  RTSP: /^rtsp:\/\/.+/i,
  YOUTUBE: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
  RTMP: /^rtmp:\/\/.+/i,
};

function validateUrl(streamType, sourceUrl) {
  const pattern = URL_PATTERNS[streamType];
  if (!pattern) throw Object.assign(new Error("Invalid stream_type"), { statusCode: 400 });
  if (!sourceUrl) {
    if (streamType === "RTMP") return; // source_url may be null for RTMP ingest
    throw Object.assign(new Error("source_url is required"), { statusCode: 400 });
  }
  if (!pattern.test(sourceUrl)) {
    throw Object.assign(
      new Error(`source_url does not match expected pattern for ${streamType}`),
      { statusCode: 400 }
    );
  }
}

function generateStreamKey() {
  return crypto.randomBytes(16).toString("hex");
}

async function listForActor(actor) {
  const groupIds = getActorGroupIds(actor);
  if (groupIds === null) {
    return liveStreamRepo.findByGroupIds(
      (await require("../db/prisma").group.findMany({ select: { id: true } })).map((g) => g.id)
    );
  }
  return liveStreamRepo.findByGroupIds(groupIds);
}

async function createStream(actor, data) {
  const { title, stream_type, source_url, group_id, thumbnail_path } = data;
  if (!canManage(actor, group_id)) {
    throw Object.assign(new Error("Forbidden: cannot manage this group"), { statusCode: 403 });
  }
  validateUrl(stream_type, source_url);

  const createData = {
    title,
    stream_type,
    source_url: source_url || null,
    thumbnail_path: thumbnail_path || null,
    group_id: Number(group_id),
    created_by: actor.id,
  };

  if (stream_type === "RTMP") {
    createData.stream_key = generateStreamKey();
  }

  return liveStreamRepo.create(createData);
}

async function updateStream(actor, id, data) {
  const stream = await liveStreamRepo.findById(id);
  if (!stream) throw Object.assign(new Error("Stream not found"), { statusCode: 404 });
  if (!canManage(actor, stream.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  const { title, source_url, thumbnail_path } = data;
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (thumbnail_path !== undefined) updateData.thumbnail_path = thumbnail_path;
  if (source_url !== undefined) {
    validateUrl(stream.stream_type, source_url);
    updateData.source_url = source_url;
  }

  return liveStreamRepo.update(id, updateData);
}

async function deleteStream(actor, id, force = false) {
  const stream = await liveStreamRepo.findById(id);
  if (!stream) throw Object.assign(new Error("Stream not found"), { statusCode: 404 });
  if (!canManage(actor, stream.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  if (!force) {
    const publishedPosts = await liveStreamRepo.findPublishedPostsUsingStream(id);
    if (publishedPosts.length > 0) {
      throw Object.assign(
        new Error(
          `Cannot delete: ${publishedPosts.length} published post(s) reference this stream. Use ?force=true to override.`
        ),
        { statusCode: 409 }
      );
    }
  }

  return liveStreamRepo.remove(id);
}

async function getStream(actor, id) {
  const stream = await liveStreamRepo.findById(id);
  if (!stream) throw Object.assign(new Error("Stream not found"), { statusCode: 404 });
  if (!canManage(actor, stream.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  return stream;
}

module.exports = {
  listForActor,
  createStream,
  updateStream,
  deleteStream,
  getStream,
  validateUrl,
  generateStreamKey,
};
