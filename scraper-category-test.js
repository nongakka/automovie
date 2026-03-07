const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")

const categories = {

    chinese: "https://www.series-days.com/ซีรี่ย์จีน/",
    korean: "https://www.series-days.com/ซีรี่ย์เกาหลี/",
    japanese: "https://www.series-days.com/ซีรี่ย์ญี่ปุ่น/",
    thai: "https://www.series-days.com/ซีรี่ย์พากย์ไทย/",
    new: "https://www.series-days.com/ซีรี่ย์ใหม่-2025/",
    y: "https://www.series-days.com/ซีรี่ย์วาย/",
    western: "https://www.series-days.com/ซีรี่ย์ฝรั่ง/",
    netflix: "https://www.series-days.com/netflix/"

}

const TEST_MODE = true

function getSlug(url){

    if(!url) return ""

    return url
        .replace("https://www.series-days.com/","")
        .replace(/\//g,"")

}

async function scrapeCategory(name,url){

    console.log("CATEGORY:",name)

    let list = []

    try{

        const res = await axios.get(url,{
            headers:{
                "User-Agent":"Mozilla/5.0"
            }
        })

        const $ = cheerio.load(res.data)

        const posts = $(".grid-movie .box")

        if(posts.length === 0){

            console.log("NO POSTS:",name)
            return

        }

        posts.each((i,el)=>{

            if(TEST_MODE && i > 0) return false

            const link = $(el).find("a").attr("href")

            const title = $(el).find(".p2").text().trim()

            const image =
                $(el).find("img").attr("data-lazy-src") ||
                $(el).find("img").attr("src") ||
                ""

            const slug = getSlug(link)

            list.push({
                title,
                slug,
                link,
                image,
                category:name
            })

        })

    }catch(e){

        console.log("ERROR:",name)

    }

    fs.mkdirSync("data/series",{recursive:true})

    fs.writeFileSync(
        `data/series/series-${name}.json`,
        JSON.stringify(list,null,2)
    )

    console.log("SAVE series-"+name+".json")
    console.log("TOTAL:",list.length)

}

async function run(){

    for(const name in categories){

        await scrapeCategory(name,categories[name])

        console.log("------------------")

    }

}

run()