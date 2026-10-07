/*
 * Observatories, monitoring networks and field campaigns in Africa — interactive map
 * Requires D3 v7 (loaded before this file). Data is loaded from the /data folder.
 */
const MAP_CONFIG = {
  dataPath: "data/",                    // folder holding networks.json, stations.json, africa-boundaries.geojson
  openSampleCardOnLoad: "Tamanrasset_INM" // station id whose card opens on page load; set to null to start with no card open
};

(async function () {
  const base = MAP_CONFIG.dataPath;
  const [networks, stations, GEO] = await Promise.all([
    fetch(base + "networks.json").then(r => r.json()),
    fetch(base + "stations.json").then(r => r.json()),
    fetch(base + "africa-boundaries.geojson").then(r => r.json())
  ]);
  const DATA = { networks, stations };

  const NETS = DATA.networks; const NETKEYS = Object.keys(NETS); const SHAPE=Object.fromEntries(NETKEYS.map(k=>[k,NETS[k].shape]));
  const SYM={circle:d3.symbolCircle,square:d3.symbolSquare,triangle:d3.symbolTriangle,diamond:d3.symbolDiamond,star:d3.symbolStar};
  const AREA={circle:1,square:1.1,triangle:1.25,diamond:1.15,star:1.5};
  const NOW = 2026;
  const S = DATA.stations.map((s,i)=>({...s, uid:i}));
  const fmtPeriod = s => s.periodLabel || `${s.start} – ${s.end ?? "present"}`;
  const pretty = id => id.replace(/_/g," ");
  const fmtCoord = s => `${Math.abs(s.lat).toFixed(4)}° ${s.lat>=0?"N":"S"}, ${Math.abs(s.lon).toFixed(4)}° ${s.lon>=0?"E":"W"}`;
  const esc = t => String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  const state = {nets:new Set(NETKEYS), status:"all", country:"", q:"", sel:null, sort:{k:"country",dir:1}};
  const visible = s => state.nets.has(s.net) && (state.status==="all"||(state.status==="Active")===(s.status==="Active")) && (!state.country||s.country===state.country) &&
    (!state.q || (s.id+" "+s.city+" "+s.country).toLowerCase().includes(state.q));

  /* ---------- stats ---------- */
  const countries = [...new Set(S.map(s=>s.country))].sort((a,b)=>a.localeCompare(b));
  const nActive = S.filter(s=>s.status==="Active").length;
  const firstYear = d3.min(S,s=>s.start);
  document.getElementById("stats").innerHTML = [
  ].map(([v,l])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  const sel = document.getElementById("country");
  countries.forEach(c=>sel.insertAdjacentHTML("beforeend",`<option>${esc(c)}</option>`));
  const symD=(net,r)=>d3.symbol(SYM[SHAPE[net]],Math.PI*r*r*AREA[SHAPE[net]])();
  const mk=(net,hollow)=>`<svg class="mk c-${net}${hollow?" hollow":""}" viewBox="-7 -7 14 14" aria-hidden="true"><path d="${symD(net,4.6)}"/></svg>`;
  const netsEl=document.getElementById("nets");
  NETKEYS.forEach(k=>{const b=document.createElement("button");b.type="button";b.id="net-"+k;b.className="net-chip";b.setAttribute("aria-pressed","true");
    b.title=NETS[k].full; b.innerHTML=`${mk(k)}${esc(NETS[k].name)} <small>${S.filter(s=>s.net===k).length}</small>`;
    b.onclick=()=>{ if(state.nets.has(k)){ if(state.nets.size>1) state.nets.delete(k);} else state.nets.add(k);
      netsEl.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",state.nets.has(x.id.slice(4))));applyFilters();};
    netsEl.appendChild(b);});

  /* ---------- map ---------- */
  const svg = d3.select("#map");
  const box = document.getElementById("mapbox");
  const proj = d3.geoAzimuthalEqualArea().rotate([-16,-2]);
  const path = d3.geoPath(proj);
  const extent = {type:"Feature",geometry:{type:"MultiPoint",coordinates:[[-26,-35.5],[58,-35.5],[-26,37.5],[58,37.5],[16,38],[16,-36]]}};
  const root = svg.append("g");
  const gBase = root.append("g");
  const defs = svg.append("defs");
  const hatchPat = defs.append("pattern").attr("id","hatch-safari").attr("patternUnits","userSpaceOnUse").attr("width",6).attr("height",6);
  hatchPat.append("line").attr("class","hatch-line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",6);
  const gHatch = root.append("g");
  const gLabels = root.append("g");
  const gRings = root.append("g");
  const gSt = root.append("g");

  function fit(){
    const w = box.clientWidth, h = svg.node().clientHeight;
    svg.attr("viewBox",`0 0 ${w} ${h}`);
    proj.fitExtent([[20,58],[w-20,h-20]], extent);
  }
  fit();

  const grat = gBase.append("path").attr("class","grat");
  const feats = GEO.features;
  const cPaths = gBase.selectAll("path.country").data(feats).join("path")
    .attr("class",d=>"country"+(d.properties.africa?"":" other"));
  const CAMP = new Set(NETS.safari2000?.countries||[]);
  const hatchSel = gHatch.selectAll("path").data(feats.filter(f=>CAMP.has(f.properties.name))).join("path").attr("class","hatch");
  const seaLabels = gBase.selectAll("text.sea-label").data([
    {t:"ATLANTIC OCEAN",c:[-14,-22]},{t:"INDIAN OCEAN",c:[64,-10]}]).join("text").attr("class","sea-label").attr("text-anchor","middle").text(d=>d.t);

  const RINGS = [
    {name:"Canary Islands",c:[-16.2,28.4],r:2.6},{name:"Cabo Verde",c:[-23.9,15.95],r:2.1},
    {name:"Ascension Island",c:[-14.38,-7.95],r:1.1},{name:"Saint Helena",c:[-5.7,-15.95],r:1.1},
    {name:"Réunion",c:[55.5,-21.1],r:1.1},{name:"Seychelles",c:[55.5,-4.6],r:1.1}];
  const ringSel = gRings.selectAll("g").data(RINGS).join("g");
  ringSel.append("circle").attr("class","ring");
  ringSel.append("text").attr("class","ring-label").attr("text-anchor","middle").text(d=>d.name);

  /* African countries: display names (matching the station data) ↔ map feature names */
  const AFRICA=[["Algeria"],["Angola"],["Benin"],["Botswana"],["Burkina Faso"],["Burundi"],["Cameroon"],["Cape Verde","Cabo Verde"],
   ["Central African Republic","Central African Rep."],["Chad"],["Comoros"],["Congo"],["DR Congo","Dem. Rep. Congo"],["Côte d'Ivoire"],["Djibouti"],
   ["Egypt"],["Equatorial Guinea","Eq. Guinea"],["Eritrea"],["Eswatini","eSwatini"],["Ethiopia"],["Gabon"],["Gambia"],["Ghana"],["Guinea"],
   ["Guinea-Bissau"],["Kenya"],["Lesotho"],["Liberia"],["Libya"],["Madagascar"],["Malawi"],["Mali"],["Mauritania"],["Mauritius"],["Morocco"],
   ["Mozambique"],["Namibia"],["Niger"],["Nigeria"],["Rwanda"],["São Tomé and Príncipe","São Tomé and Principe"],["Senegal"],["Seychelles"],
   ["Sierra Leone"],["Somalia"],["South Africa"],["South Sudan","S. Sudan"],["Sudan"],["Tanzania"],["Togo"],["Tunisia"],["Uganda"],["Zambia"],["Zimbabwe"]]
   .map(([n,g])=>({name:n,geo:g||n}));
  const TERR=[["Canary Islands","Canary Islands"],["La Réunion","Réunion"],["Saint Helena","Saint Helena"],["Ascension Island","Saint Helena"]].map(([n,g])=>({name:n,geo:g,terr:true}));
  const geoByName=new Map(feats.map(f=>[f.properties.name,f]));
  const LABEL_AT={Morocco:[-7.2,31],"Dem. Rep. Congo":[23.5,-2.5],Mozambique:[37.5,-14.5],Somalia:[45.5,5],Tanzania:[34.8,-6.2],Malawi:[34.2,-13.4],Gambia:[-15.4,13.6]};
  const SKIP_LABEL=new Set(["Seychelles","Mauritius","Comoros","São Tomé and Principe","Cabo Verde","Saint Helena","Canary Islands","Réunion","Mayotte"]);
  const labelData=AFRICA.filter(c=>!SKIP_LABEL.has(c.geo)&&geoByName.has(c.geo)).map(c=>{
    const f=geoByName.get(c.geo); let g=f.geometry;
    if(g.type==="MultiPolygon"){const big=g.coordinates.map(p=>({type:"Polygon",coordinates:p})).sort((a,b)=>d3.geoArea(b)-d3.geoArea(a))[0]; g=big;}
    return {name:c.name.replace("Central African Republic","Central African Rep."),geom:g,f,at:LABEL_AT[c.geo]};});
  const lblSel=gLabels.selectAll("text").data(labelData).join("text").attr("class","cty-label").attr("text-anchor","middle").attr("dy","0.35em").text(d=>d.name);
  function placeLabels(){
    lblSel.each(d=>{const p=d.at?proj(d.at):path.centroid(d.geom); d.x=p[0]; d.y=p[1]; d.area=path.area(d.f);});
    lblSel.attr("x",d=>d.x).attr("y",d=>d.y);
  }
  function sizeLabels(){
    const k=T.k;
    lblSel.attr("font-size",10.5/k).attr("stroke-width",3/k)
      .attr("display",d=>k>=1.7 && d.area*k*k > (d.name.length*6.2)**2*0.9 ? null : "none");
  }

  /* co-located stations: fan out in screen pixels so each stays clickable */
  const groups = d3.groups(S, s=>`${Math.round(s.lat*30)},${Math.round(s.lon*30)}`);
  groups.forEach(([,g])=>g.forEach((s,i)=>{
    if(g.length===1){s.dx=0;s.dy=0;return;}
    const a = (i/g.length)*2*Math.PI - Math.PI/2; s.dx=Math.cos(a)*8; s.dy=Math.sin(a)*8;
  }));
  const stSel = gSt.selectAll("g.st").data(S,d=>d.uid).join("g")
    .attr("class",d=>`st c-${d.net} `+(d.status==="Inactive"?"off":"on"))
    .attr("tabindex",0).attr("role","button")
    .attr("aria-label",d=>`${NETS[d.net].name} ${pretty(d.id)}, ${d.city}, ${d.country}, ${d.status}`)
    .on("click",(e,d)=>{e.stopPropagation(); openCard(d);})
    .on("keydown",(e,d)=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault(); openCard(d);} });
  const symPath=(d,r)=>symD(d.net,r);
  document.getElementById("legend").innerHTML=`<span class="t">Legend</span>${NETKEYS.map(k=>`<div>${mk(k)}${esc(NETS[k].name)}</div>`).join("")}<div><span class="hatchkey"></span>SAFARI 2000 host country</div><div>${mk("aeronet",true).replace("c-aeronet","").replace("<svg","<svg style=\"--c:var(--muted)\"")}Inactive station (hollow)</div><div><span class="ringkey"></span>Island group</div>`;
  const R0=d=>d.status==="Inactive"?4.1:5.5;
  stSel.append("path").attr("class","halo").attr("d",d=>symPath(d,R0(d)*2.3));
  stSel.append("path").attr("class","m").attr("d",d=>symPath(d,R0(d)));
  stSel.append("title").text(d=>`${NETS[d.net].name} · ${pretty(d.id)} — ${d.city}`);

  let T = d3.zoomIdentity;
  function render(){
    const k = T.k;
    gBase.selectAll("path.country").attr("d",path);
    hatchSel.attr("d",path);
    hatchPat.attr("patternTransform",`rotate(45) scale(${1/T.k})`);
    grat.attr("d",path(d3.geoGraticule().step([10,10])()));
    seaLabels.attr("transform",d=>{const p=proj(d.c);return `translate(${p})`;}).attr("font-size",15/k);
    ringSel.select("circle").each(function(d){
      const p=proj(d.c), q=proj([d.c[0]+d.r,d.c[1]]);
      d3.select(this).attr("cx",p[0]).attr("cy",p[1]).attr("r",Math.max(Math.abs(q[0]-p[0]), 14/k));
      d._p=p; d._r=Math.max(Math.abs(q[0]-p[0]),14/k);
    });
    ringSel.select("text").attr("x",d=>d._p[0]).attr("y",d=>d._p[1]-d._r-5/k).attr("font-size",12/k)
      .attr("stroke-width",3/k);
    stSel.each(d=>{const p=proj([d.lon,d.lat]);d._x=p[0];d._y=p[1];});
    stSel.attr("transform",d=>`translate(${d._x+d.dx/k},${d._y+d.dy/k}) scale(${1/Math.pow(k,.92)})`);
    placeLabels(); sizeLabels();
    root.attr("transform",T);
    placeCard();
  }
  const zoom = d3.zoom().scaleExtent([1,60]).on("zoom",e=>{T=e.transform; root.attr("transform",T); rescale();});
  function rescale(){
    const k=T.k;
    hatchPat.attr("patternTransform",`rotate(45) scale(${1/k})`);
    sizeLabels();
    seaLabels.attr("font-size",15/k);
    ringSel.select("circle").attr("r",d=>{const p=proj(d.c),q=proj([d.c[0]+d.r,d.c[1]]);d._r=Math.max(Math.abs(q[0]-p[0]),14/k);return d._r;});
    ringSel.select("text").attr("y",d=>d._p[1]-d._r-5/k).attr("font-size",12/k).attr("stroke-width",3/k);
    stSel.attr("transform",d=>`translate(${d._x+d.dx/k},${d._y+d.dy/k}) scale(${1/Math.pow(k,.92)})`);
    placeCard();
  }
  svg.call(zoom).on("dblclick.zoom",null);
  svg.on("click",()=>closeCard());

  function zoomToBounds(lon0,lat0,lon1,lat1){
    const pts=[[lon0,lat0],[lon1,lat0],[lon0,lat1],[lon1,lat1]].map(p=>proj(p));
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const w=box.clientWidth,h=svg.node().clientHeight;
    const x0=d3.min(xs),x1=d3.max(xs),y0=d3.min(ys),y1=d3.max(ys);
    const k=Math.min(60,0.85/Math.max((x1-x0)/w,(y1-y0)/h));
    svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity.translate(w/2,h/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2));
  }
  document.getElementById("zin").onclick=()=>svg.transition().call(zoom.scaleBy,1.8);
  document.getElementById("zout").onclick=()=>svg.transition().call(zoom.scaleBy,1/1.8);
  document.getElementById("zreset").onclick=()=>svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity);

  /* ---------- popup card ---------- */
  const card=document.createElement("div");
  card.className="card"; card.hidden=true; card.setAttribute("role","button"); card.tabIndex=0;
  box.appendChild(card);
  function openCard(d){
    state.sel=d; markSelected();
    const N=NETS[d.net]; card.className="card c-"+d.net;
    card.innerHTML=`<span class="tip"></span>
      <div class="head"><div><div class="net">${mk(d.net)}${esc(N.name)}</div><div class="full">(${esc(N.full)})</div></div>
        <button type="button" class="x" aria-label="Close">×</button></div>
      <dl><dt>Station</dt><dd class="${d.net==="aeronet"?"mono":""}">${esc(d.id)}</dd>
        <dt>City</dt><dd>${esc(d.city)}</dd>
        <dt>Country</dt><dd>${esc(d.country)}</dd>
        <dt>Period</dt><dd class="mono">${fmtPeriod(d)}</dd>
        <dt>Status</dt><dd><span class="pill ${d.status}">${d.status}</span></dd>${d.net==="safari2000"?"":""}</dl>
      <div class="go">View station details <span aria-hidden="true">↓</span></div>`;
    card.hidden=false;
    card.querySelector(".x").onclick=e=>{e.stopPropagation();closeCard();};
    placeCard();
  }
  card.onclick=()=>{ if(state.sel) showDetail(state.sel,true); };
  card.onkeydown=e=>{ if(e.key==="Enter"){ showDetail(state.sel,true);} if(e.key==="Escape") closeCard(); };
  function closeCard(){card.hidden=true;}
  function placeCard(){
    if(card.hidden||!state.sel) return;
    const d=state.sel, [x,y]=T.apply([d._x+d.dx/T.k,d._y+d.dy/T.k]);
    const W=box.clientWidth,H=box.clientHeight,cw=card.offsetWidth,ch=card.offsetHeight;
    let left=x+18, top=y-ch/2, side="left";
    if(left+cw>W-10){left=x-18-cw; side="right";}
    left=Math.max(10,Math.min(left,W-cw-10)); top=Math.max(10,Math.min(top,H-ch-10));
    card.style.left=left+"px"; card.style.top=top+"px";
    const tip=card.querySelector(".tip"); const ty=Math.max(14,Math.min(y-top-7,ch-28));
    tip.style.top=ty+"px";
    if(side==="left"){tip.style.left="-8px";tip.style.right="";tip.style.borderWidth="0 0 1px 1px";}
    else {tip.style.right="-8px";tip.style.left="";tip.style.borderWidth="1px 1px 0 0";}
    tip.style.borderStyle="solid";
    card.style.visibility=(x<-20||y<-20||x>W+20||y>H+20)?"hidden":"visible";
  }

  /* ---------- detail section ---------- */
  const det=document.getElementById("station-details");
  function timeline(d){
    const y0=1995,y1=NOW, pct=y=>((y-y0)/(y1-y0)*100);
    const st=d.t0??d.start, end=d.t1??(d.end??NOW);
    const ticks=[1995,2000,2005,2010,2015,2020,2025];
    return `<div class="timeline"><h3>Period of activity</h3>
      <div class="tl" role="img" aria-label="Data period ${esc(fmtPeriod(d))}">
        <div class="axis"></div>
        <div class="span ${d.end?"":"open"}" style="left:${pct(st)}%;width:${Math.max(1.2,pct(end)-pct(st))}%"></div>
        ${ticks.map(t=>`<span class="tick" style="left:${pct(t)}%">${t}</span>`).join("")}
      </div></div>`;
  }
  const host=u=>{let s=u.replace(/^https?:\/\//,"").replace(/\?.*$/,"").replace(/#.*$/,"");try{s=decodeURI(s)}catch(e){}return esc(s);};
  const doiText=u=>u.replace(/^https?:\/\/(dx\.)?doi\.org\//,"doi:");
  const pubList=(label,arr)=>arr.length===1&&!/doi\.org/.test(arr[0])
    ? `<a href="${arr[0]}" target="_blank" rel="noopener">${label} <span>${host(arr[0])}</span></a>`
    : `<details class="pubs"><summary>${label} (${arr.length})</summary><ul>${arr.map(u=>`<li><a href="${u}" target="_blank" rel="noopener">${esc(doiText(u))}</a></li>`).join("")}</ul></details>`;
  const dataUrl=(N,s)=>(s&&s.db)||N.database||N.website;
  const linksHTML=(N,s)=>`<div class="links">
    <a href="${N.website}" target="_blank" rel="noopener">${N.kind==="campaign"?"Campaign":"Network"} website <span>${host(N.website)}</span></a>
    ${s&&s.db?`<a href="${s.db}" target="_blank" rel="noopener">Station data page <span>${host(s.db)}</span></a>`:N.database?`<a href="${N.database}" target="_blank" rel="noopener">Data catalogue <span>${host(N.database)}</span></a>`:""}
    ${N.datasets&&N.datasets.length?pubList("Dataset DOIs",N.datasets):""}
    ${N.publications&&N.publications.length?pubList("Publications",N.publications):""}</div>`;

  function showDetail(d,scroll){
    state.sel=d; markSelected();
    const N=NETS[d.net];
    const sibs=S.filter(s=>s.country===d.country&&s!==d).sort((a,b)=>a.net.localeCompare(b.net)||a.id.localeCompare(b.id));
    const note=d.approx==="site"?"Approximate position; exact coordinates to be verified.":d.approx==="city"?"Position shown at city level; exact site coordinates to be added.":d.approx?"Longitude approximate, pending verification.":"";
    det.className="detail c-"+d.net;
    det.innerHTML=`<div class="top">
        <div><div class="eyebrow">${esc(N.name)} · ${esc(d.kind)} · ${esc(d.country)}</div>
          <h2>${esc(pretty(d.id))}</h2>
          <div class="sub">${esc(d.city)}, ${esc(d.country)} &nbsp; <span class="pill ${d.status}">${d.status}</span></div></div>
        <div class="act"><button type="button" class="btn" id="b-map">Show on map ↑</button>
          <a class="btn primary" href="${dataUrl(N,d)}" target="_blank" rel="noopener">Get data ↗</a></div>
      </div>
      <div class="grid2">
        <section>
          <h3>Station record</h3>
          <dl class="facts">
            <div><dt>Network / programme</dt><dd>${esc(N.name)} (${esc(N.full)})</dd></div>
            <div><dt>Type</dt><dd>${esc(N.type)}</dd></div>
            <div><dt>Station</dt><dd class="${d.net==="aeronet"?"mono":""}">${esc(d.id)}</dd></div>
            <div><dt>Site type</dt><dd>${esc(d.kind)}</dd></div>
            <div><dt>City / location</dt><dd>${esc(d.city)}</dd></div>
            <div><dt>Country / territory</dt><dd>${esc(d.country)}</dd></div>
            <div><dt>Coordinates</dt><dd class="mono">${(d.approx==="city"||d.approx==="site")?"≈ ":""}${fmtCoord(d)}</dd>${note?`<div class="note">${note}</div>`:""}</div>
            <div><dt>Data period</dt><dd class="mono">${fmtPeriod(d)}</dd></div>
            ${d.avail?`<div><dt>Data publicly available</dt><dd>${esc(d.avail)}</dd></div>`:""}
            <div><dt>Current status</dt><dd>${d.status==="Completed"?"Campaign completed":d.status}</dd></div>
          </dl>
          ${timeline(d)}
        </section>
        <section class="about">
          <h3>About ${esc(N.name)}</h3>
          <p>${esc(N.intro)}</p>
          <h3>Data access</h3>
          ${linksHTML(N,d)}
          ${sibs.length?`<h3 style="margin-top:20px">Other stations in ${esc(d.country)}</h3>
            <div class="siblings">${sibs.map(s=>`<button type="button" data-uid="${s.uid}">${mk(s.net,s.status==="Inactive")}${esc(NETS[s.net].name)} · ${esc(pretty(s.id))}</button>`).join("")}</div>`:""}
        </section>
      </div>`;
    det.querySelector("#b-map").onclick=()=>{document.getElementById("mapbox").scrollIntoView({behavior:"smooth",block:"center"}); openCard(d);};
    det.querySelectorAll(".siblings button").forEach(b=>b.onclick=()=>{const s=S[+b.dataset.uid]; showDetail(s,false); openCard(s);});
    if(scroll){det.scrollIntoView({behavior:"smooth",block:"start"}); det.focus({preventScroll:true});}
  }
  function showOverview(){
    det.className="detail";
    const cnt=c=>{const v=S.filter(s=>s.country===c);return {per:NETKEYS.map(k=>[k,v.filter(s=>s.net===k).length]),n:v.length};};
    const all=[...AFRICA,...TERR];
    const byC=all.map(c=>[c.name,cnt(c.name),c]).sort((a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0]));
    const zeros=AFRICA.filter(c=>!cnt(c.name).n).length;
    const max=d3.max(byC,d=>d[1].n);
    det.innerHTML=`<div class="top"><div><div class="eyebrow">Overview</div>
        <h2>Networks &amp; campaigns on this map</h2>
        <div class="sub">Select a station on the map or in the index to open its full record here.</div></div></div>
      <div class="grid2">
        <section><div class="netcards">${NETKEYS.map(k=>{const N=NETS[k],v=S.filter(s=>s.net===k);
          return `<div class="netcard c-${k}"><h3>${mk(k)}${esc(N.name)} <span class="eyebrow" style="margin-left:auto">${v.length} ${N.kind==="campaign"?"sites · "+esc(v[0]?.periodLabel||""):"stations · "+v.filter(s=>s.status==="Active").length+" active"}</span></h3>
            <div class="full">${esc(N.full)} · ${esc(N.type)}</div><p>${esc(N.intro)}</p>${linksHTML(N)}</div>`;}).join("")}</div></section>
        <section>
          <div class="overview-stats"><div><b>${S.length}</b><span>stations</span></div><div><b>${nActive}</b><span>active today</span></div><div><b>${firstYear}</b><span>earliest record</span></div></div>
          <h3>Stations by country / territory</h3>
          <p class="note" style="margin:-6px 0 12px">${AFRICA.length-zeros} of ${AFRICA.length} African countries host at least one station; ${zeros} have none yet. Select a country to see it on the map.</p>
          <div class="bars">${byC.map(([c,v,o])=>`<button type="button" class="${v.n?"":"zero"}" data-c="${esc(c)}" data-geo="${esc(o.geo)}" title="Show ${esc(c)} on the map"><span>${esc(c)}${o.terr?" *":""}</span>
            <span class="trk">${v.per.filter(p=>p[1]).map(([k,n])=>`<span class="seg-n c-${k}" style="width:${n/max*100}%"></span>`).join("")}</span><span class="n">${v.n}</span></button>`).join("")}</div>
          <div class="note" style="margin-top:6px">* Island territory</div>
          <div class="note" style="margin-top:10px;display:flex;gap:6px 14px;flex-wrap:wrap">${NETKEYS.map(k=>`<span style="display:inline-flex;gap:6px;align-items:center">${mk(k)}${esc(NETS[k].name)}</span>`).join("")}</div>
        </section></div>`;
    det.querySelectorAll(".bars button").forEach(b=>b.onclick=()=>{
      const has=[...sel.options].some(o=>o.value===b.dataset.c);
      sel.value=has?b.dataset.c:""; state.country=sel.value; applyFilters();
      const f=geoByName.get(b.dataset.geo);
      const v=S.filter(s=>s.country===b.dataset.c);
      if(v.length){const pad=1.5;zoomToBounds(d3.min(v,s=>s.lon)-pad,d3.min(v,s=>s.lat)-pad,d3.max(v,s=>s.lon)+pad,d3.max(v,s=>s.lat)+pad);}
      else if(f){const [[a,c],[e,g]]=d3.geoBounds(f);zoomToBounds(a-1,c-1,e+1,g+1);}
      document.getElementById("mapbox").scrollIntoView({behavior:"smooth",block:"center"});});
  }

  /* ---------- table ---------- */
  const tbody=document.getElementById("rows");
  function renderTable(){
    const {k,dir}=state.sort;
    const rows=S.filter(visible).sort((a,b)=>{const x=a[k],y=b[k];return (typeof x==="number"?x-y:String(x).localeCompare(String(y)))*dir||a.id.localeCompare(b.id);});
    tbody.innerHTML=rows.map(s=>`<tr data-uid="${s.uid}" class="${state.sel===s?"sel":""}" tabindex="0">
      <td class="${s.net==="aeronet"?"mono":""}">${esc(s.id)}</td><td><span style="display:inline-flex;gap:6px;align-items:center">${mk(s.net,s.status==="Inactive")}${esc(NETS[s.net].name)}</span></td><td>${esc(s.city)}</td><td>${esc(s.country)}</td>
      <td><span class="pill ${s.status}">${s.status}</span></td><td class="mono">${fmtPeriod(s)}</td>
      <td class="mono">${(s.approx==="city"||s.approx==="site")?"≈ ":""}${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</td></tr>`).join("");
    document.getElementById("index-count").textContent=`${rows.length} of ${S.length} stations`;
    document.querySelectorAll("th").forEach(th=>th.setAttribute("aria-sort",th.dataset.k===k?(dir>0?"ascending":"descending"):"none"));
  }
  tbody.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr)return;const s=S[+tr.dataset.uid];showDetail(s,true);openCard(s);});
  tbody.addEventListener("keydown",e=>{if(e.key==="Enter"){const tr=e.target.closest("tr");if(tr){const s=S[+tr.dataset.uid];showDetail(s,true);openCard(s);}}});
  document.querySelectorAll("th").forEach(th=>th.onclick=()=>{const k=th.dataset.k;state.sort={k,dir:state.sort.k===k?-state.sort.dir:1};renderTable();});

  function markSelected(){
    stSel.classed("sel",d=>d===state.sel);
    tbody.querySelectorAll("tr").forEach(tr=>tr.classList.toggle("sel",S[+tr.dataset.uid]===state.sel));
  }

  /* ---------- filters ---------- */
  function applyFilters(){
    stSel.attr("display",d=>visible(d)?null:"none");
    gHatch.attr("display",state.nets.has("safari2000")?null:"none");
    const n=S.filter(visible).length;
    document.getElementById("count").textContent=`${n} station${n===1?"":"s"} shown`;
    if(state.sel&&!visible(state.sel)) closeCard();
    renderTable();
  }
  document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{
    state.status=b.dataset.s; document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));applyFilters();});
  sel.onchange=()=>{state.country=sel.value;applyFilters();
    const v=S.filter(s=>s.country===state.country);
    if(v.length){const pad=1.5;zoomToBounds(d3.min(v,s=>s.lon)-pad,d3.min(v,s=>s.lat)-pad,d3.max(v,s=>s.lon)+pad,d3.max(v,s=>s.lat)+pad);}
    else svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity);};
  document.getElementById("q").oninput=e=>{state.q=e.target.value.trim().toLowerCase();applyFilters();};

  render();
  window.addEventListener("resize",()=>{fit(); render();});
  showOverview();
  applyFilters();

  if (MAP_CONFIG.openSampleCardOnLoad) {
    const s0 = S.find(s => s.id === MAP_CONFIG.openSampleCardOnLoad);
    if (s0) openCard(s0);
  }
})();
