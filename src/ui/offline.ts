/* Offline play and installing to a phone's home screen. Only on the real website (https, not framed). */

export const canInstall = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && location.protocol === "https:" && window.top === window.self;

export const isInstalled = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function registerOffline(): void {
  if (!canInstall()) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* the game works without it */ }); });
}
