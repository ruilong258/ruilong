#!/usr/bin/env node
/**
 * 生成路线图用的矢量数据 → src/map/mapData.json
 *
 * 数据来源：
 *  - 国界/海岸线：Natural Earth 1:10m（world-atlas npm 包，公有领域）
 *  - 意大利大区界：openpolis/geojson-italy（ISTAT，CC BY 4.0）
 *  - 道路路线：OSRM 公共路由服务，基于 OpenStreetMap（© OpenStreetMap contributors，ODbL）
 *
 * 首次运行会下载到 data/cache/，之后直接用缓存。
 * 投影：以北纬 43.9° 为基准的墨卡托，单位为公里，便于在 Remotion 里做镜头缩放。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "data/cache");
fs.mkdirSync(CACHE, { recursive: true });

const START = { lon: 11.1026, lat: 43.8622 }; // 大巴视频 GPS（普拉托）
const END = { lon: 12.773, lat: 43.941 }; // 抵达视频 GPS（Gradara）

async function cached(file, url) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    console.log("download", url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---------- projection (km) ----------
const R = 6371;
const LAT0 = (43.9 * Math.PI) / 180;
const LON0 = 12.0;
const k = Math.cos(LAT0);
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const proj = ([lon, lat]) => [
  +(R * k * ((lon - LON0) * Math.PI) / 180).toFixed(2),
  +(-R * k * (mercY(lat) - mercY(43.9))).toFixed(2),
];

// Douglas–Peucker
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1;
    let bi = -1;
    for (let i = a + 1; i < b; i++) {
      // 闭合环首尾重合时退化为点到点距离
      const d =
        len < 1e-6
          ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
          : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (best > tol) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const VIEW = { lon: [4.5, 21], lat: [35, 48.5] };
const inView = (ring) =>
  ring.some(([lon, lat]) => lon > VIEW.lon[0] && lon < VIEW.lon[1] && lat > VIEW.lat[0] && lat < VIEW.lat[1]);

function geomToPath(geom, tol, minArea = 0) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let d = "";
  for (const poly of polys) {
    if (!inView(poly[0])) continue;
    for (const ring of poly) {
      const p = simplify(ring.map(proj), tol);
      if (p.length < 3) continue;
      if (minArea) {
        let a = 0;
        for (let i = 0; i < p.length; i++) {
          const [x1, y1] = p[i];
          const [x2, y2] = p[(i + 1) % p.length];
          a += x1 * y2 - x2 * y1;
        }
        if (Math.abs(a / 2) < minArea) continue;
      }
      d += "M" + p.map(([x, y]) => `${x},${y}`).join("L") + "Z";
    }
  }
  return d;
}

const world = JSON.parse(
  fs.readFileSync(path.join(ROOT, "node_modules/world-atlas/countries-10m.json"), "utf8"),
);
const countries = feature(world, world.objects.countries).features;
const italy = countries.find((c) => c.id === "380");
const sanMarino = countries.find((c) => c.id === "674");
const others = countries
  .filter((c) => !["380", "674", "336"].includes(c.id))
  .map((c) => ({ name: c.properties.name, d: geomToPath(c.geometry, 0.8, 4) }))
  .filter((c) => c.d);

const regionsGeo = await cached(
  "regions.geojson",
  "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson",
);
const regions = regionsGeo.features.map((f) => ({
  name: f.properties.reg_name.split("/")[0],
  d: geomToPath(f.geometry, 0.35, 2),
}));

const osrm = await cached(
  "osrm.json",
  `https://router.project-osrm.org/route/v1/driving/${START.lon},${START.lat};${END.lon},${END.lat}?overview=full&geometries=geojson`,
);
const r = osrm.routes[0];
const route = simplify(r.geometry.coordinates.map(proj), 0.08);
const cum = [0];
for (let i = 1; i < route.length; i++) {
  cum.push(+(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])).toFixed(3));
}

const CITIES = {
  Prato: [11.1026, 43.8622],
  Firenze: [11.2558, 43.7696],
  Bologna: [11.3426, 44.4949],
  Rimini: [12.5695, 44.0678],
  "San Marino": [12.4578, 43.9424],
  Gradara: [12.773, 43.941],
  Roma: [12.4964, 41.9028],
  Milano: [9.19, 45.4642],
  Venezia: [12.3155, 45.4408],
};

const out = {
  attribution:
    "Natural Earth (public domain) · Regions: ISTAT via openpolis (CC BY 4.0) · Route: OSRM / © OpenStreetMap contributors (ODbL)",
  distanceKm: Math.round(r.distance / 1000),
  italy: geomToPath(italy.geometry, 0.5, 1),
  sanMarino: geomToPath(sanMarino.geometry, 0.05),
  others,
  regions,
  route,
  routeCum: cum,
  cities: Object.fromEntries(Object.entries(CITIES).map(([n, ll]) => [n, proj(ll)])),
  // 视图里用到的几个参考点
  points: {
    italyCenter: proj([12.6, 42.1]),
    routeCenter: proj([11.94, 44.12]),
    adriatic: proj([12.78, 44.36]),
    tyrrhenian: proj([10.2, 42.6]),
    toscana: proj([11.35, 43.6]),
    emilia: proj([11.85, 44.6]),
    marche: proj([12.55, 43.6]),
  },
};
const dest = path.join(ROOT, "src/map/mapData.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(
  `wrote ${path.relative(ROOT, dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`,
  `route ${route.length} pts, ${out.distanceKm} km`,
);
