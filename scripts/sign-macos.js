const { execSync } = require("child_process");
const { platform } = require("os");
const { existsSync } = require("fs");
const { join } = require("path");

function signMacOS() {
  if (platform() !== "darwin") {
    console.log("Not on macOS, skipping code signing");
    return;
  }

  const distPath = join(__dirname, "..", "dist");
  const macosExecutables = ["wh-dl-macos-x64", "wh-dl-macos-arm64"];

  for (const exe of macosExecutables) {
    const exePath = join(distPath, exe);
    if (existsSync(exePath)) {
      try {
        console.log(`Signing ${exe}...`);
        execSync(`codesign --sign - "${exePath}"`);
        console.log(`Successfully signed ${exe}`);
      } catch (error) {
        console.error(`Failed to sign ${exe}:`, error.message);
      }
    }
  }
}

signMacOS();
