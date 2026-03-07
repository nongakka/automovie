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
const selectedCategory = process.argv[2]
function getSlug(url){

    if(!url) return ""

    return url
        .replace("https://www.series-days.com/","")
        .replace(/\//g,"")

}

function sleep(ms){
    return new Promise(r=>setTimeout(r,ms))
}
function loadProgress(name){

    const file = `data/progress/${name}.json`

    if(!fs.existsSync(file)){
        return 1
    }

    const data = JSON.parse(fs.readFileSync(file))

    return data.page || 1
}
async function scrapeCategory(name,url){

    let page = 1
    let list = []

    while(true){

        const pageUrl = page === 1 ? url : url + "page/" + page + "/"

        console.log("CATEGORY:",name,"PAGE:",page)

        try{

            const res = await axios.get(pageUrl,{
                headers:{
                    "User-Agent":"Mozilla/5.0"
                }
            })

            const $ = cheerio.load(res.data)

            const posts = $(".grid-movie .box")

            if(posts.length === 0){

                console.log("END CATEGORY:",name)
                break

            }

            posts.each((i,el)=>{

                const link = $(el).find("a").attr("href")

                const title = $(el).find(".p2").text().trim()

                const image =
                    $(el).find("img").attr("data-lazy-src") ||
                    $(el).find("img").attr("src") ||
                    ""

                const slug = getSlug(link)

                if(!link || !title) return

                list.push({
                    title,
                    slug,
                    link,
                    image,
                    category:name
                })

            })

            page++

            // ป้องกันโดน block
            await sleep(1000)

        }catch(e){

            console.log("ERROR PAGE",page)

            break

        }

    }

    fs.mkdirSync("data/series",{recursive:true})

    fs.writeFileSync(
        `data/series/series-${name}.json`,
        JSON.stringify(list,null,2)
    )

    console.log("SAVE data/series/series-"+name+".json")
    console.log("TOTAL:",list.length)

}

async function run(){

    // ถ้า GitHub Action ส่ง category มา
    if(selectedCategory){

        const url = categories[selectedCategory]

        if(!url){

            console.log("CATEGORY NOT FOUND:",selectedCategory)
            return

        }

        await scrapeCategory(selectedCategory,url)

        return
    }

    // ถ้า run local จะ scrape ทุก category
    for(const name in categories){

        console.log("START CATEGORY:",name)

        await scrapeCategory(name,categories[name])

        console.log("DONE CATEGORY:",name)
        console.log("-------------------------")

    }

}

run()

