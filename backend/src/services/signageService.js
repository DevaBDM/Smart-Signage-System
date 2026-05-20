const prisma = require("../db/prisma");
const { getActor, canManagePost } = require("../utils/permissions");
const { assertControlAllowed, applyControlLock } = require("../utils/controlLock");
const { canUseDevice } = require("../utils/devicePermissions");
const { assertCanManageAsset } = require("../utils/signagePermissions");
const { mediaFileExists } = require("../utils/mediaProcessor");
const { validateSignageStateForPublish } = require("../validators/signageValidator");
const { assertDeviceOnline } = require("../utils/devices");
const { upsertSignageAsset } = require("../utils/signageAssets");
const piBridge = require("./piBridge");

const sendSignageCommand = (device_id, payload) =>
  piBridge.emitToDeviceAck(device_id, "signage_command", payload, 12000);

/**
 * Publish a post to a device. Validates permissions, media, device status,
 * control locks, then upserts metadata + deployment and notifies the Pi.
 */
async function publishPost(user, body) {
  const {
    post_id,
    device_id,
    duration_seconds,
    start_date,
    end_date,
    priority,
    display_group,
  } = body;

  const actor = await getActor(user);
  const post = await prisma.post.findUnique({
    where: { id: Number(post_id) },
    include: { images: true, author: true, live_stream: true },
  });
  if (!post) throw Object.assign(new Error("Post not found"), { statusCode: 404 });
  if (!canManagePost(actor, post)) {
    throw Object.assign(new Error("Cannot publish this post"), { statusCode: 403 });
  }

  // Validate signage_state
  const validatedState = validateSignageStateForPublish(actor, post, body);
  if (body.signage_state !== undefined) {
    await prisma.post.update({
      where: { id: post.id },
      data: { signage_state: validatedState },
    });
    post.signage_state = validatedState;
  }

  const isLiveStream = post.live_stream_id != null;
  const image = post.images?.[0];

  if (!isLiveStream && !image) {
    throw Object.assign(new Error("Post has no media"), { statusCode: 400 });
  }
  if (!isLiveStream && image && !mediaFileExists(image.image_path)) {
    throw Object.assign(
      new Error(
        `Media file missing on server: ${image.image_path}. Re-upload the video on the post.`,
      ),
      { statusCode: 400 },
    );
  }

  const mediaDuration = isLiveStream
    ? (Number(duration_seconds) || 3600)
    : (image?.duration_seconds || Number(duration_seconds) || 10);

  const device = await prisma.device.findUnique({
    where: { id: Number(device_id) },
    include: { groups: true },
  });
  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  if (!canUseDevice(actor, device)) {
    throw Object.assign(new Error("Cannot publish to this device"), { statusCode: 403 });
  }

  const lock = assertControlAllowed(actor, device);
  if (!lock.ok) throw Object.assign(new Error(lock.error), { statusCode: 403 });

  if (!device.is_approved) {
    throw Object.assign(
      new Error("This device is pending approval and cannot be controlled yet."),
      { statusCode: 403 },
    );
  }
  assertDeviceOnline(device);

  // Upsert signage metadata
  await prisma.signageMetadata.upsert({
    where: { post_id: Number(post_id) },
    update: {
      duration_seconds: mediaDuration,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
    create: {
      post_id: Number(post_id),
      duration_seconds: mediaDuration,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
  });

  const isAutoApprove = post.author?.auto_approve || actor.role === "admin";

  await prisma.post.update({
    where: { id: Number(post_id) },
    data: {
      requested_signage: true,
      allowed_on_signage: isAutoApprove,
    },
  });

  const streamUrl = isLiveStream ? post.live_stream?.relay_url : null;
  const payload = {
    post_id: post.id,
    title: post.title,
    image_url: isLiveStream ? streamUrl : image?.image_path,
    media_type: isLiveStream ? "LIVE_STREAM" : (image?.media_type || "IMAGE"),
    stream_url: streamUrl,
    duration_seconds: mediaDuration,
    start_date: start_date || null,
    end_date: end_date || null,
  };

  await prisma.signageDeployment.upsert({
    where: {
      device_id_post_id: {
        device_id: Number(device_id),
        post_id: post.id,
      },
    },
    update: {
      duration_seconds: mediaDuration,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
      status: "pending",
      last_error: null,
    },
    create: {
      device_id: Number(device_id),
      post_id: post.id,
      duration_seconds: mediaDuration,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
      status: "pending",
    },
  });

  let result = { ok: true, note: "Deployment saved. Awaiting admin approval." };
  if (isAutoApprove) {
    console.log(`[signageService] publishPost -> device ${device_id} payload:`, JSON.stringify(payload));
    result = await sendSignageCommand(device_id, {
      action: "publish_asset",
      ...payload,
    });
    console.log(`[signageService] publishPost -> device ${device_id} result:`, JSON.stringify(result));

    if (result.ok) {
      if (result.asset) {
        await upsertSignageAsset(prisma, {
          device_id: device.id,
          post_id: post.id,
          image_url: isLiveStream ? streamUrl : image?.image_path,
          asset: result.asset,
        });
      }
      await prisma.signageDeployment.update({
        where: {
          device_id_post_id: {
            device_id: Number(device_id),
            post_id: post.id,
          },
        },
        data: { status: "synced", last_error: null },
      });
      await applyControlLock(actor, Number(device_id), "publish_asset");
    } else {
      await prisma.signageDeployment.update({
        where: {
          device_id_post_id: {
            device_id: Number(device_id),
            post_id: post.id,
          },
        },
        data: { status: "pending", last_error: result.error || null },
      });
    }
  }

  const piOk = !isAutoApprove || result.ok;
  return {
    statusCode: piOk ? 200 : 502,
    ok: piOk,
    pi_notified: !!(isAutoApprove && result.ok),
    pi_result: result,
    error: piOk ? undefined : result.error || "Display could not sync this asset",
  };
}

/**
 * Delete an asset from a device. Checks permissions, sends delete command,
 * cleans DB records, and optionally clears post signage flags.
 */
async function deleteDeviceAsset(actor, device, assetId, force = false) {
  const lock = assertControlAllowed(actor, device);
  if (!lock.ok) {
    throw Object.assign(new Error(lock.error), { statusCode: 403 });
  }

  const perm = await assertCanManageAsset(actor, device.id, assetId);
  if (!perm.ok) {
    throw Object.assign(new Error(perm.error), { statusCode: 403 });
  }

  const trackedAsset = perm.tracked;

  const result = await sendSignageCommand(device.id, {
    action: "delete_asset",
    asset_id: assetId,
  });

  if (result.ok || force) {
    await prisma.signageAsset
      .delete({
        where: {
          device_id_asset_id: {
            device_id: device.id,
            asset_id: String(assetId),
          },
        },
      })
      .catch(() => {});

    if (trackedAsset && trackedAsset.post_id) {
      await prisma.signageDeployment
        .delete({
          where: {
            device_id_post_id: {
              device_id: device.id,
              post_id: trackedAsset.post_id,
            },
          },
        })
        .catch(() => {});

      const remainingDeployments = await prisma.signageDeployment.count({
        where: { post_id: trackedAsset.post_id },
      });
      if (remainingDeployments === 0) {
        await prisma.post.update({
          where: { id: trackedAsset.post_id },
          data: { allowed_on_signage: false, requested_signage: false },
        });
      }
    }
    await applyControlLock(actor, device.id, "delete_asset");
  }

  return {
    statusCode: result.ok ? 200 : 503,
    ...result,
  };
}

module.exports = { publishPost, deleteDeviceAsset };
