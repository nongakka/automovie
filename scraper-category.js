const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const { execSync } = require("child_process")
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
const isTest = process.argv.includes("test")

function getSlug(url){

    if(!url) return ""

    return url
        .replace("https://www.series-days.com/","")
        .replace(/\//g,"")

}

function sleep(ms){
    return new Promise(r=>setTimeout(r,ms))
}

function gitCommit(message){

    try{

        execSync("git add data", {stdio:"ignore"})
        execSync(`git commit -m "${message}"`, {stdio:"ignore"})
        execSync("git push", {stdio:"ignore"})

        console.log("GIT COMMIT:",message)

    }catch(e){

        console.log("GIT SKIP")

    }

}
function loadProgress(name){

    const file = `data/progress/${name}.json`

    if(!fs.existsSync(file)){
        return 1
    }

    const data = JSON.parse(fs.readFileSync(file,"utf8"))

    return data.page || 1
}

function saveProgress(name,page){

    fs.mkdirSync("data/progress",{recursive:true})

    fs.writeFileSync(
    `data/progress/${name}.json`,
    JSON.stringify({
        category:name,
        page:page,
        updated: Date.now()
    },null,2)
)

}

async function scrapeCategory(name,url){

    let page = loadProgress(name)

    let list = []

    // ✅ สร้างโฟลเดอร์ก่อน
    fs.mkdirSync("data/series",{recursive:true})

    const file = `data/series/series-${name}.json`

    if(fs.existsSync(file)){
    list = JSON.parse(fs.readFileSync(file,"utf8"))
    }

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

                if(isTest && list.length >= 1){
                    return false
                }

                const link = $(el).find("a").attr("href")

                const title = $(el).find(".p2").text().trim()

                const image =
                    $(el).find("img").attr("data-lazy-src") ||
                    $(el).find("img").attr("src") ||
                    ""

                const slug = getSlug(link)

                if(!link || !title) return
                const exists = list.find(x => x.slug === slug)

                if(!exists){
                    list.push({
                        title,
                        slug,
                        link,
                        image,
                        category:name
                    })
                }
            })
            
    if(isTest && list.length >= 1){
        console.log("TEST MODE STOP:",name)
            break
    }
            
    page++
    saveProgress(name,page)

    if(page % 5 === 0){

    gitCommit(`update ${name} page ${page}`)

}
    
    fs.writeFileSync(
    `data/series/series-${name}.json`,
    JSON.stringify(list,null,2)
)
            // ป้องกันโดน block
            await sleep(1000)

        }catch(e){

            console.log("ERROR PAGE",page)

            break

        }

    }

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

    try{

        await scrapeCategory(name,categories[name])

    }catch(e){

        console.log("CATEGORY ERROR:",name)

    }

    console.log("DONE CATEGORY:",name)
    console.log("-------------------------")

}

}

run()









