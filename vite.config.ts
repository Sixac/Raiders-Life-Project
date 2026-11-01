import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The build is one self-contained index.html: easy to host anywhere,
// and it works as the front end of a desktop (Tauri or Electron) build.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: { target: "es2020" },
});
