const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")

function sleep(ms){
    return new Promise(r=>setTimeout(r,ms))
}

function loadProgress(category){

    const file = `data/progress/episodes-${category}.json`

    if(!fs.existsSync(file)){
        return 0
    }

    const data = JSON.parse(fs.readFileSync(file))
    return data.index || 0
}

function saveProgress(category,index){

    fs.mkdirSync("data/progress",{recursive:true})

    fs.writeFileSync(
        `data/progress/episodes-${category}.json`,
        JSON.stringify({index},null,2)
    )
}

function atomicSave(path,data){

    const temp = path+".tmp"

    fs.writeFileSync(temp,JSON.stringify(data,null,2))

    fs.renameSync(temp,path)
}

const categories = [
    "chinese",
    "korean",
    "japanese",
    "thai",
    "new",
    "y",
    "western",
    "netflix"
]

function getEpNumber(name){
    const n = name.match(/\d+/)
    return n ? parseInt(n[0]) : 0
}

async function scrapeEpisodes(category){

    fs.mkdirSync("data/episodes",{recursive:true})

    const series = JSON.parse(
        fs.readFileSync(`data/series/series-${category}.json`)
    )

    let result = []

    const file = `data/episodes/episodes-${category}.json`

    if(fs.existsSync(file)){
        result = JSON.parse(fs.readFileSync(file))
    }

    let startIndex = loadProgress(category)

    for(let i=startIndex;i<series.length;i++){

        const s = series[i]

        console.log("SERIES:",s.title)

        await sleep(800)

        try{

            const res = await axios.get(s.link,{
                headers:{ "user-agent":"Mozilla/5.0" },
                timeout:15000
            })

            const $ = cheerio.load(res.data)

            let episodes = []

            $("select[name=Sequel_select] option").each((i,el)=>{

                const epName = $(el).text().trim()
                const epLink = $(el).attr("value")

                if(epLink){

                    episodes.push({
                        name: epName,
                        ep: getEpNumber(epName),
                        url: "https://www.series-days.com"+epLink
                    })

                }

            })

            episodes.sort((a,b)=>a.ep-b.ep)

            if(episodes.length === 0){
                console.log("NO EPISODES:",s.title)
            }

            result.push({
                title: s.title,
                slug: s.slug,
                image: s.image,
                episodes
            })

            // ✅ autosave
            atomicSave(file,result)

            // ✅ save progress
            saveProgress(category,i+1)

        }catch(e){

            console.log("ERROR:",s.title)

        }

    }

    console.log("SAVE episodes-"+category+".json")

}

async function run(){

    for(const category of categories){

        console.log("CATEGORY:",category)

        await scrapeEpisodes(category)

        console.log("----------------")

    }

}

run()
