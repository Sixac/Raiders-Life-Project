import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import pkg from "./package.json";

// The build is one self-contained index.html: easy to host anywhere,
// and it works as the front end of a desktop (Tauri or Electron) build.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  // The version from package.json, shown at the foot of the title screen.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: "es2020" },
});
