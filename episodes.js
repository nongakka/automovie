const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const { execSync } = require("child_process")

const selectedCategory = process.argv[2]

function sleep(ms){
    return new Promise(r=>setTimeout(r,ms))
}

function gitCommit(message){

    try{

        execSync("git add data",{stdio:"ignore"})
        execSync(`git commit -m "${message}"`,{stdio:"ignore"})
        execSync("git push",{stdio:"ignore"})

        console.log("GIT COMMIT:",message)

    }catch(e){

        console.log("GIT SKIP")

    }

}

function loadProgress(category){

    const file = `data/progress/episodes-progress-${category}.json`

    if(!fs.existsSync(file)){
        return 0
    }

    const data = JSON.parse(fs.readFileSync(file,"utf8"))
    return data.index || 0
}

function saveProgress(category,index){

    fs.mkdirSync("data/progress",{recursive:true})

    fs.writeFileSync(
        `data/progress/episodes-progress-${category}.json`,
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

const seriesFile = `data/series/series-${category}.json`

if(!fs.existsSync(seriesFile)){
    console.log("SKIP: series file not found ->",seriesFile)
    return
}

const series = JSON.parse(
    fs.readFileSync(seriesFile,"utf8")
)
if(!Array.isArray(series) || series.length === 0){
    console.log("NO SERIES DATA:",category)
    return
}
    let result = []

    const file = `data/episodes/episodes-${category}.json`

    if(fs.existsSync(file)){
        result = JSON.parse(fs.readFileSync(file,"utf8"))
    }

    let startIndex = loadProgress(category)
    console.log("START INDEX:",startIndex,"/",series.length)
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

const exists = result.find(x => x.slug === s.slug)

if(!exists){

    result.push({
        title: s.title,
        slug: s.slug,
        image: s.image,
        episodes
    })

}else{

    exists.episodes = episodes

}

            // ✅ autosave
            atomicSave(file,result)

            // ✅ save progress
    saveProgress(category,i+1)
    if((i+1) % 5 === 0){
        gitCommit(`episodes ${category} ${i+1}`)
}
}catch(e){

    console.log("ERROR:",s.title)
    console.log(e.message)

}

    }

    console.log("SAVE episodes-"+category+".json","TOTAL:",result.length)

}

async function run(){

    if(selectedCategory){

        console.log("CATEGORY:",selectedCategory)
        await scrapeEpisodes(selectedCategory)
        return

    }

    for(const category of categories){

        console.log("CATEGORY:",category)

        await scrapeEpisodes(category)

        console.log("----------------")

    }

}

run()





