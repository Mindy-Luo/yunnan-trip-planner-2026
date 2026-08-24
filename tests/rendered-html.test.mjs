import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          if (url.pathname === "/travel-planner.html") {
            const body = await readFile(
              new URL("../public/travel-planner.html", import.meta.url),
            );
            return new Response(body, {
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
          return new Response("Not found", { status: 404 });
        },
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the public travel planner shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>去有风的地方 · 云南旅行工作台<\/title>/);
  assert.match(html, /src="\/travel-planner\.html"/);
  assert.match(html, /class="planner-frame"/);
});

test("ships the complete interactive planner", async () => {
  const planner = await readFile(
    new URL("../public/travel-planner.html", import.meta.url),
    "utf8",
  );
  assert.match(planner, /云南旅行工作台/);
  assert.match(planner, /玉龙雪山/);
  assert.match(planner, /机场 → 酒店/);
  assert.match(planner, /localStorage/);
  assert.match(planner, /增加新物品/);
});
