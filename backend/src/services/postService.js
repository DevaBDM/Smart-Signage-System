const prisma = require("../db/prisma");
const postRepo = require("../repositories/postRepo");
const liveStreamRepo = require("../repositories/liveStreamRepo");
const { canManage, canManagePost, getActor, getActorGroupIds } = require("../utils/permissions");
const { parseDeviceIds, toBool } = require("../utils/parsers");
const { ensureDevicesOnline, getOnlineDeviceIdSet } = require("../utils/devices");
const { parseMediaCrops } = require("../utils/parseMediaCrops");
const {
  extractGroupIds,
  validateSignageState,
  buildSignageMeta,
} = require("../validators/postValidator");
const {
  processMediaFiles,
  deleteMediaFile,
} = require("../utils/mediaProcessor");
const { deployPostToDevices } = require("./deploymentService");

const primaryMediaDuration = (mediaRows, fallback = 10) => {
  const first = mediaRows?.[0];
  if (first?.media_type === "VIDEO" && first.duration_seconds) {
    return first.duration_seconds;
  }
  return fallback;
};

const ALLOWED_MEDIA_PATH_PREFIX = "/uploads/";

const parseProcessedMedia = (body) => {
  const raw = body?.processed_media;
  if (!raw) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return null;
  for (const m of parsed) {
    const p = m?.image_path;
    if (typeof p !== "string" || !p.startsWith(ALLOWED_MEDIA_PATH_PREFIX)) {
      throw Object.assign(
        new Error(`Invalid processed_media path: ${p}`),
        { statusCode: 400 }
      );
    }
  }
  return parsed;
};

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Date.now();

function isEmptyLiveStreamId(val) {
  if (val == null) return true;
  if (typeof val === "string" && ["null", "undefined", "", "NaN"].includes(val.trim())) return true;
  const n = Number(val);
  return Number.isNaN(n);
}

async function validateLiveStream(user, liveStreamId, targetGroupId) {
  if (isEmptyLiveStreamId(liveStreamId)) return null;
  const stream = await liveStreamRepo.findById(Number(liveStreamId));
  if (!stream) throw Object.assign(new Error("Live stream not found"), { statusCode: 404 });
  if (!canManage(user, stream.group_id)) {
    throw Object.assign(new Error("Forbidden: cannot use this live stream"), { statusCode: 403 });
  }
  if (targetGroupId && stream.group_id !== Number(targetGroupId)) {
    throw Object.assign(
      new Error("Live stream group must match post group"),
      { statusCode: 400 }
    );
  }
  return stream;
}


async function createPost(user, body, files) {
  const {
    title,
    description_markdown,
    allowed_on_feed,
    allowed_on_signage,
    publish_to_feed,
    publish_to_signage,
    status,
    device_ids,
    live_stream_id,
  } = body;

  const targetGroupIds = extractGroupIds(body);
  for (const gid of targetGroupIds) {
    if (!canManage(user, gid)) {
      throw Object.assign(new Error(`Invalid group access for group ${gid}`), { statusCode: 403 });
    }
  }

  const selectedDeviceIds = parseDeviceIds(device_ids);

  const creator = await postRepo.findUserById(user.id);
  const isAutoApprove = creator?.auto_approve || user.role === "admin";

  const requestedFeed = toBool(allowed_on_feed !== undefined ? allowed_on_feed : publish_to_feed);
  const requestedSignage = toBool(allowed_on_signage !== undefined ? allowed_on_signage : publish_to_signage);

  if (selectedDeviceIds.length > 0) {
    const chk = await ensureDevicesOnline(prisma, selectedDeviceIds);
    if (!chk.ok) throw Object.assign(new Error(chk.error), { statusCode: 400 });
  }

  const actor = await getActor(user);
  const signageState = validateSignageState(actor, body.signage_state);

  let mediaRows = parseProcessedMedia(body);
  let liveStream = null;

  if (live_stream_id) {
    liveStream = await validateLiveStream(actor, live_stream_id, targetGroupIds[0]);
    mediaRows = []; // live stream posts don't have uploaded media
  } else if (!mediaRows?.length && files?.length) {
    const crops = parseMediaCrops(body, files.length);
    mediaRows = await processMediaFiles(files, crops);
  }

  const signageDuration =
    Number(body.duration_seconds) || primaryMediaDuration(mediaRows, 10);

  const metaPayload = buildSignageMeta(body, signageDuration);

  const createdPosts = [];
  for (const targetGroupId of targetGroupIds) {
    if (liveStream && liveStream.group_id !== Number(targetGroupId)) {
      continue; // skip groups that don't match the live stream's group
    }

    const post = await postRepo.createPost({
      title,
      slug: slugify(title + "-" + targetGroupId),
      description_markdown: description_markdown || null,
      group_id: Number(targetGroupId),
      created_by: user.id,
      signage_state: signageState,
      allowed_on_feed: isAutoApprove ? requestedFeed : false,
      allowed_on_signage: isAutoApprove ? requestedSignage : false,
      requested_feed: requestedFeed,
      requested_signage: requestedSignage,
      status: status || "draft",
      live_stream_id: liveStream ? liveStream.id : undefined,
      images: liveStream
        ? {
            create: liveStream.thumbnail_path
              ? [{
                  image_path: liveStream.thumbnail_path,
                  media_type: "LIVE_STREAM",
                  duration_seconds: null,
                  order_index: 0,
                }]
              : undefined,
          }
        : {
            create: (mediaRows || []).map((m, i) => ({
              image_path: m.image_path,
              media_type: m.media_type || "IMAGE",
              duration_seconds: m.duration_seconds ?? null,
              order_index: i,
            })),
          },
      signage_metadata: { create: metaPayload },
    });

    if (selectedDeviceIds.length > 0) {
      const targetDevices = await postRepo.findDevicesByIds(selectedDeviceIds);
      await deployPostToDevices(null, actor, post, targetDevices, body);
    }

    createdPosts.push(post);
  }

  return { posts: createdPosts, count: createdPosts.length };
}

async function updatePost(user, postId, body, files, emitter) {
  const actor = await getActor(user);
  const post = await postRepo.findPostWithImagesAndAuthor(postId);
  if (!post) throw Object.assign(new Error("Not found"), { statusCode: 404 });
  if (!canManage(actor, post.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!canManagePost(actor, post)) {
    throw Object.assign(
      new Error("You need admin approval to edit another creator's post."),
      { statusCode: 403 },
    );
  }

  const {
    title,
    description_markdown,
    publish_to_feed,
    publish_to_signage,
    allowed_on_feed,
    allowed_on_signage,
    status,
    device_ids,
    live_stream_id,
  } = body;
  const selectedIds = parseDeviceIds(device_ids);
  const isAutoApprove = post.author?.auto_approve || actor.role === "admin";

  let liveStream = null;
  if (live_stream_id !== undefined) {
    if (!isEmptyLiveStreamId(live_stream_id)) {
      liveStream = await validateLiveStream(actor, live_stream_id, post.group_id);
    }
  }

  let mediaRows = parseProcessedMedia(body);
  if (!liveStream && !mediaRows?.length && files?.length) {
    const crops = parseMediaCrops(body, files.length);
    mediaRows = await processMediaFiles(files, crops);
  }

  const isSwitchingToLive = liveStream && !post.live_stream_id;
  const isSwitchingFromLive = live_stream_id === null && post.live_stream_id;
  const isMediaUpdate = mediaRows?.length && !liveStream;

  if (isSwitchingToLive || isSwitchingFromLive || isMediaUpdate) {
    const oldImages = post.images;
    await postRepo.deletePostImages(postId);
    for (const img of oldImages) {
      // Only delete files for non-live images (live uses stream thumbnail path)
      if (img.media_type !== "LIVE_STREAM") {
        deleteMediaFile(img.image_path);
      }
    }
  }

  if (isSwitchingToLive) {
    if (liveStream.thumbnail_path) {
      await postRepo.createPostImages([{
        post_id: postId,
        image_path: liveStream.thumbnail_path,
        media_type: "LIVE_STREAM",
        duration_seconds: null,
        order_index: 0,
      }]);
    }
  } else if (isMediaUpdate) {
    await postRepo.createPostImages(
      mediaRows.map((m, i) => ({
        post_id: postId,
        image_path: m.image_path,
        media_type: m.media_type || "IMAGE",
        duration_seconds: m.duration_seconds ?? null,
        order_index: i,
      })),
    );
  }

  const updatedMedia = mediaRows?.length
    ? mediaRows
    : await postRepo.findPostImages(postId);
  const metaDuration =
    Number(body.duration_seconds) || primaryMediaDuration(updatedMedia, 10);

  await postRepo.upsertSignageMetadata(
    postId,
    buildSignageMeta(body, metaDuration),
    buildSignageMeta(body, metaDuration),
  );

  const data = { title, description_markdown, status };

  if (actor.role === "admin") {
    if (allowed_on_feed !== undefined) {
      data.allowed_on_feed = toBool(allowed_on_feed);
      if (!data.allowed_on_feed) data.requested_feed = false;
    } else if (publish_to_feed !== undefined) {
      data.allowed_on_feed = toBool(publish_to_feed);
      if (!data.allowed_on_feed) data.requested_feed = false;
    }
    if (allowed_on_signage !== undefined) {
      data.allowed_on_signage = toBool(allowed_on_signage);
      if (!data.allowed_on_signage) data.requested_signage = false;
    } else if (publish_to_signage !== undefined) {
      data.allowed_on_signage = toBool(publish_to_signage);
      if (!data.allowed_on_signage) data.requested_signage = false;
    }
  } else {
    const feedVal = allowed_on_feed !== undefined ? allowed_on_feed : publish_to_feed;
    if (feedVal !== undefined) {
      data.requested_feed = toBool(feedVal);
      if (isAutoApprove) data.allowed_on_feed = toBool(feedVal);
    }
    const signageVal = allowed_on_signage !== undefined ? allowed_on_signage : publish_to_signage;
    if (signageVal !== undefined) {
      data.requested_signage = toBool(signageVal);
      if (isAutoApprove) data.allowed_on_signage = toBool(signageVal);
    }
  }

  if (selectedIds.length > 0) {
    const chk = await ensureDevicesOnline(prisma, selectedIds);
    if (!chk.ok) throw Object.assign(new Error(chk.error), { statusCode: 400 });
  }

  if (body.signage_state !== undefined) {
    data.signage_state = validateSignageState(actor, body.signage_state);
  }
  if (live_stream_id !== undefined) {
    data.live_stream_id = live_stream_id ? Number(live_stream_id) : null;
  }

  const updated = await postRepo.updatePost(postId, data);

  // ---- deployment sync ----
  const allDeps = await postRepo.findAllDeploymentsForPost(postId);

  if (!updated.allowed_on_signage) {
    await postRepo.deleteSignageAssetsForPost(postId);
    if (updated.status === "published" && emitter) {
      const purgeOnline = await getOnlineDeviceIdSet(
        prisma,
        allDeps.map((d) => d.device_id),
      );
      for (const dep of allDeps) {
        if (!purgeOnline.has(dep.device_id)) continue;
        await emitter(
          dep.device_id,
          "signage_command",
          { action: "delete_post_assets", post_id: postId },
          5000,
        ).catch(() => {});
      }
    }
  }

  let syncIds = null;
  if (actor.role !== "admin") {
    syncIds = !updated.requested_signage ? [] : selectedIds;
  } else if (updated.allowed_on_signage) {
    syncIds = selectedIds.length > 0 ? selectedIds : allDeps.map((d) => d.device_id);
    if (syncIds.length === 0) syncIds = null;
  }

  const removeDeployments = async (removedIds) => {
    if (!removedIds.length) return;
    const removedOnline = await getOnlineDeviceIdSet(prisma, removedIds);
    for (const did of removedIds) {
      await postRepo.deleteSignageAssetsForDevice(postId, did);
      if (emitter && removedOnline.has(did)) {
        await emitter(
          did,
          "signage_command",
          { action: "delete_post_assets", post_id: postId },
          5000,
        ).catch(() => {});
      }
      await postRepo.deleteDeployment(postId, did);
    }
  };

  if (syncIds !== null) {
    if (syncIds.length > 0) {
      const targetDevices = await postRepo.findDevicesByIds(syncIds);
      await deployPostToDevices(emitter, actor, updated, targetDevices, body);
      const removedIds = allDeps.map((d) => d.device_id).filter((id) => !syncIds.includes(id));
      await removeDeployments(removedIds);
    } else if (actor.role !== "admin" && allDeps.length > 0) {
      await removeDeployments(allDeps.map((d) => d.device_id));
    } else if (actor.role === "admin" && updated.allowed_on_signage && allDeps.length > 0) {
      const targetDevices = await postRepo.findDevicesByIds(allDeps.map((d) => d.device_id));
      await deployPostToDevices(emitter, actor, updated, targetDevices, updated.signage_metadata || {});
    }
  }

  return updated;
}

async function removePost(user, postId, emitter) {
  const actor = await getActor(user);
  const post = await postRepo.findPostWithImages(postId);
  if (!post || !canManage(actor, post.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!canManagePost(actor, post)) {
    throw Object.assign(
      new Error("You need admin approval to delete another creator's post."),
      { statusCode: 403 },
    );
  }

  const signageDeps = await postRepo.findAllDeploymentsForPost(post.id);
  const depDeviceIds = signageDeps.map((d) => d.device_id);

  await postRepo.deletePlaylistItemsForPost(post.id);

  const deleteOnline = await getOnlineDeviceIdSet(prisma, depDeviceIds);
  if (emitter) {
    for (const did of depDeviceIds) {
      if (!deleteOnline.has(did)) continue;
      await emitter(
        did,
        "signage_command",
        { action: "delete_post_assets", post_id: post.id },
        12000,
      ).catch(() => {});
    }
  }

  for (const img of post.images) {
    deleteMediaFile(img.image_path);
  }

  await postRepo.deletePost(postId);
  return { ok: true };
}

async function bulkAction(actor, body, emitter) {
  const { ids, action, device_ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw Object.assign(new Error("No IDs provided"), { statusCode: 400 });
  }
  const selectedDeviceIds = parseDeviceIds(device_ids);

  const where = { id: { in: ids.map(Number) } };
  if (actor.role !== "admin") {
    const allowedGroupIds = getActorGroupIds(actor);
    where.group_id = { in: allowedGroupIds };
  }
  const posts = await prisma.post.findMany({
    where,
    include: { images: true, signage_metadata: true, signage_deployments: true, author: true },
  });

  const validIds = posts.filter((p) => canManagePost(actor, p)).map((p) => p.id);
  if (validIds.length === 0 && posts.length > 0) {
    throw Object.assign(
      new Error("You do not have permission to perform this action on these posts."),
      { statusCode: 403 },
    );
  }

  if (action === "delete") {
    await prisma.playlistItem.deleteMany({ where: { post_id: { in: validIds } } });
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      if (emitter) {
        const bulkDelOnline = await getOnlineDeviceIdSet(
          prisma,
          p.signage_deployments.map((d) => d.device_id),
        );
        for (const d of p.signage_deployments) {
          if (!bulkDelOnline.has(d.device_id)) continue;
          await emitter(d.device_id, "signage_command", { action: "delete_post_assets", post_id: p.id }, 2000).catch(() => {});
        }
      }
      for (const img of p.images) {
        deleteMediaFile(img.image_path);
      }
    }
    await prisma.post.deleteMany({ where: { id: { in: validIds } } });
  } else if (action === "remove-signage") {
    if (emitter) {
      const deps = await prisma.signageDeployment.findMany({ where: { post_id: { in: validIds } } });
      const rsOnline = await getOnlineDeviceIdSet(prisma, deps.map((d) => d.device_id));
      for (const dep of deps) {
        if (!rsOnline.has(dep.device_id)) continue;
        await emitter(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: dep.post_id }, 2000).catch(() => {});
      }
    }
    await prisma.signageAsset.deleteMany({ where: { post_id: { in: validIds } } });
    await prisma.post.updateMany({
      where: { id: { in: validIds } },
      data: { allowed_on_signage: false, requested_signage: false },
    });
  } else if (action === "remove-feed") {
    await prisma.post.updateMany({
      where: { id: { in: validIds } },
      data: { allowed_on_feed: false, requested_feed: false },
    });
  } else if (action === "add-feed") {
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      const isAutoApprove = p.author?.auto_approve || actor.role === "admin";
      await prisma.post.update({
        where: { id: p.id },
        data: { requested_feed: true, allowed_on_feed: isAutoApprove },
      });
    }
  } else if (action === "add-signage" || action === "add-both") {
    const publishFeed = action === "add-both";
    const unionTargets = new Set();
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      const t = selectedDeviceIds.length > 0 ? selectedDeviceIds : p.signage_deployments.map((d) => d.device_id);
      t.forEach((id) => unionTargets.add(id));
    }
    const unionArr = [...unionTargets];
    if (unionArr.length > 0) {
      const chk = await ensureDevicesOnline(prisma, unionArr);
      if (!chk.ok) throw Object.assign(new Error(chk.error), { statusCode: 400 });
    }
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      const isAutoApprove = p.author?.auto_approve || actor.role === "admin";
      const updated = await prisma.post.update({
        where: { id: p.id },
        data: {
          requested_signage: true,
          allowed_on_signage: isAutoApprove,
          ...(publishFeed && { requested_feed: true, allowed_on_feed: isAutoApprove }),
        },
        include: { images: true, signage_metadata: true },
      });
      const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : p.signage_deployments.map((d) => d.device_id);
      if (targetIds.length > 0) {
        const targetDevices = await prisma.device.findMany({ where: { id: { in: targetIds } } });
        await deployPostToDevices(emitter, actor, updated, targetDevices, updated.signage_metadata || {});
      }
    }
  }

  return { ok: true, count: validIds.length };
}

module.exports = { createPost, updatePost, removePost, bulkAction };
