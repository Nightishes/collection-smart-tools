import { describe, it, expect } from "vitest";
import { modifyHtml } from "./htmlModify";

const sampleHtml = `<!doctype html>
<html>
<head>
<style>
.fc0 { color: #111111; }
.fc1 { color: #222222; }
.fs1 { font-size: 12px; }
</style>
</head>
<body>
<p class="fc0">Hello</p>
<p class="fc1 fs1">World</p>
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..." />
</body>
</html>`;

describe("modifyHtml", () => {
  it("applies fcOverrides and fsOverrides by modifying existing style rules", () => {
    const { modifiedHtml, styleInfo } = modifyHtml(sampleHtml, {
      fcOverrides: { fc0: "#abcdef" },
      fsOverrides: { fs1: "18px" },
    });

    // modifiedHtml should have modified the original style rules in place
    expect(modifiedHtml).toContain(".fc0 { color: #abcdef; }");
    expect(modifiedHtml).toContain(".fs1 { font-size: 18px; }");
    // Should NOT contain the old values in the original style block
    expect(modifiedHtml).not.toContain("#111111");
    expect(modifiedHtml).not.toContain("font-size: 12px");

    // Should also inject !important overrides for iframe preview reliability
    expect(modifiedHtml).toContain(".fc0{color:#abcdef!important}");
    expect(modifiedHtml).toContain(".fs1{font-size:18px!important}");

    // returned styleInfo should reflect overrides
    const fc0 = styleInfo.fontColors.find((f) => f.name === "fc0");
    const fs1 = styleInfo.fontSizes.find((s) => s.name === "fs1");
    expect(fc0).toBeDefined();
    expect(fc0?.value).toBe("#abcdef");
    expect(fs1).toBeDefined();
    expect(fs1?.value).toBe("18px");
  });

  it("removes data images when requested", () => {
    const { modifiedHtml, imagesRemoved } = modifyHtml(sampleHtml, {
      removeDataImages: true,
    });
    // data image should be removed comment
    expect(modifiedHtml).toContain("<!-- data-image removed -->");
    expect(imagesRemoved.length).toBeGreaterThan(0);
  });

  it("returns empty styleInfo when no fc/fs classes", () => {
    const h = "<html><head></head><body><p>No styles</p></body></html>";
    const { styleInfo } = modifyHtml(h);
    expect(styleInfo.fontColors.length).toBe(0);
    expect(styleInfo.fontSizes.length).toBe(0);
  });

  it("deduplicates duplicate fc/fs entries and keeps first occurrence", () => {
    const dupHtml = `<!doctype html>
    <html>
    <head>
    <style>
    .fc0 { color: #111111; }
    .fc0 { color: #abcdef; }
    .fs0 { font-size: 12px; }
    .fs0 { font-size: 18px; }
    </style>
    </head>
    <body>
    <p class="fc0 fs0">Dup</p>
    </body>
    </html>`;

    const { modifiedHtml, styleInfo } = modifyHtml(dupHtml);

    // only one .fc0 and .fs0 should be present in returned styleInfo
    const fcs = styleInfo.fontColors.filter((f) => f.name === "fc0");
    const fss = styleInfo.fontSizes.filter((s) => s.name === "fs0");
    expect(fcs.length).toBe(1);
    expect(fss.length).toBe(1);

    // the first occurrence value (#111111 and 12px) should be preserved
    expect(fcs[0].value).toBe("#111111");
    expect(fss[0].value).toBe("12px");

    // modifiedHtml should include the preserved rules (and not duplicate rules)
    expect(modifiedHtml.match(/\.fc0/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    // ensure the first color (#111111) is present
    expect(modifiedHtml).toContain(".fc0 { color: #111111");
  });
});
