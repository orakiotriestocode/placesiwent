window.createExplorerMap=function(openReader){
"use strict";
const mapElement=document.getElementById("poi-map"),mapStatus=document.getElementById("map-status");
let poiMap,poiLayer,mappedScan;
const markers=new Map();
function resetPoiMap(){
mappedScan=null;
markers.clear();
if(poiLayer)poiLayer.clearLayers();
}
function initializePoiMap(){
if(poiMap)return;
const L=window.L;
if(!L){
mapStatus.textContent="The map could not load. You can still scan and browse the list below.";
return;
}
mapElement.hidden=false;
poiMap=L.map(mapElement,{scrollWheelZoom:false}).setView([20,0],2);
const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});
tiles.on("tileerror",()=>{mapStatus.textContent="Some map tiles could not load. Your location and place pins can still appear.";});
tiles.addTo(poiMap);
poiLayer=L.layerGroup().addTo(poiMap);
mapStatus.textContent="Tap Scan to center the map on your location.";
}
function showPoiMap(data,places,displayLang){
if(!poiLayer)return;
const L=window.L;
try{
poiMap.invalidateSize();
markers.clear();
poiLayer.clearLayers();
const center=[data.lat,data.lon];
const circle=L.circle(center,{radius:data.radius,color:"#2475d0",fillOpacity:.12,interactive:false}).addTo(poiLayer);
L.circleMarker(center,{radius:7,color:"#fff",weight:2,fillColor:"#2475d0",fillOpacity:1})
.addTo(poiLayer).bindPopup("You are here");
for(const place of places){
if(!Number.isFinite(place.lat)||!Number.isFinite(place.lon))continue;
const title=place.translated?place.view?.title||place.title:place.title;
const popup=document.createElement("div");
const button=document.createElement("button");
button.type="button";
button.textContent="Read Wikipedia article";
button.addEventListener("click",()=>openReader(
place.translated?place.view?.pageid||place.pageid:place.pageid,
place.translated?displayLang:place.lang,title,button));
const heading=document.createElement("p");
heading.textContent=title;
popup.append(heading,button);
markers.set(place,L.marker([place.lat,place.lon],{title,alt:title}).addTo(poiLayer).bindPopup(popup));
}
if(mappedScan!==data){
poiMap.fitBounds(circle.getBounds(),{padding:[16,16],maxZoom:18});
mappedScan=data;
}
}catch(error){
resetPoiMap();
mapStatus.textContent="Could not show this scan on the map. The results list is still available.";
console.warn("Nearby map unavailable",error);
}
}
try{initializePoiMap()}catch(error){
mapElement.hidden=true;
mapStatus.textContent="The map could not load. You can still scan and browse the list below.";
console.warn("Nearby map unavailable",error);
}
function focusPlace(place){
const marker=markers.get(place);
if(!marker)return false;
marker.openPopup();
return true;
}
return {focusPlace,resetPoiMap,showPoiMap,resize:()=>poiMap?.invalidateSize(),get poiLayer(){return poiLayer},get mappedScan(){return mappedScan}};
};
