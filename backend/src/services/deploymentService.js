const prisma = require("../db/prisma");
const { assertControlAllowed, applyControlLock } = require("../utils/controlLock");
const { mediaFileExists } = require("../utils/mediaProcessor");
const { upsertSignageAsset } = require("../utils/signageAssets");
const { buildSignageMeta } = require("../validators/postValidator");

/**
 * Upsert SignageDeployment rows and push to Pi only when
 * published + allowed + display online.
 *
 * @param {Function|null} emitter  – emitToDeviceAck (or null in tests)
 * @param {object} post
 * @param {object[]} targetDevices
 * @param {object} signageData  – raw body / metadata object
 * @returns {Promise<object[]>} per-device results
 */
const deployPostToDevices = async (emitter, actor, post, targetDevices, signageData) => {
  const isLiveStream = post.live_stream_id != null;
  const image = post.images?.[0];

  if (!isLiveStream && !image) return [];
  if (!isLiveStream && !mediaFileExists(image.image_path)) {
    console.warn(`[deploy] missing media file: ${image.image_path}`);
    return targetDevices.map((device) => ({
      device_id: device.id,
      device_name: device.device_name,
      result: {
        ok: false,
        error: `Media file missing on server: ${image.image_path}. Re-upload the video.`,
      },
    }));
  }

  const sched = buildSignageMeta(signageData, Number(signageData?.duration_seconds) || 10);
  const mediaDuration = isLiveStream
    ? (sched.duration_seconds || 3600)
    : (image?.duration_seconds || sched.duration_seconds);
  const schedWithMedia = { ...sched, duration_seconds: mediaDuration };
  const results = [];

  for (const device of targetDevices) {
    try {
      const lock = assertControlAllowed(actor, device);
      if (!lock.ok) {
        results.push({
          device_id: device.id,
          device_name: device.device_name,
          result: { ok: false, error: lock.error },
        });
        continue;
      }

      await prisma.signageDeployment.upsert({
        where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
        update: { ...schedWithMedia, status: "pending", last_error: null },
        create: { device_id: device.id, post_id: post.id, ...schedWithMedia, status: "pending" },
      });

      if (post.status === "published" && post.allowed_on_signage) {
        if (device.status !== "online") {
          await prisma.signageDeployment.update({
            where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
            data: {
              status: "pending",
              last_error:
                "Display offline — deployment saved; will sync when the display is online.",
            },
          });
          results.push({
            device_id: device.id,
            device_name: device.device_name,
            result: { ok: true, offline_queued: true },
          });
          continue;
        }

        const existingAsset = await prisma.signageAsset.findFirst({
          where: { device_id: device.id, post_id: post.id },
        });

        const streamUrl = isLiveStream
          ? post.live_stream?.relay_url
          : null;

        const result = existingAsset
          ? { ok: true, already_exists: true, asset: existingAsset }
          : emitter
            ? await emitter(
                device.id,
                "signage_command",
                {
                  action: "publish_asset",
                  post_id: post.id,
                  title: post.title,
                  image_url: isLiveStream ? streamUrl : image.image_path,
                  media_type: isLiveStream ? "LIVE_STREAM" : (image.media_type || "IMAGE"),
                  stream_url: streamUrl,
                  duration_seconds: mediaDuration,
                  start_date: sched.start_date || null,
                  end_date: sched.end_date || null,
                  is_enabled: sched.is_enabled,
                  play_order: sched.play_order,
                  nocache: sched.nocache,
                  skip_asset_check: sched.skip_asset_check,
                },
                12000,
              )
            : { ok: false, error: "Socket bridge is not ready" };

        if (result.ok) {
          if (result.asset) {
            await upsertSignageAsset(prisma, {
              device_id: device.id,
              post_id: post.id,
              image_url: isLiveStream ? streamUrl : image.image_path,
              asset: result.asset,
            });
          }
          await prisma.signageDeployment.update({
            where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
            data: { status: "synced", last_error: null },
          });
          await applyControlLock(actor, device.id, "publish_asset");
        } else {
          await prisma.signageDeployment.update({
            where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
            data: { status: "pending", last_error: result.error || null },
          });
        }
        results.push({ device_id: device.id, device_name: device.device_name, result });
      } else {
        results.push({ device_id: device.id, device_name: device.device_name, result: { ok: true, note: "Deployment saved but not live." } });
        await applyControlLock(actor, device.id, "save_deployment");
      }
    } catch (e) {
      console.error(`Signage deploy failed for device ${device.id}:`, e);
    }
  }
  return results;
};

module.exports = { deployPostToDevices };
