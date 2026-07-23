import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("server-renders the Services Health dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Service Health \| COR3<\/title>/i);
  assert.match(html, /src="\/cor3-logo-en\.png"/i);
  assert.match(html, /href="\/cor3-mark\.png"/i);
  assert.match(html, /Microsoft 365/);
  assert.match(html, /Adobe/);
  assert.match(html, /3CX/);
  assert.match(html, /Cloudflare/);
  assert.match(html, /PR DRS/);
  assert.match(html, /RECOVERY\.PR/);
  assert.equal((html.match(/class="service-card /g) ?? []).length, 6);
  assert.match(html, /Refresh status/);
});

test("ships sharp COR3 assets and portable local-run metadata", async () => {
  const [css, layout, packageJsonText, readme, logo, mark] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../public/cor3-logo-en.png", import.meta.url)),
    readFile(new URL("../public/cor3-mark.png", import.meta.url)),
  ]);

  assert.deepEqual(pngDimensions(logo), { width: 4600, height: 1815 });
  assert.deepEqual(pngDimensions(mark), { width: 1024, height: 1024 });
  assert.match(css, /aspect-ratio:\s*4600\s*\/\s*1815/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(layout, /icon:\s*"\/cor3-mark\.png"/);

  const packageJson = JSON.parse(packageJsonText);
  assert.equal(packageJson.name, "services-health");
  assert.equal(packageJson.engines.node, ">=22.13.0");
  assert.match(
    readme,
    /git clone https:\/\/github\.com\/INFRA-ORG-COR3\/services-health\.git/,
  );
  assert.match(readme, /does not require API keys or a database/i);
});
