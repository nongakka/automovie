const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { URL } = require("url");
const { execSync } = require("child_process");

const categories = JSON.parse(fs.readFileSync("categories.json"));

// ==========================
// รับชื่อหมวดจาก command line
// ==========================
const selectedSlug = process.argv[2];

if (!selectedSlug) {
  console.log("❌ กรุณาระบุ slug");
  process.exit(1);
}

const cat = categories.find(c => c.slug === selectedSlug);
if (!cat) {
  console.log("❌ ไม่พบหมวด:", selectedSlug);
  process.exit(1);
}

console.log("🎯 เลือกหมวด:", cat.name);

// =========================
// AXIOS CONFIG
// =========================
const client = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept-Language": "th-TH,th;q=0.9"
  },
  timeout: 20000
});

const delay = ms => new Promise(r => setTimeout(r, ms));
const randomDelay = (min=700,max=1500) =>
  delay(Math.floor(Math.random()*(max-min+1))+min);

function normalizeUrl(url) {
  if (!url) return null;
  return url.split("?")[0].replace(/\/+$/, "");
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.","");
  } catch {
    return "";
  }
}

// ==========================
// FETCH WITH RETRY
// ==========================
async function fetchWithRetry(url, retries=3) {
  for (let i=0;i<retries;i++) {
    try {
      return await client.get(url);
    } catch (err) {
      if (i===retries-1) throw err;
      console.log("🔁 retry:", url);
      await delay(1000);
    }
  }
}

  // ======================
  // DEFAULT HANDLER
  // ======================
const SiteHandlers = {
default: {
    articleSelectors: [
      "article",
      ".post",
      ".post-item",
      ".grid-item",
      ".item",
      ".movie-item",
      ".post-listing article",
      ".td-module-container",
      ".td_module_wrap",
      ".td_module_10",
      ".td_module_1"
    ],
  
  episodeSelectors: [
    ".entry-content p a",
    ".entry-content a",
    ".entry-content li a",
    ".episode a",
    ".ep a",
    "ul li a"
  ],
    async getServers(epUrl) {

  const { data } = await fetchWithRetry(epUrl);
  const $ = cheerio.load(data);

  let servers = [];

  const buttons = $(".halim-btn");

  if(buttons.length === 0){
    console.log("⚠️ ไม่พบ halim server");
    return servers;
  }

  const postId = buttons.first().attr("data-post-id");

  for(let i=0;i<buttons.length;i++){

    const btn = buttons.eq(i);

    const server = btn.attr("data-server");
    const episode = btn.attr("data-episode");
    const name = btn.text().trim();

    if(!server || !episode) continue;

    try{

const res = await client.post(
  "https://www.series-days.com/wp-admin/admin-ajax.php",
  new URLSearchParams({
    action: "halim_ajax_player",
    post_id: postId,
    server: server,
    episode: episode
  }),
  {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
      "Referer": epUrl,
      "Origin": "https://www.series-days.com"
    }
  }
);

      const $$ = cheerio.load(res.data);

      $$("iframe").each((j,el)=>{

        let src = $$(el).attr("src");

        if(!src) return;

        if(src.startsWith("//")){
          src = "https:"+src;
        }

        servers.push({
          name: name || `Server ${j+1}`,
          url: src
        });

      });

    }catch(err){

      console.log("⚠️ ajax error", server);

    }

  }

  return servers;

}
},
  // ======================
  // 123HDTV
  // ======================
  "123hdtv.com": {
    articleSelectors: [
      ".grid-item",".item-movie",".movie","article"
    ],
    episodeSelectors: [
      ".list-episode a",".episode-item a",".episodes a"
    ],
    async getServers(epUrl) {
      const { data } = await fetchWithRetry(epUrl);
      const $ = cheerio.load(data);
      let servers = [];

      $("iframe").each((i,el)=>{
        const src=$(el).attr("data-src")||$(el).attr("src");
        if (src) servers.push({ name:`Server ${i+1}`, url:src });
      });

      return servers;
    }
 },
// ======================
// SERIES-DAYS
// ======================
"series-days.com": {

  articleSelectors: [
    ".grid-movie .box"
  ],

  episodeSelectors: [
    "select[name='Sequel_select'] option"
  ],

  async getServers(epUrl){

    const servers = [];

    const { data } = await fetchWithRetry(epUrl);
    const $ = cheerio.load(data);

    const buttons = $(".halim-btn");

if(buttons.length === 0){
  console.log("⚠️ ไม่พบ halim server");
  return servers;
}

const postId = buttons.first().attr("data-post-id");

for(let i=0;i<buttons.length;i++){

  const btn = buttons.eq(i);

  const server = btn.attr("data-server");
  const episode = btn.attr("data-episode");
  const name = btn.text().trim();

  if(!server || !episode) continue;

  try{

    const res = await client.post(
      "https://www.series-days.com/wp-admin/admin-ajax.php",
      new URLSearchParams({
        action: "halim_ajax_player",
        post_id: postId,
        server: server,
        episode: episode
      }),
      {
        headers:{
          "Content-Type":"application/x-www-form-urlencoded",
          "X-Requested-With":"XMLHttpRequest",
          "User-Agent":"Mozilla/5.0",
          "Referer": epUrl,
          "Origin":"https://www.series-days.com"
        }
      }
    );

    const $$ = cheerio.load(res.data);

    $$("iframe").each((j,el)=>{

      let src = $$(el).attr("src");

      if(!src) return;

      if(src.startsWith("//")){
        src = "https:"+src;
      }

      console.log("🎥 player:", src);

      servers.push({
        name: name || `Server ${j+1}`,
        url: src
      });

    });

  }catch(err){
    console.log("⚠️ ajax error", server);
  }

}

    return servers;

  }

},
};

// ==========================
// SELECT HANDLER
// ==========================
function getHandler(url) {
  const domain = getDomain(url);
  return SiteHandlers[domain] || SiteHandlers.default;
}

// ==========================
// AUTO DETECT HELPERS
// ==========================
function autoDetect($, selectors) {
  for (const sel of selectors) {
    const found = $(sel);
    if (found.length > 0) {
      console.log("🔍 ใช้ selector:", sel);
      return found;
    }
  }

  // สำคัญมาก: ต้อง return cheerio object
  return $([]);
}

function extractBasicInfo($, el) {

  const $el = $(el);

  const a = $el.find("a").first();

  let link =
    a.attr("href") ||
    $el.find("a[href]").attr("href");

  let image =
    $el.find("img").attr("data-src") ||
    $el.find("img").attr("data-lazy-src") ||
    $el.find("img").attr("data-original") ||
    $el.find("img").attr("src");

  let title =
    $el.find("img").attr("alt") ||
    $el.find("a").attr("title") ||
    $el.find(".title").text().trim() ||
    $el.find("h3").text().trim();

  return { title, link, image };

}

// ==========================
// FILE SIZE CONTROL
// ==========================
const MAX_FILE_SIZE = 5*1024*1024;

function commitProgress(message){
  try{

    execSync("git config user.name 'github-actions'");
    execSync("git config user.email 'actions@github.com'");

    execSync("git add data");

    try{
      execSync(`git commit -m "${message}"`);
    }catch{
      console.log("ไม่มีการเปลี่ยนแปลง");
      return;
    }

    execSync("git pull --rebase origin main");
    execSync("git push");

    console.log("🚀 pushed to github");

  }catch(err){
    console.log("⚠️ push error");
  }
}

// ==========================
// MAIN
// ==========================
(async()=>{

if(!fs.existsSync("data")) fs.mkdirSync("data");

const progressFile = `data/${cat.slug}_progress.json`;

let startPage = 1;

if (fs.existsSync(progressFile)) {

  const saved = JSON.parse(fs.readFileSync(progressFile));
  startPage = saved.page || 1;

  console.log("🔁 Resume จากหน้า", startPage);

} else {

  // ⭐ เพิ่มตรงนี้
  fs.writeFileSync(
    progressFile,
    JSON.stringify({ page: 1 }, null, 2)
  );

  console.log("🆕 สร้าง progress ใหม่");

}

let fileIndex=1;
let currentData=[];
let currentFilePath=`data/${cat.slug}_${fileIndex}.json`;

const oldMap=new Map();

const files = fs.readdirSync("data")
  .filter(f =>
    f.startsWith(cat.slug + "_") &&
    f.endsWith(".json") &&
    !f.includes("progress")
  );

if(files.length>0){

  const indexes = files
  .map(f => {
    const m = f.match(/_(\d+)\.json$/);
    return m ? parseInt(m[1]) : null;
  })
  .filter(x => x !== null);

  fileIndex = Math.max(...indexes);

  currentFilePath = `data/${cat.slug}_${fileIndex}.json`;

}

for(const file of files){
  let data = [];

try{
  data = JSON.parse(fs.readFileSync(`data/${file}`));
}catch(e){
  console.log("⚠️ json error:", file);
}
  data.forEach(m=>{
    if(!m.episodes)m.episodes=[];
    oldMap.set(m.link,m);
  });
}

if (fs.existsSync(currentFilePath)) {
  try {
    currentData = JSON.parse(fs.readFileSync(currentFilePath));
  } catch {
    currentData = [];
  }
} else {
  currentData = [];
}

currentData.forEach(m=>{
  oldMap.set(m.link,m);
});

function saveWithSizeCheck(){
  const json = JSON.stringify(currentData, null, 2);

  if (Buffer.byteLength(json) > MAX_FILE_SIZE) {

    const last = currentData.pop();

    fs.writeFileSync(
      currentFilePath,
      JSON.stringify(currentData, null, 2)
    );

    fileIndex++;
    currentFilePath = `data/${cat.slug}_${fileIndex}.json`;
    currentData = [last];

  } else {

    // ✅ เพิ่มบรรทัดนี้เข้าไป
    fs.writeFileSync(currentFilePath, json);

  }
}

const handler = getHandler(cat.url);
let finished = false;
let episodeCounter = 0;

//save auto
setInterval(()=>{
  if(currentData.length > 0){
    fs.writeFileSync(
      currentFilePath,
      JSON.stringify(currentData,null,2)
    );
    console.log("💾 Auto save");
  }
}, 5*60*1000);

//LOOP

for (let page = startPage; page <= 999; page++) {

  // ⭐ เพิ่มตรงนี้
  fs.writeFileSync(
    progressFile,
    JSON.stringify({ page: page }, null, 2)
  );

  console.log("📄 หน้า", page);

  let pageSuccess = false;

  let pageUrl;
  try {

 

  if (page === 1) {
  pageUrl = cat.url;
} else {
  pageUrl = `${cat.url}page/${page}/`;
}
      console.log("🌐 URL:", pageUrl);
  const { data: catHtml } =
    await fetchWithRetry(pageUrl);

    const $cat = cheerio.load(catHtml);
    console.log("HTML length:", catHtml.length);
    for (const sel of handler.articleSelectors) {
  console.log("ลอง selector:", sel, "=>", $cat(sel).length);
}
    const postList = autoDetect($cat, handler.articleSelectors);

      console.log("พบโพสต์:", postList.length);

    const articles = postList.toArray();

    if (articles.length === 0) {

      console.log("ไม่มีข้อมูลแล้ว");

      finished = true;

      fs.writeFileSync(
        progressFile,
        JSON.stringify({ page: page })
      );

      break;
    }

    for (const el of articles) {

      const basic = extractBasicInfo($cat, el);
      if (!basic.title) continue;
        console.log("🎬", basic.title, basic.link);
      const link = normalizeUrl(basic.link);
      if (!link) continue;

      // ⭐ เพิ่มตรงนี้
      if (oldMap.has(link)) {
        console.log("🌐 ซ้ำข้ามหมวด:", basic.title);
        continue;
      }

      let movie = oldMap.get(link);
      

      if (movie && movie.episodes && movie.episodes.length > 0) {
        console.log("⏭ ข้ามเรื่อง (มีแล้ว):", movie.title);
        continue;
      }

      if (!movie) {
        movie = {
          title: basic.title,
          link,
          image: basic.image || "",
          episodes: []
        };

        currentData.push(movie);
        oldMap.set(link, movie);
        saveWithSizeCheck();
      }

      const { data: detailHtml } =
        await fetchWithRetry(link);

      const $detail = cheerio.load(detailHtml);

      const epElements =
        autoDetect($detail, handler.episodeSelectors).toArray();

      for (const el2 of epElements) {

      const $a = $detail(el2);

      if($a.text().includes("เลือก")) continue;

        let epLink = $a.attr("value") || $a.attr("href");
        if(!epLink) continue;

        epLink = normalizeUrl(epLink);

        if (epLink.startsWith("/")) {
        epLink = new URL(epLink, cat.url).href;
        }
       
        if (movie.episodes.find(x => x.link === epLink)) {
          console.log("⛔ ตอนซ้ำ หยุดเรื่อง");
          break;
        }

        console.log("↳ ดึงตอน:", $a.text().trim());

        const siteHandler = getHandler(epLink);

        let servers = [];

        try {
          servers = await siteHandler.getServers(epLink);
        } catch (err) {
          console.log("⚠️ server error:", epLink);
          console.log(err.response?.status || err.message);
        }

        if (!movie.episodes.find(e => e.link === epLink)) {
          movie.episodes.push({
            name: $a.text().trim(),
            link: epLink,
            servers
          });
        }

        episodeCounter++;

        saveWithSizeCheck();

        if (episodeCounter % 50 === 0) {

          console.log("🚀 commit partial");

          commitProgress(
            `update ${cat.slug} episodes ${episodeCounter}`
          );
        }

        await randomDelay();
      }

    }

    pageSuccess = true;

  } 
  
  catch (err) {

  console.log("⚠️ ข้ามหน้า", page);
  console.log("URL:", pageUrl);
  console.log(err.response?.status || err.message);

}

  if (pageSuccess) {

    saveWithSizeCheck();

    commitProgress(
      `update ${cat.slug} page ${page}`
    );

    fs.writeFileSync(
      progressFile,
      JSON.stringify({ page: page + 1 })
    );

    console.log("💾 บันทึก progress:", page + 1);

  }

  await randomDelay(1500, 2500);

}

if(currentData.length>0){
  fs.writeFileSync(currentFilePath,
    JSON.stringify(currentData,null,2));
}
if (finished) {
  console.log("SCRAPER_STATUS:FINISHED");
} else {
  console.log("SCRAPER_STATUS:IN_PROGRESS");
}
console.log("✅ เสร็จหมวด:",cat.name);



})();
