const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

async function run() {

  const url = "https://goseries4k.com/";

  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  const $ = cheerio.load(res.data);

  const categories = [];

  $("a").each((i, el) => {

    const link = $(el).attr("href");
    const name = $(el).text().trim();

    if (!link) return;

    if (link.includes("/category/")) {

      const slug = link.split("/category/")[1].replace(/\//g,"");

      categories.push({
        name,
        slug,
        url: link
      });

    }

  });

  fs.writeFileSync(
    "./data/categories.json",
    JSON.stringify(categories, null, 2)
  );

  console.log("saved", categories.length);
}

run();
