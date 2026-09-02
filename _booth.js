/* C5Z booth check-in. Staff-facing, German only — the booth is German-speaking.
   Addresses are hashed before anything else happens; none are in this page. */
(function(){
"use strict";
var TENTS=DATA.tents, BOOK=DATA.book, SALT=DATA.salt, TYPES=DATA.types;
var ASSIGN={}, hit=null, hitHash=null;

function el(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function say(t,cls){var m=el("msg"); m.textContent=t; m.className="msg"+(cls?" "+cls:"");}

/* --- the staff pin: kept on the device, checked on the server -------------- */
function pin(){ try{ return localStorage.getItem("nw-pin")||""; }catch(e){ return ""; } }
function askPin(why){
  var v=window.prompt(why||"Booth-PIN eingeben:", pin());
  if(v===null) return null;
  try{ localStorage.setItem("nw-pin", v.trim()); }catch(e){}
  showPin(); return v.trim();
}
function showPin(){ el("pinState").textContent = pin() ? "PIN gesetzt" : "kein PIN"; }
el("pinBtn").addEventListener("click",function(){ askPin("Booth-PIN:"); });

/* --- the board ------------------------------------------------------------ */
function load(){
  return fetch("api/assign",{headers:{Accept:"application/json"}})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(j){ ASSIGN = (j && j.assign) || {}; })
    .catch(function(){ ASSIGN={}; });
}
function post(body){
  body.pin = pin();
  return fetch("api/assign",{method:"POST",headers:{"Content-Type":"application/json"},
                             body:JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(j){
      if(!r.ok){ var e=new Error(j.error||r.status); e.code=r.status; e.body=j; throw e; }
      return j; }); });
}
function freeOf(kind){
  return TENTS.filter(function(t){ return t.t===kind && !t.r && !ASSIGN[t.no]; });
}

/* --- lookup --------------------------------------------------------------- */
el("find").addEventListener("submit",function(ev){
  ev.preventDefault();
  var mail=String(el("email").value).trim().toLowerCase();
  el("out").innerHTML=""; hit=null; hitHash=null;
  el("find").classList.remove("invalid");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){
    el("find").classList.add("invalid"); return say("Keine gültige E-Mail-Adresse.","bad");
  }
  var h=sha256(SALT+mail), b=BOOK[h];
  if(!b){
    el("find").classList.add("invalid");
    return say("Keine C5Z-Buchung zu dieser Adresse.","bad");
  }
  hit=b; hitHash=h; say("");
  load().then(render);
});

/* --- the guest card ------------------------------------------------------- */
function render(){
  if(!hit) return;
  var mine=Object.keys(ASSIGN).filter(function(n){ return ASSIGN[n].h===hitHash; });
  if(mine.length) return done(mine[0]);

  var free=freeOf(hit.t);
  var nums=free.map(function(t){
    return '<li><button type="button" class="num" data-no="'+esc(t.no)+'">'+esc(t.no)+'</button></li>';
  }).join("");
  var addons = hit.a.length
    ? '<ul class="addons">'+hit.a.map(function(a){
        return '<li><span class="qty">'+a[1]+'×</span>'+esc(a[0])+'</li>'; }).join("")+'</ul>'
    : '<p class="none">Keine Add-ons gebucht.</p>';

  el("out").innerHTML =
    '<article class="card">'+
      '<div class="guest-hd"><span class="kind k-'+esc(hit.t)+'"><i></i>'+esc(hit.t)+'</span>'+
        (hit.o?'<span class="order">Bestellung '+esc(hit.o)+'</span>':'')+'</div>'+
      '<div class="sect"><h3>Add-ons</h3>'+addons+'</div>'+
      '<div class="sect"><h3>Zeltnummer vergeben — '+esc(hit.t)+', '+free.length+' frei</h3>'+
        (free.length?'<ul class="nums">'+nums+'</ul>'
                    :'<p class="none">Keine freien '+esc(hit.t)+'-Zelte mehr.</p>')+
      '</div></article>';

  [].forEach.call(el("out").querySelectorAll(".num"),function(b){
    b.addEventListener("click",function(){ assign(b.getAttribute("data-no"), b); });
  });
  board();
}

function assign(no, btn){
  if(!pin() && askPin("Booth-PIN eingeben, um Zelte zu vergeben:")===null) return;
  btn.disabled=true; say("Wird vergeben …");
  post({tent:no, hash:hitHash, by:""})
    .then(function(){ ASSIGN[no]={h:hitHash,at:Date.now()}; say(""); done(no); })
    .catch(function(e){
      btn.disabled=false;
      if(e.code===401) { say("PIN falsch.","bad"); askPin("Booth-PIN:"); }
      else if(e.code===409){ say("Zelt "+no+" ist schon vergeben.","bad"); load().then(render); }
      else if(e.code===503){ say(e.body&&e.body.hint||"Kein Speicher konfiguriert.","bad"); }
      else say("Hat nicht geklappt: "+e.message,"bad");
    });
}

function done(no){
  el("out").innerHTML =
    '<article class="card"><div class="done">'+
      '<p class="big">'+esc(no)+'</p>'+
      '<p>'+esc(hit.t)+' · Zelt vergeben</p>'+
      '<button type="button" class="primary" id="next">Nächster Gast</button>'+
      '<button type="button" class="release" id="rel">Vergabe zurücknehmen</button>'+
    '</div></article>';
  el("next").addEventListener("click",function(){
    hit=null; hitHash=null; el("out").innerHTML=""; el("email").value=""; say(""); el("email").focus();
  });
  el("rel").addEventListener("click",function(){
    if(!window.confirm("Zelt "+no+" wieder freigeben?")) return;
    post({tent:no, release:true})
      .then(function(){ delete ASSIGN[no]; say("Zelt "+no+" ist wieder frei.","good"); render(); })
      .catch(function(e){
        if(e.code===401){ say("PIN falsch.","bad"); askPin("Booth-PIN:"); }
        else say("Hat nicht geklappt: "+e.message,"bad");
      });
  });
  board();
}

/* --- occupancy board ------------------------------------------------------ */
function board(){
  var total=0, taken=0, body="";
  TYPES.forEach(function(kind){
    var all=TENTS.filter(function(t){ return t.t===kind; });
    var chips=all.map(function(t){
      var cls="num", label=t.no;
      if(t.r){ cls+=" held"; label=t.no+" "+t.r; }
      else if(ASSIGN[t.no]){ cls+=(ASSIGN[t.no].h===hitHash?" mine":" taken"); }
      if(!t.r){ total++; if(ASSIGN[t.no]) taken++; }
      return '<li><span class="'+cls+'" style="display:block">'+esc(label)+'</span></li>';
    }).join("");
    body+='<div class="grp"><h4 class="k-'+kind+'"><i></i>'+kind+'</h4><ul class="nums">'+chips+'</ul></div>';
  });
  el("boardBody").innerHTML=body;
  el("boardSum").textContent=taken+" von "+total+" vergeben";
}
el("boardBtn").addEventListener("click",function(){
  var b=el("board");
  b.hidden=!b.hidden;
  if(!b.hidden){ load().then(function(){ board(); b.scrollIntoView({behavior:"smooth",block:"start"}); }); }
});

showPin();
load().then(board);
})();
