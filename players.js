const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const EPISODES_DIR = "./data/episodes";
const OUTPUT_DIR = "./data/playlist";

const API = "https://www.series-days.com/api/get.php";

const axiosClient = axios.create({
    timeout: 15000,
    headers:{
        "User-Agent":"Mozilla/5.0"
    }
});

function delay(ms){
    return new Promise(r=>setTimeout(r,ms));
}

async function retry(fn, times=3){
    for(let i=0;i<times;i++){
        try{
            return await fn();
        }catch(e){
            if(i===times-1) throw e;
            await delay(1000);
        }
    }
}

function convertUrl(inputUrl){

    const match = inputUrl.match(/id=([^&]+)/);

    if(match){

        const id = match[1];

        return `https://main.24playerhd.com/m3u8/${id}/${id}438.m3u8`;

    }

    return inputUrl;
}

async function getVideo(epUrl, episodeNumber){

    try{

        const res = await retry(()=>axiosClient.get(epUrl));

        const $ = cheerio.load(res.data);

        const btn = $(".halim-btn.active, .halim-btn").first();

        if(!btn.length){

            console.log("player button not found:",epUrl);
            return [];

        }

        const postId = btn.attr("data-post-id");
        const nonce = btn.attr("data-type") || "halim_ajax_player";

        if(!postId) return [];

        const servers = [1,2,3];

        let result = [];

        for(const server of servers){

            try{

                const params = new URLSearchParams();

                params.append("action","halim_ajax_player");
                params.append("nonce",nonce);
                params.append("episode",episodeNumber);
                params.append("postid",postId);
                params.append("lang","Thai");
                params.append("server",server);

                const player = await retry(()=>axiosClient.post(API,params,{
                    headers:{
                        "Content-Type":"application/x-www-form-urlencoded",
                        "Referer":epUrl
                    }
                }));

                const $$ = cheerio.load(player.data);

                const iframe = $$("iframe").attr("src");

                if(!iframe) continue;

                const video = convertUrl(iframe);

                if(video){

                    if(!result.find(v=>v.url===video)){

                        result.push({
                            name:"Server "+server,
                            url:video
                        });

                    }

                }

            }catch(e){
                continue;
            }

        }

        return result;

    }catch(e){

        console.log("error:",epUrl);
        return [];

    }

}

async function scrapeEpisode(ep,i){

    const epUrl = ep.url;

    if(!epUrl) return null;

    console.log("fetch:",epUrl);

    const servers = await getVideo(epUrl, ep.ep);

    await delay(500);

    return {
        name: ep.name || ep.episode || "EP"+(i+1),
        servers: servers.length ? servers : []
    };

}

async function run(){

    const files = fs.readdirSync(EPISODES_DIR)
        .filter(f => f.endsWith(".json"));

    const isTest = process.argv.includes("test");
    
    for(const file of files){

    	console.log("CATEGORY:", file);

    	const data = JSON.parse(
        fs.readFileSync(`${EPISODES_DIR}/${file}`,"utf8")
    );

    const result = [];

    const seriesList = isTest ? [data[0]] : data;

    for(const series of seriesList){

        console.log("Series:",series.title);

        const obj = {
            title:series.title,
            image:series.image || "",
            episodes:[]
        };

        let episodes = series.episodes;

        if(isTest){
            episodes = [episodes[0]];
        }

        const tasks = episodes.map((ep,i)=>scrapeEpisode(ep,i));

        const results = await Promise.all(tasks);

        obj.episodes = results.filter(Boolean);

        result.push(obj);

    }

    fs.mkdirSync(OUTPUT_DIR,{recursive:true});

    const category = file
        .replace("episodes-","")
        .replace(".json","");

    const outputFile = `${OUTPUT_DIR}/${category}.json`;

    fs.writeFileSync(
        outputFile,
        JSON.stringify(result,null,2)
    );

    console.log("done ->",outputFile);
}
}

run();