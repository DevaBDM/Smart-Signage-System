const prisma = require("../db/prisma");
const { canManage, canManagePost, getActor } = require("../utils/permissions");
const { parseDeviceIds, toBool } = require("../utils/parsers");
const { ensureDevicesOnline, getOnlineDeviceIdSet } = require("../utils/devices");
const {
  parseSignageState,
  canCreatorAssignState,
} = require("../utils/signageStates");
const { parseMediaCrops } = require("../utils/parseMediaCrops");
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

const parseProcessedMedia = (body) => {
  const raw = body?.processed_media;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Date.now();

const resolvePostSignageState = (actor, rawState) => {
  const parsed = parseSignageState(rawState) || "NORMAL";
  if (actor.role === "admin") return parsed;
  if (!canCreatorAssignState(actor.max_signage_state, parsed)) {
    return {
      error: `You may only create signage posts up to ${actor.max_signage_state || "NORMAL"} level.`,
    };
  }
  return parsed;
};

/**
 * Build signage_metadata create payload from body.
 */
const buildSignageMeta = (body, duration) => ({
  duration_seconds: duration,
  start_date: body.start_date ? new Date(body.start_date) : null,
  end_date: body.end_date ? new Date(body.end_date) : null,
  priority: Number(body.priority) || 1,
  display_group: body.display_group || null,
  is_enabled: toBool(body.is_enabled),
  play_order: Number(body.play_order) || 0,
  nocache: toBool(body.nocache),
  skip_asset_check: toBool(body.skip_asset_check),
});

async function createPost(user, body, files) {
  const {
    title,
    description_markdown,
    group_id,
    group_ids,
    allowed_on_feed,
    allowed_on_signage,
    publish_to_feed,
    publish_to_signage,
    status,
    device_ids,
  } = body;

  const rawGroupIds = group_ids !== undefined
    ? (typeof group_ids === "string" ? JSON.parse(group_ids) : group_ids)
    : group_id !== undefined
    ? [group_id]
    : [];
  const targetGroupIds = Array.isArray(rawGroupIds)
    ? [...new Set(rawGroupIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (targetGroupIds.length === 0) {
    throw Object.assign(new Error("At least one group is required"), { statusCode: 400 });
  }
  for (const gid of targetGroupIds) {
    if (!canManage(user, gid)) {
      throw Object.assign(new Error(`Invalid group access for group ${gid}`), { statusCode: 403 });
    }
  }

  const selectedDeviceIds = parseDeviceIds(device_ids);

  const creator = await prisma.user.findUnique({ where: { id: user.id } });
  const isAutoApprove = creator?.auto_approve || user.role === "admin";

  const requestedFeed = toBool(allowed_on_feed !== undefined ? allowed_on_feed : publish_to_feed);
  const requestedSignage = toBool(allowed_on_signage !== undefined ? allowed_on_signage : publish_to_signage);

  if (selectedDeviceIds.length > 0) {
    const chk = await ensureDevicesOnline(prisma, selectedDeviceIds);
    if (!chk.ok) throw Object.assign(new Error(chk.error), { statusCode: 400 });
  }

  const actor = await getActor(user);
  const signageState = resolvePostSignageState(actor, body.signage_state);
  if (signageState?.error) {
    throw Object.assign(new Error(signageState.error), { statusCode: 403 });
  }

  let mediaRows = parseProcessedMedia(body);
  if (!mediaRows?.length && files?.length) {
    const crops = parseMediaCrops(body, files.length);
    mediaRows = await processMediaFiles(files, crops);
  }
  const signageDuration =
    Number(body.duration_seconds) || primaryMediaDuration(mediaRows, 10);

  const metaPayload = buildSignageMeta(body, signageDuration);

  const createdPosts = [];
  for (const targetGroupId of targetGroupIds) {
    const post = await prisma.post.create({
      data: {
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
        images: {
          create: (mediaRows || []).map((m, i) => ({
            image_path: m.image_path,
            media_type: m.media_type || "IMAGE",
            duration_seconds: m.duration_seconds ?? null,
            order_index: i,
          })),
        },
        signage_metadata: { create: metaPayload },
      },
      include: { images: true, signage_metadata: true },
    });

    if (selectedDeviceIds.length > 0) {
      const targetDevices = await prisma.device.findMany({
        where: { id: { in: selectedDeviceIds } },
      });
      await deployPostToDevices(null, post, targetDevices, body);
    }

    createdPosts.push(post);
  }

  return { posts: createdPosts, count: createdPosts.length };
}

async function updatePost(user, postId, body, files, emitter) {
  const actor = await getActor(user);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { images: true, author: true },
  });
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
  } = body;
  const selectedIds = parseDeviceIds(device_ids);
  const isAutoApprove = post.author?.auto_approve || actor.role === "admin";

  let mediaRows = parseProcessedMedia(body);
  if (!mediaRows?.length && files?.length) {
    const crops = parseMediaCrops(body, files.length);
    mediaRows = await processMediaFiles(files, crops);
  }

  if (mediaRows?.length) {
    for (const img of post.images) {
      deleteMediaFile(img.image_path);
    }
    await prisma.postImage.deleteMany({ where: { post_id: postId } });
    await prisma.postImage.createMany({
      data: mediaRows.map((m, i) => ({
        post_id: postId,
        image_path: m.image_path,
        media_type: m.media_type || "IMAGE",
        duration_seconds: m.duration_seconds ?? null,
        order_index: i,
      })),
    });
  }

  const updatedMedia = mediaRows?.length
    ? mediaRows
    : await prisma.postImage.findMany({
        where: { post_id: postId },
        orderBy: { order_index: "asc" },
      });
  const metaDuration =
    Number(body.duration_seconds) || primaryMediaDuration(updatedMedia, 10);

  await prisma.signageMetadata.upsert({
    where: { post_id: postId },
    update: buildSignageMeta(body, metaDuration),
    create: { post_id: postId, ...buildSignageMeta(body, metaDuration) },
  });

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
    const signageState = resolvePostSignageState(actor, body.signage_state);
    if (signageState?.error) {
      throw Object.assign(new Error(signageState.error), { statusCode: 403 });
    }
    data.signage_state = signageState;
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: { images: true, signage_metadata: true },
  });

  // ---- deployment sync ----
  const allDeps = await prisma.signageDeployment.findMany({
    where: { post_id: postId },
  });

  if (!updated.allowed_on_signage) {
    await prisma.signageAsset.deleteMany({ where: { post_id: postId } });
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
      await prisma.signageAsset.deleteMany({
        where: { post_id: postId, device_id: did },
      });
      if (emitter && removedOnline.has(did)) {
        await emitter(
          did,
          "signage_command",
          { action: "delete_post_assets", post_id: postId },
          5000,
        ).catch(() => {});
      }
      await prisma.signageDeployment.delete({
        where: { device_id_post_id: { device_id: did, post_id: postId } },
      });
    }
  };

  if (syncIds !== null) {
    if (syncIds.length > 0) {
      const targetDevices = await prisma.device.findMany({
        where: { id: { in: syncIds } },
      });
      await deployPostToDevices(emitter, updated, targetDevices, body);
      const removedIds = allDeps.map((d) => d.device_id).filter((id) => !syncIds.includes(id));
      await removeDeployments(removedIds);
    } else if (actor.role !== "admin" && allDeps.length > 0) {
      await removeDeployments(allDeps.map((d) => d.device_id));
    } else if (actor.role === "admin" && updated.allowed_on_signage && allDeps.length > 0) {
      const targetDevices = await prisma.device.findMany({
        where: { id: { in: allDeps.map((d) => d.device_id) } },
      });
      await deployPostToDevices(emitter, updated, targetDevices, updated.signage_metadata || {});
    }
  }

  return updated;
}

async function removePost(user, postId, emitter) {
  const actor = await getActor(user);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { images: true },
  });
  if (!post || !canManage(actor, post.group_id)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!canManagePost(actor, post)) {
    throw Object.assign(
      new Error("You need admin approval to delete another creator's post."),
      { statusCode: 403 },
    );
  }

  const signageDeps = await prisma.signageDeployment.findMany({
    where: { post_id: post.id },
  });
  const depDeviceIds = signageDeps.map((d) => d.device_id);

  await prisma.playlistItem.deleteMany({ where: { post_id: post.id } });

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

  await prisma.post.delete({ where: { id: postId } });
  return { ok: true };
}

module.exports = { createPost, updatePost, removePost };
