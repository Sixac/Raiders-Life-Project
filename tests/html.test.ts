/* Text that can contain the player's name must reach the page as text, never as markup. */
import { describe, expect, it } from "vitest";
import { esc, logItems } from "../src/ui/html";

describe("logItems", () => {
  it("escapes markup in log lines, so a name like <b>Ulf</b> shows as typed", () => {
    const html = logItems([{ t: "<img src=x onerror=alert(1)>Ulf & <b>Bold</b>, eighteen winters old", c: "" }]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;Ulf &amp; &lt;b&gt;Bold&lt;/b&gt;");
  });
  it("keeps the line's class and uses the requested tag", () => {
    expect(logItems([{ t: "Victory.", c: "good" }], "p")).toBe('<p class="good">Victory.</p>');
  });
  it("leaves the game's typographic punctuation alone", () => {
    expect(esc("Hæsten’s “sea-king” — níðingr")).toBe("Hæsten’s “sea-king” — níðingr");
  });
});
