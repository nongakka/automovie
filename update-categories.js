const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

async function run() {

  const url = "https://goseries4k.com/category/";

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  const categories = [];

  $(".cat-item a").each((i, el) => {

    const name = $(el).text().trim();
    const link = $(el).attr("href");

    if (!link.includes("category")) return;

    const slug = link
      .split("/category/")[1]
      .replace(/\//g, "")
      .replace(/%/g,"")
      .toLowerCase();

    categories.push({
      name,
      slug,
      url: link
    });

  });

  fs.writeFileSync(
    "data/categories.json",
    JSON.stringify(categories, null, 2)
  );

  console.log("Categories:", categories.length);
}

run();
