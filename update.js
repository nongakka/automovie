const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

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
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
        "Referer": "https://goseries4k.com/"
      },
      timeout: 15000,
      validateStatus: () => true
    });

    if (res.status !== 200) {
      console.log("HTTP", res.status, url);
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

  const baseUrl = cat.url.replace(/\/$/, "");

  for (let page = 1; page <= MAX_PAGE; page++) {

    let url;

    if (page === 1) {
      url = `${baseUrl}/`;
    } else {
      url = `${baseUrl}/page/${page}/`;
    }

    console.log("หน้า", page);
    console.log("URL", url);

    const html = await fetchPage(url);

    if (!html) {
      console.log("ไม่มีหน้าแล้ว หยุด");
      break;
    }

    const $ = cheerio.load(html);

    const movies = $("article");

    console.log("พบโพสต์:", movies.length);

    if (movies.length === 0) {
      console.log("ไม่มีโพสต์ หยุด");
      break;
    }

    for (let i = 0; i < movies.length; i++) {

      const el = movies[i];

      const img = $(el).find("img").first();

      const title =
        img.attr("alt") ||
        img.attr("title") ||
        "no-title";

      const image =
        img.attr("src") ||
        img.attr("data-src") ||
        img.attr("data-lazy-src") ||
        "";

      const link = $(el).find("a").first().attr("href")?.trim();

      if (!link) continue;

      if (exists.has(link)) {
        console.log("มีแล้ว", title);
        continue;
      }

      console.log("กำลังดึง", title);

      const detail = await scrapeDetail(link);

      if (!detail) {
        console.log("ดึง detail ไม่ได้", title);
        continue;
      }

      results.push({
        title,
        link,
        image,
        episodes: detail.episodes || [],
        servers: detail.servers || []
      });

      exists.add(link);

      fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2));

    }

  }

  console.log("เสร็จทั้งหมด", results.length);

}

scrape();
