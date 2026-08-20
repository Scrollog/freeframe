import type { CEP_Config } from "vite-cep-plugin";
import { version } from "./package.json";

const config: CEP_Config = {
  version,
  id: "com.freeframe.cep", 
  displayName: "FreeFrame", 
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8860,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 9.0,
  hosts: [{ name: "PPRO", version: "[14.0,99.9]" }],

  type: "Panel",
  iconDarkNormal: "./src/assets/light-icon.png",
  iconNormal: "./src/assets/dark-icon.png",
  iconDarkNormalRollOver: "./src/assets/light-icon.png",
  iconNormalRollOver: "./src/assets/dark-icon.png",
  // The panel is loaded from file://, so its requests to the FreeFrame API
  // carry `Origin: null` — see the CORS note in README.md.
  parameters: [
    "--v=0",
    "--enable-nodejs",
    "--mixed-context",
    "--allow-file-access",
    "--allow-file-access-from-files",
  ],
  width: 420,
  height: 700,

  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      panelDisplayName: "FreeFrame",
      autoVisible: true,
      width: 420,
      height: 700,
      minWidth: 320,
      minHeight: 400,
    },
  ],
  build: {
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    country: "US",
    province: "CA",
    org: "FreeFrame",
    password: "password",
    tsa: [
      "http://timestamp.digicert.com/", // Windows Only
      "http://timestamp.apple.com/ts01", // MacOS Only
    ],
    allowSkipTSA: false,
    sourceMap: false,
    jsxBin: "off",
  },
  installModules: [],
  copyAssets: [],
  copyZipAssets: [],
};
export default config;
