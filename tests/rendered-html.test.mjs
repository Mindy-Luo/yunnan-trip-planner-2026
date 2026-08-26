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

test("ships the urgent local-first upgrades without cloud dependencies", async () => {
  const [planner, upgradeJs, upgradeCss] = await Promise.all([
    readFile(new URL("../public/travel-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/upgrade.js", import.meta.url), "utf8"),
    readFile(new URL("../public/upgrade.css", import.meta.url), "utf8"),
  ]);

  assert.match(planner, /href="\.\/upgrade\.css"/);
  assert.match(planner, /src="\.\/upgrade\.js"/);
  assert.match(upgradeJs, /新增收藏/);
  assert.match(upgradeJs, /免费本地版/);
  assert.match(upgradeJs, /本机编辑模式/);
  assert.match(upgradeJs, /24 小时天气/);
  assert.match(upgradeJs, /weatherPage/);
  assert.match(upgradeJs, /跨城日已同时显示出发地和目的地/);
  assert.match(upgradeJs, /从收藏直接加入/);
  assert.match(upgradeJs, /大理机场 → 酒店｜交通二选一/);
  assert.match(upgradeJs, /抵达深圳宝安 T3 · 值机安检/);
  assert.match(upgradeJs, /玉龙雪山 9月交通与费用参考/);
  assert.match(upgradeJs, /WUJI CAFE · 270°洱海落日拍照/);
  assert.match(upgradeJs, /挖色轻环线 · 鹿卧山安全观景位/);
  assert.match(upgradeJs, /白沙植物拓染 · 敲敲打一下午/);
  assert.match(upgradeJs, /白沙古镇 · 住了5天后的8小时逛吃玩攻略/);
  assert.match(upgradeJs, /缓山私厨·庭院餐厅/);
  assert.match(upgradeJs, /甘海子 · 等日照金山/);
  assert.match(upgradeJs, /瑞士风情园 · 等日照金山/);
  assert.match(upgradeJs, /云杉坪小索道 · 提前候检/);
  assert.match(upgradeJs, /蓝月谷 · 正午通透水色拍照/);
  assert.match(upgradeJs, /冰川公园大索道 · 提前到检票区/);
  assert.match(upgradeJs, /普达措国家公园 · 留足一整段/);
  assert.match(upgradeJs, /松赞林寺 · 上午慢游/);
  assert.match(upgradeJs, /梅里日照金山 · 只作为整日替换方案/);
  assert.match(upgradeJs, /斗南花卉市场 · 鲜花与手作/);
  assert.match(upgradeJs, /梅里·飞来寺/);
  assert.match(upgradeJs, /api\.open-meteo\.com/);
  assert.match(upgradeJs, /api\.map\.baidu\.com\/direction/);
  assert.match(upgradeJs, /移出收藏/);
  assert.match(upgradeJs, /当天攻略/);
  assert.match(upgradeCss, /\.time b\{display:inline-flex/);
  assert.match(upgradeCss, /\.assistant-panel/);
  assert.match(upgradeCss, /\.weather24/);
  assert.match(upgradeCss, /\.weather-chart/);
  assert.match(upgradeCss, /\.meili-signal/);
  assert.match(upgradeCss, /\.route-panel/);
  assert.doesNotMatch(upgradeJs, /createClient|SUPABASE_URL|cdn\.jsdelivr/);
  assert.ok(
    upgradeJs.lastIndexOf("runUserWishListUpgrade();") >
      upgradeJs.indexOf("(function runDetailedItineraryUpgrade()"),
    "the newest itinerary migration runs after the detailed-plan migration",
  );
});
