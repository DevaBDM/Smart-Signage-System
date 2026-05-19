process.env.NODE_ENV = "test";
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outputPath = path.join(__dirname, "../uploads/images/e2e-test-image.png");

async function main() {
  await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png()
    .toFile(outputPath);
  console.log(JSON.stringify({ path: outputPath }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
