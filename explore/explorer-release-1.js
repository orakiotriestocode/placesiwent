
(function(){
"use strict";
const scan=document.getElementById("scan"),radius=document.getElementById("radius"),language=document.getElementById("language");
const status=document.getElementById("status"),results=document.getElementById("results"),meta=document.getElementById("meta");
const reader=document.getElementById("article-reader"),readerFrame=document.getElementById("reader-frame"),readerTitle=document.getElementById("reader-title"),readerOriginal=document.getElementById("reader-original"),readerClose=document.getElementById("reader-close");
let lastReaderTrigger=null,readerSequence=0;
function closeReader(){readerSequence++;reader.hidden=true;document.body.classList.remove("reader-open");readerFrame.removeAttribute("srcdoc");if(lastReaderTrigger)lastReaderTrigger.focus()}
readerClose.addEventListener("click",closeReader);
reader.addEventListener("click",event=>{if(event.target===reader)closeReader()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!reader.hidden)closeReader()});
function readerDocument(article,lang){
const base="https://"+lang+".wikipedia.org/";
const css=`
:root{color-scheme:dark;--bg:#101c27;--panel:#182a34;--panel2:#213840;--text:#eff3e7;--muted:#b6c8cc;--border:#3b555d;--accent:#81e1b3}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg)}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.78;margin:0 auto;padding:34px clamp(20px,5vw,62px) 75px;max-width:960px;background:var(--bg);color:var(--text);font-size:16px}
body::selection{background:#286452;color:white}
.mw-parser-output{color:var(--text);overflow-wrap:anywhere}
p,li,dd,dt,td,th{color:var(--text)}
p{margin:1.05em 0}
h1,h2,h3,h4,h5,h6{font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;color:var(--text)!important;line-height:1.3;letter-spacing:-.035em;font-weight:750}
h2{font-size:1.65rem;margin:1.85em 0 .7em;border-bottom:1px solid var(--border);padding-bottom:11px}
h3{font-size:1.25rem;margin:1.45em 0 .55em}
h4{font-size:1.08rem}
a,a:link,a:visited{color:var(--accent)!important;text-decoration-color:#76bd9a;text-underline-offset:3px;overflow-wrap:anywhere}
a:hover{text-decoration-thickness:2px}
img{max-width:100%;height:auto;border-radius:10px}
figure,.thumb,.thumbinner,.tright,.tleft{float:none!important;margin:20px auto!important;max-width:100%!important}
figure img,.thumbimage{max-height:480px;object-fit:contain;display:block}
figcaption,.thumbcaption{font-size:.83rem;line-height:1.55;color:var(--muted)!important;margin-top:8px}
.mw-parser-output>figure:first-child,.mw-parser-output>.thumb:first-child{margin-top:0!important}
.mw-parser-output>figure:first-child img,.mw-parser-output>.thumb:first-child img{box-shadow:0 14px 38px #050b1270}
.infobox,.wikitable,.toc,.vertical-navbox{background:var(--panel)!important;color:var(--text)!important;border:1px solid var(--border)!important;border-radius:12px!important;padding:12px!important}
.infobox{float:right!important;width:min(310px,100%)!important;max-width:100%!important;margin:0 0 25px 25px!important;font-size:.86rem;line-height:1.5}
.infobox th,.infobox td,.wikitable th,.wikitable td{background:transparent!important;color:var(--text)!important}
.infobox img{max-width:100%}
table{max-width:100%;border-collapse:collapse}
.wikitable{display:block;overflow-x:auto}
td,th{padding:8px;border:1px solid var(--border)}
table[style*="background"],div[style*="background"]{background-color:transparent!important}
.mw-editsection,.navbox,.metadata,.noprint,.ambox,.hatnote,.authority-control,.mw-empty-elt,.reflist,.shortdescription{display:none!important}
sup.reference{font-size:.7rem}
.toc{padding:18px!important}
.toc ul{list-style:none;padding-left:15px}
blockquote{border-left:3px solid var(--accent);background:var(--panel);border-radius:0 9px 9px 0;padding:12px 18px;margin:22px 0}
ul,ol{padding-left:24px}
li{margin:5px 0}
hr{border:0;border-top:1px solid var(--border)}
@media(max-width:650px){body{padding:22px 18px 55px;font-size:15.5px}.infobox{float:none!important;width:100%!important;margin:18px 0!important}h2{font-size:1.4rem}.thumb img,figure img{max-height:340px}}
`;
return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\'; font-src \'none\';"><base href="'+base+'" target="_blank"><style>'+css+'</style></head><body>'+article+'</body></html>';
}
async function openReader(pageId,lang,title,trigger){
lastReaderTrigger=trigger;const seq=++readerSequence;
readerTitle.textContent=title;readerOriginal.href="https://"+lang+".wikipedia.org/?curid="+encodeURIComponent(pageId);
reader.hidden=false;document.body.classList.add("reader-open");readerClose.focus();
readerFrame.srcdoc=readerDocument('<p>Loading Wikipedia article…</p>',lang);
try{
const data=await wiki({action:"parse",pageid:String(pageId),prop:"text",disableeditsection:"1",disabletoc:"0",redirects:"1",formatversion:"2"},lang);
if(seq!==readerSequence)return;
const html=data.parse&&data.parse.text;
if(!html)throw Error("No readable article content returned");
readerTitle.textContent=data.parse.title||title;
readerFrame.srcdoc=readerDocument(html,lang);
}catch(err){if(seq!==readerSequence)return;readerFrame.srcdoc=readerDocument('<h2>Could not open this article</h2><p>Please use the original Wikipedia link below.</p>',lang);console.warn(err)}
}

const countryLanguages={be:"nl",nl:"nl",fr:"fr",de:"de",at:"de",ch:"de",lu:"fr",es:"es",pt:"pt",it:"it",gb:"en",ie:"en",us:"en",ca:"en",au:"en",nz:"en",jp:"ja",cn:"zh",tw:"zh",kr:"ko",in:"hi",br:"pt",mx:"es",ar:"es",cl:"es",co:"es",pe:"es",gr:"el",tr:"tr",pl:"pl",cz:"cs",sk:"sk",hu:"hu",ro:"ro",bg:"bg",rs:"sr",hr:"hr",si:"sl",ua:"uk",ru:"ru",se:"sv",no:"no",dk:"da",fi:"fi",ee:"et",lv:"lv",lt:"lt",is:"is",il:"he",sa:"ar",ae:"ar",eg:"ar",ma:"ar",th:"th",vn:"vi",id:"id",my:"ms",ph:"tl",za:"en"};
const labelFor={en:"English",nl:"Dutch",fr:"French",de:"German",es:"Spanish",it:"Italian",pt:"Portuguese",ja:"Japanese",zh:"Chinese",ko:"Korean",hi:"Hindi"};
let lastScan=null,scanId=0;
function message(text,error=false){status.textContent=text;status.classList.toggle("error",error)}
function clear(){results.replaceChildren()}
function empty(text){clear();const el=document.createElement("div");el.className="empty";el.style.gridColumn="1/-1";el.textContent=text;results.append(el)}
function wiki(params,lang="en"){
const q=new URLSearchParams({action:"query",format:"json",origin:"*",...params});
return fetch("https://"+encodeURIComponent(lang)+".wikipedia.org/w/api.php?"+q.toString()).then(async r=>{if(!r.ok)throw Error("Wikipedia HTTP "+r.status);const data=await r.json();if(data.error)throw Error(data.error.info||"Wikipedia error");return data});
}
function getPosition(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:60000}))}
function nameOf(lang){return labelFor[lang]||lang.toUpperCase()}
async function localLanguage(lat,lon){
try{
const url="https://nominatim.openstreetmap.org/reverse?"+new URLSearchParams({lat:String(lat),lon:String(lon),format:"jsonv2",zoom:"5",addressdetails:"1",accept_language:"en"});
const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw Error("Nominatim "+response.status);
const address=(await response.json()).address||{},country=(address.country_code||"").toLowerCase();
if(country==="be"){
const state=(address.state||"").toLowerCase(),county=(address.county||"").toLowerCase();
if(state.includes("wallon")||state.includes("walloon")||state.includes("liège")||state.includes("namur")||state.includes("hainaut")||state.includes("luxembourg")||county.includes("liège"))return {lang:"fr",country};
if(state.includes("brussels")||state.includes("bruxelles")||state.includes("brussel"))return {lang:"fr",country};
return {lang:"nl",country};
}
if(country==="ch"){return {lang:"de",country}}
return {lang:countryLanguages[country]||"en",country};
}catch(e){console.warn("Local language detection unavailable",e);return {lang:(navigator.language||"en").split("-")[0].toLowerCase(),country:null}}
}
function makeCard(p,displayLang){
const info=p.view||{},sourceLang=p.lang,translated=!!p.translated;
const card=document.createElement("article");card.className="card";
const visual=document.createElement("div");visual.className="visual";
const thumbnail=info.thumbnail||p.sourceInfo&&p.sourceInfo.thumbnail;
if(thumbnail&&/^https:\/\//.test(thumbnail.source)){const img=document.createElement("img");img.src=thumbnail.source;img.loading="lazy";img.alt="Photo of "+(info.title||p.title);visual.append(img)}
else{const placeholder=document.createElement("span");placeholder.className="placeholder";placeholder.textContent="✧";visual.append(placeholder)}
const body=document.createElement("div");body.className="body";
const tag=document.createElement("span");tag.className="kicker";tag.textContent=(p.dist<1000?Math.round(p.dist)+" m":(p.dist/1000).toFixed(1)+" km")+" away"+(translated?"":" · "+nameOf(sourceLang)+" only");
const heading=document.createElement("h3");heading.textContent=translated?info.title:p.title;
const description=document.createElement("p");
description.textContent=translated?(info.extract||"Explore this place and its history on Wikipedia.").slice(0,300):"No "+nameOf(displayLang)+" Wikipedia article is available for this place yet. Open the original "+nameOf(sourceLang)+" article to learn more.";
const linkLang=translated?displayLang:sourceLang,linkId=translated?info.pageid:p.pageid;
const link=document.createElement("button");link.type="button";link.className="reader-trigger";link.textContent="Read article here ↗";
link.addEventListener("click",()=>openReader(linkId,linkLang,heading.textContent,link));
body.append(tag,heading,description,link);card.append(visual,body);return card;
}
async function getSourceDetails(places,langs){
const byId=new Map();
await Promise.allSettled(langs.map(async lang=>{
const selected=places.filter(p=>p.lang===lang);
for(let i=0;i<selected.length;i+=40){
const subset=selected.slice(i,i+40);
const data=await wiki({prop:"pageprops|langlinks|pageimages",pageids:subset.map(p=>p.pageid).join("|"),ppprop:"wikibase_item",lllimit:"max",pithumbsize:"480",pilimit:"max"},lang);
for(const page of Object.values(data.query&&data.query.pages||{}))byId.set(lang+":"+page.pageid,page);
}
}));
return byId;
}
async function getTranslations(places,sourceDetails,displayLang){
const translations=new Map(),titles=[];
for(const p of places){
const source=sourceDetails.get(p.lang+":"+p.pageid)||{};
p.sourceInfo=source;
if(p.lang===displayLang){
p.view={pageid:p.pageid,title:p.title,thumbnail:source.thumbnail};p.translated=true;
}else{
const match=(source.langlinks||[]).find(x=>x.lang===displayLang);
if(match){p.targetTitle=match["*"];titles.push(match["*"])}
}
}
const wanted=[...new Set(titles)];
for(let i=0;i<wanted.length;i+=35){
try{
const subset=wanted.slice(i,i+35);
const data=await wiki({prop:"pageimages|extracts",titles:subset.join("|"),pithumbsize:"480",pilimit:"max",exintro:"1",explaintext:"1",exsentences:"2",redirects:"1"},displayLang);
const alias=new Map();
for(const value of data.query&&data.query.normalized||[])alias.set(value.from,value.to);
for(const value of data.query&&data.query.redirects||[])alias.set(value.from,value.to);
const pages=Object.values(data.query&&data.query.pages||{});
for(const title of subset){
let resolved=title;
for(let k=0;k<3&&alias.has(resolved);k++)resolved=alias.get(resolved);
const page=pages.find(p=>p.title===resolved&&!p.missing);
if(page)translations.set(title,page);
}
}catch(e){console.warn("Translation lookup unavailable",e)}
}
for(const p of places){
if(p.lang!==displayLang&&p.targetTitle&&translations.has(p.targetTitle)){p.view=translations.get(p.targetTitle);p.translated=true}
else if(p.lang!==displayLang){p.translated=false}
}
const native=places.filter(p=>p.lang===displayLang);
for(let i=0;i<native.length;i+=40){
try{
const subset=native.slice(i,i+40),data=await wiki({prop:"pageimages|extracts",pageids:subset.map(p=>p.pageid).join("|"),pithumbsize:"480",pilimit:"max",exintro:"1",explaintext:"1",exsentences:"2"},displayLang);
const pages=data.query&&data.query.pages||{};
for(const p of subset)if(pages[p.pageid])p.view=pages[p.pageid];
}catch(e){console.warn("Native-language descriptions unavailable",e)}
}
return places;
}
async function present(data){
const displayLang=language.value==="local"?data.localLang:language.value;
message("Harmonizing results into "+nameOf(displayLang)+"…");
const places=data.places.map(p=>({...p})),sources=await getSourceDetails(places,data.sourceLangs);
await getTranslations(places,sources,displayLang);
const normalized=t=>t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
places.sort((a,b)=>a.dist-b.dist);
const deduped=[],seenIds=new Set(),seenNames=new Set();
for(const p of places){
const id=(sources.get(p.lang+":"+p.pageid)||{}).pageprops?.wikibase_item;
const name=normalized((p.view&&p.view.title)||p.title);
if(id&&seenIds.has(id))continue;
if(seenNames.has(name))continue;
if(id)seenIds.add(id);seenNames.add(name);deduped.push(p);
}
clear();deduped.forEach(p=>results.append(makeCard(p,displayLang)));
const unavailable=deduped.filter(p=>!p.translated).length;
meta.textContent=deduped.length+" places · within "+(data.radius<1000?data.radius+" m":(data.radius/1000)+" km")+" · "+data.sourceLangs.join(" + ").toUpperCase()+" → "+nameOf(displayLang);
message("Found "+deduped.length+" nearby places, displayed in "+nameOf(displayLang)+" where Wikipedia has an article."+(unavailable?" "+unavailable+" have no "+nameOf(displayLang)+" article and are marked as original language.":""));
}
async function run(){
if(!navigator.geolocation){message("Your browser does not support location services.",true);return}
if(!window.isSecureContext){message("Location requires a secure HTTPS connection.",true);return}
const id=++scanId;scan.disabled=true;scan.textContent="⌖  Scanning…";clear();meta.textContent="Finding your location";message("Requesting your location…");
try{
const position=await getPosition(),lat=position.coords.latitude,lon=position.coords.longitude;
const accuracy=Math.round(position.coords.accuracy||0);
message("Location found"+(accuracy?" (±"+accuracy+" m).":"") +" Detecting local language…");
const local=await localLanguage(lat,lon);
const sourceLangs=[...new Set([local.lang,"en"])];const radiusMeters=Number(radius.value);
message("Searching "+sourceLangs.map(nameOf).join(" and ")+" Wikipedia…");
const scans=await Promise.allSettled(sourceLangs.map(async lang=>{
const response=await wiki({list:"geosearch",gscoord:lat+"|"+lon,gsradius:String(radiusMeters),gslimit:"150",gsnamespace:"0"},lang);
return ((response.query&&response.query.geosearch)||[]).map(p=>({...p,lang}));
}));
const available=scans.map((x,i)=>({result:x,lang:sourceLangs[i]})).filter(x=>x.result.status==="fulfilled");
if(!available.length)throw Error("Wikipedia search is unavailable");
const places=available.flatMap(x=>x.result.value);
if(!places.length){empty("No Wikipedia places found in this radius. Try a larger radius.");meta.textContent="0 nearby places";message("No places found in this area.");return}
lastScan={places,sourceLangs:available.map(x=>x.lang),localLang:local.lang,radius:radiusMeters};
if(id===scanId)await present(lastScan);
}catch(err){
if(err.code===1)message("Location permission was denied. Enable it in your browser settings.",true);
else if(err.code===2)message("Your location could not be determined.",true);
else if(err.code===3)message("Location lookup timed out. Please try again.",true);
else message("Couldn't load nearby places: "+(err.message||"Unknown error"),true);
empty("No discoveries to show yet.");meta.textContent="Scan unavailable";
}finally{scan.disabled=false;scan.textContent="⌖  Scan — what's near?"}
}
scan.addEventListener("click",()=>{message("Starting location scan…");run().catch(e=>message("Scan error: "+(e.message||e),true))});
language.addEventListener("change",()=>{if(lastScan)present(lastScan).catch(e=>message("Couldn't change display language: "+e.message,true))});
})();
