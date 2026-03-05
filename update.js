const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const BASE = "https://goseries4k.com";
const CATEGORY = process.argv[2] || "goseries";
const MAX_PAGE = 5;

const DATA_FILE = `data/${CATEGORY}.json`;

const categories = require("./data/categories.json");
const cat = categories.find(c => c.slug === CATEGORY);

if (!cat) {
  console.log("ไม่พบหมวด", CATEGORY);
  process.exit(1);
}

let results = [];

if (fs.existsSync(DATA_FILE)) {
  results = JSON.parse(fs.readFileSync(DATA_FILE));
}

const exists = new Set(results.map(m => m.link));

async function fetchPage(url) {
  try {

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      validateStatus: () => true
    });

    if (res.status !== 200) {
      console.log("HTTP ERROR", res.status, url);
      return null;
    }

    return res.data;

  } catch (err) {

    console.log("โหลดหน้าไม่ได้", url);
    return null;

  }
}

async function scrapeDetail(link) {
  const html = await fetchPage(link);
  if (!html) return null;

  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim();

  const episodes = [];
  $(".mp-ep-btn").each((i, el) => {
    const epTitle = $(el).text().trim();
    const epId = $(el).attr("data-id");

    episodes.push({
      episode: epTitle,
      id: epId
    });
  });

  const servers = [];
  $(".mp-s-sl").each((i, el) => {
    const url = $(el).attr("data-id");

    servers.push({
      server: i + 1,
      url
    });
  });

  return {
    title,
    link,
    episodes,
    servers
  };
}

async function scrape() {

  for (let page = 1; page <= MAX_PAGE; page++) {

  const url = `${cat.url}page/${page}/`;

  console.log("หน้า", page);
  console.log("URL", url);

  const html = await fetchPage(url);
  if (!html) continue;

    const $ = cheerio.load(html);

    const movies = $(".movie, article, .movie-item, .grid-item");

for (let i = 0; i < movies.length; i++) {

  const el = movies[i];

  const img = $(el).find("img");
  const title = img.attr("alt") || img.attr("title") || "no-title";
  const image = img.attr("src") || img.attr("data-src");
  const link = $(el).find("a").attr("href");

  if (!link) continue;

  if (exists.has(link)) {
    console.log("มีแล้ว", title);
    continue;
  }

  console.log("กำลังดึง", title);

  const detail = await scrapeDetail(link);

  if (!detail) {
    console.log("ดึง detail ไม่ได้", title);
  }

  results.push({
    title,
    link,
    image,
    episodes: detail?.episodes || [],
    servers: detail?.servers || []
  });

  exists.add(link);

  fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2));
}
  }

  console.log("เสร็จทั้งหมด", results.length);
}

scrape();
