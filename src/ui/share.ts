/* Copying and sharing text, with a fallback when the browser refuses the clipboard. */

/** The game's public address, from the link-preview tags in index.html. */
export const canonicalUrl = () =>
  document.querySelector('meta[property="og:url"]')?.getAttribute("content") || location.href;

/**
 * Copies text to the clipboard. Pass a promise created inside the click handler: the write
 * starts at once, which Safari requires, even if the text is still being prepared.
 * Resolves to false when the browser refuses, so the caller can show the text to copy by hand.
 */
export async function copyText(text: Promise<string>): Promise<boolean> {
  const clip = navigator.clipboard;
  if (!clip) return false;
  if (typeof ClipboardItem === "function" && clip.write) {
    try {
      await clip.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      return true;
    } catch { /* try the simpler way below */ }
  }
  try { await clip.writeText(await text); return true; } catch { return false; }
}

/** Phones and tablets get the system share sheet; elsewhere sharing copies to the clipboard. */
export const canShareSheet = () =>
  typeof navigator.share === "function" && window.matchMedia?.("(pointer: coarse)").matches === true;
