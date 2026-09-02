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

/* --- the staff pin: kept on the device, checked on the server --------------
   A field rather than window.prompt, which phone browsers like to suppress. */
var pending=null;                       // what to do once the pin is entered
function pin(){ try{ return localStorage.getItem("nw-pin")||""; }catch(e){ return ""; } }
function showPin(){ el("pinState").textContent = pin() ? "PIN gesetzt" : "kein PIN"; }
function askPin(why, then){
  pending = then || null;
  el("pinMsg").textContent = why || "";
  el("pinMsg").className = "msg" + (why ? " bad" : "");
  el("pincard").hidden = false;
  el("pinInput").value = pin();
  el("pincard").scrollIntoView({behavior:"smooth", block:"center"});
  el("pinInput").focus();
}
el("pincard").addEventListener("submit",function(ev){
  ev.preventDefault();
  var v=String(el("pinInput").value).trim();
  if(!v){ el("pinMsg").textContent="Bitte den PIN eingeben."; el("pinMsg").className="msg bad"; return; }
  try{ localStorage.setItem("nw-pin", v); }catch(e){}
  showPin();
  el("pincard").hidden = true;
  el("pinMsg").textContent = "";
  var go=pending; pending=null;
  if(go) go();
});
el("pinBtn").addEventListener("click",function(){ askPin("", null); });

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
function poolOf(no){
  for(var i=0;i<TENTS.length;i++) if(TENTS[i].no===no) return TENTS[i].t;
  return null;
}
function minePerPool(){
  var out={};
  Object.keys(ASSIGN).forEach(function(no){
    if(ASSIGN[no].h!==hitHash) return;
    var p=poolOf(no)||"?";
    (out[p]=out[p]||[]).push(no);
  });
  Object.keys(out).forEach(function(p){ out[p].sort(function(a,b){return a-b;}); });
  return out;
}
function render(){
  if(!hit) return;
  var mine=minePerPool(), L=hit.t, done=0, want=0, blocks="";

  TYPES.forEach(function(pool){
    var booked=L[pool]||0;
    if(!booked) return;
    var got=mine[pool]||[];
    want+=booked; done+=Math.min(got.length,booked);
    var chips=got.map(function(no){
      return '<button type="button" class="num mine" data-rel="'+esc(no)+'" '+
             'title="Antippen zum Freigeben">'+esc(no)+'</button>';
    }).join("");
    var open=booked-got.length;
    var free=freeOf(pool);
    var picker="";
    if(open>0){
      picker = free.length
        ? '<p class="pick">Noch '+open+' zu vergeben — '+free.length+' frei:</p><ul class="nums">'+
          free.map(function(t){ return '<li><button type="button" class="num" data-no="'+
            esc(t.no)+'">'+esc(t.no)+'</button></li>'; }).join("")+'</ul>'
        : '<p class="none warn">Keine freien '+esc(pool)+'-Zelte mehr.</p>';
    }
    blocks += '<div class="sect"><h3><span class="kind k-'+esc(pool)+'"><i></i>'+esc(pool)+
      '</span> · '+booked+(booked>1?' Zelte':' Zelt')+'</h3>'+
      (chips?'<div class="given">'+chips+'</div>':'')+picker+'</div>';
  });

  var addons = hit.a.length
    ? '<ul class="addons">'+hit.a.map(function(a){
        return '<li><span class="qty">'+a[1]+'×</span>'+esc(a[0])+'</li>'; }).join("")+'</ul>'
    : '<p class="none">Keine Add-ons gebucht.</p>';

  el("out").innerHTML =
    '<article class="card">'+
      '<div class="guest-hd"><span class="tally'+(done===want?' all':'')+'">'+done+' von '+want+
        (want>1?' Zelten':' Zelt')+' vergeben</span>'+
        (hit.o?'<span class="order">Bestellung '+esc(hit.o)+'</span>':'')+'</div>'+
      '<div class="sect"><h3>Add-ons</h3>'+addons+'</div>'+
      blocks+
      '<div class="sect"><button type="button" class="primary" id="next">Nächster Gast</button></div>'+
    '</article>';

  [].forEach.call(el("out").querySelectorAll(".num[data-no]"),function(b){
    b.addEventListener("click",function(){ assign(b.getAttribute("data-no"), b); });
  });
  [].forEach.call(el("out").querySelectorAll(".num[data-rel]"),function(b){
    b.addEventListener("click",function(){ release(b.getAttribute("data-rel"), b); });
  });
  el("next").addEventListener("click",function(){
    hit=null; hitHash=null; el("out").innerHTML=""; el("email").value=""; say(""); el("email").focus();
  });
  board();
}

function assign(no, btn){
  if(!pin()) return askPin("PIN eingeben, dann wird Zelt "+no+" vergeben.",
                           function(){ assign(no, btn); });
  btn.disabled=true; say("Wird vergeben …");
  post({tent:no, hash:hitHash, by:""})
    .then(function(){ ASSIGN[no]={h:hitHash,at:Date.now()}; say("Zelt "+no+" vergeben.","good"); render(); })
    .catch(function(e){
      btn.disabled=false;
      if(e.code===401) { say(""); askPin("PIN falsch — nochmal versuchen.", function(){ assign(no, btn); }); }
      else if(e.code===409){ say("Zelt "+no+" ist schon vergeben.","bad"); load().then(render); }
      else if(e.code===503){ say(e.body&&e.body.hint||"Kein Speicher konfiguriert.","bad"); }
      else say("Hat nicht geklappt: "+e.message,"bad");
    });
}

var arming=null;
function release(no, btn){
  if(arming!==no){
    arming=no; btn.classList.add("arm"); btn.textContent=no+" freigeben?";
    setTimeout(function(){ if(arming===no){ arming=null; render(); } }, 4000);
    return;
  }
  arming=null;
  if(!pin()) return askPin("PIN eingeben, dann wird Zelt "+no+" freigegeben.",
                           function(){ arming=no; release(no, btn); });
  post({tent:no, release:true})
    .then(function(){ delete ASSIGN[no]; say("Zelt "+no+" ist wieder frei.","good"); render(); })
    .catch(function(e){
      if(e.code===401){ say(""); askPin("PIN falsch — nochmal versuchen.", null); }
      else say("Hat nicht geklappt: "+e.message,"bad");
    });
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
if(!pin()) el("pincard").hidden = false;      // first use on this device
load().then(board);
})();
