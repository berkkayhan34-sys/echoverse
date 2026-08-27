/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const fs = require("node:fs");
const path = require("node:path");

const localizationDirectory = path.resolve(__dirname, "../../packages/contracts/src/localizations");

/**
 * Native permission prompts are package metadata rather than renderer content.
 * They still come from the canonical English catalog so no user-visible prose
 * is duplicated in the build configuration. Runtime UI selection remains
 * locale-aware in the application itself.
 */
function readEnglishCatalog() {
  return JSON.parse(fs.readFileSync(path.join(localizationDirectory, "en.json"), "utf8"));
}

const englishCatalog = readEnglishCatalog();

module.exports = {
  appId: "com.echoverse.desktop",
  productName: "EchoVerse",
  files: [
    {
      from: "../../../tmp/generated/desktop",
      to: "dist",
      filter: ["**/*"]
    },
    "electron/**/*",
    "package.json"
  ],
  extraResources: [
    {
      from: "config.json",
      to: "config.json"
    },
    {
      from: "assets",
      to: "branding"
    },
    {
      from: "../../packages/contracts/src/localizations",
      to: "localizations"
    }
  ],
  win: {
    target: ["nsis"],
    artifactName: "${productName}-Setup-${version}.${ext}",
    icon: "assets/echoverse.ico"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  directories: {
    output: "../../../tmp/release/desktop"
  },
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.social-networking",
    hardenedRuntime: false,
    gatekeeperAssess: false,
    extendInfo: {
      NSMicrophoneUsageDescription: englishCatalog["desktop.permissionMicrophone"],
      NSCameraUsageDescription: englishCatalog["desktop.permissionCamera"]
    },
    artifactName: "${productName}-${version}-${arch}.${ext}",
    icon: "assets/echoverse-icon.png"
  },
  dmg: {
    title: "EchoVerse ${version}"
  },
  publish: [
    {
      provider: "github",
      owner: "berkkayhan34-sys",
      repo: "echoverse",
      releaseType: "release"
    }
  ],
  artifactName: "${productName}-${version}-${arch}.${ext}",
  icon: "assets/echoverse-icon.png"
};
