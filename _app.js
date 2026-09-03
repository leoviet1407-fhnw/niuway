/* Tent finder — the lookup runs entirely in the browser.
   The page carries no e-mail addresses, only salted SHA-256 hashes. */
(function(){
"use strict";
var AREAS=DATA.areas, BOOK=DATA.book, SALT=DATA.salt, MODEL=DATA.labels,
    ADMINS=DATA.admins||[], OVERVIEW=DATA.overview||{}, C5Z=DATA.c5z||{},
    SW={r:"r",L:"l",X:"x"};

/* --- All guest-facing copy, German and English ---------------------------
   T.de and T.en carry the same keys in the same order, so the two languages
   read side by side. This is the only German in the codebase. ------------- */
var T={
de:{                                             /* German — shown to guests */
  title:"Zeltfinder", h1:"Zeltfinder",
  intro:"Trag die E-Mail-Adresse aus deiner Buchung ein — du bekommst deine Zeltnummer und dein Camping.",
  label:"E-Mail-Adresse aus der Buchung", ph:"name@beispiel.de", submit:"Zelt finden",
  invalid:"Das sieht nicht nach einer E-Mail-Adresse aus.",
  none:"Zu dieser Adresse ist kein Zelt gebucht. Bitte genau die Adresse aus der Buchungsbestätigung eingeben.",
  wait:"Zu viele Fehlversuche. Bitte 30 Sekunden warten oder am niuway-Booth auf Camping C5Z melden.",
  found:function(n){return n===1?"1 Zelt gefunden.":n+" Zelte gefunden.";},
  idx:function(n,t){return "Zelt "+n+" von "+t;},
  tent:"Zelt", sub:"Dieselbe Nummer steht auf dem Schild am Zelt.",
  pickup:"Pickup-Zelt", pickupSub:"In diesem Zelt lagern das Material und die Zelte.",
  allH:"Alle Zelte auf einen Blick", free:"frei",
  allSum:function(t,b){return t+" Zelte · "+b+" belegt · "+(t-b)+" frei";},
  allNote:"Ohne Adressen — die stehen nicht in dieser Seite.",
  lostH:"Fragen oder Hilfe nötig?", lostB:"Schreib Alex per WhatsApp.",
  hours:"Erreichbar %h",
  addon:"Comfort-Add-on gebucht? Es liegt schon fertig für dich im Zelt.",
  camping:"Camping",
  c5zTitle:"Camping C5Z", c5zBooked:"Gebucht",
  c5zNo:"Deine Zeltnummer bekommst du am niuway-Booth auf C5Z.",
  c5zPickOnly:"Du holst alles am niuway-Booth auf C5Z ab — es gibt keine feste Zeltnummer.",
  c5zGot:function(n){return n.length>1?"Deine Zelte: "+n.join(", "):"Dein Zelt: "+n[0];},
  pickH:"Am Booth abholen", pickNone:"Nichts abzuholen.",
  addonH:"Add-ons — liegen schon im Zelt",
  checkin:"Jetzt einchecken", checkedIn:"Eingecheckt", checkFail:"Hat nicht geklappt — nochmal versuchen.",
  checkout:"Auschecken", checkedOut:"Ausgecheckt — gute Heimreise!",
  remind:"Denk beim Abreisen daran, dich hier auszuchecken — dann wissen wir, dass dein Zelt frei ist.",
  coQ:"Wirklich auschecken? Danach wird dein Zelt abgebaut.",
  coYes:"Ja, auschecken", coNo:"Abbrechen",
  inCount:function(n,o){return n+" eingecheckt · "+o+" ausgecheckt";},
  tap:"Zum Vergrößern auf das Bild tippen.", close:"Schließen",
  route:"Route in Google Maps",
  unknown:"Diese Zeltnummer steht nicht im Lageplan. Bitte am niuway-Booth auf Camping C5Z melden.",
  again:"Andere Adresse prüfen", helpH:"Gut zu wissen",
  help:["Die Zeltnummer steht auf dem Schild am Zelt."],
  demo:"<b>Demo-Daten.</b> In <code>bookings.csv</code> stehen bisher nur Beispieladressen. Zum Ausprobieren: <code>%s</code>",
  foot:"Fragen oder Hilfe nötig? Schreib %name per WhatsApp: %wa · %hours<br>niuway · Diese Seite lädt nichts nach und speichert nichts."
},
en:{                                             /* English — same keys, same order */
  title:"Tent Finder", h1:"Tent finder",
  intro:"Enter the e-mail address you booked with — you'll get your tent number and your campsite.",
  label:"The e-mail address you booked with", ph:"name@example.com", submit:"Find my tent",
  invalid:"That doesn't look like an e-mail address.",
  none:"No tent is booked to this address. Please use the exact address from your booking confirmation.",
  wait:"Too many attempts. Please wait 30 seconds, or come to the niuway booth on campsite C5Z.",
  found:function(n){return n===1?"1 tent found.":n+" tents found.";},
  idx:function(n,t){return "Tent "+n+" of "+t;},
  tent:"Tent", sub:"The same number is on the label on the tent.",
  pickup:"Pickup tent", pickupSub:"This is the tent the materials and the tents are stored in.",
  allH:"Every tent at a glance", free:"free",
  allSum:function(t,b){return t+" tents · "+b+" booked · "+(t-b)+" free";},
  allNote:"No addresses — they are not in this page.",
  lostH:"Got a question or need help?", lostB:"Write to Alex on WhatsApp.",
  hours:"Available %h",
  addon:"Booked a comfort add-on? It is already set up for you inside the tent.",
  camping:"Campsite",
  c5zTitle:"Campsite C5Z", c5zBooked:"Booked",
  c5zNo:"You get your tent number at the niuway booth on C5Z.",
  c5zPickOnly:"You collect everything at the niuway booth on C5Z — there is no pitch number.",
  c5zGot:function(n){return n.length>1?"Your tents: "+n.join(", "):"Your tent: "+n[0];},
  pickH:"Collect at the booth", pickNone:"Nothing to collect.",
  addonH:"Add-ons — already set up in the tent",
  checkin:"Check in now", checkedIn:"Checked in", checkFail:"That didn't go through — try again.",
  checkout:"Check out", checkedOut:"Checked out — safe trip home!",
  remind:"Remember to check out here when you leave — that is how we know your tent is free.",
  coQ:"Check out for good? Your tent gets taken down after this.",
  coYes:"Yes, check out", coNo:"Cancel",
  inCount:function(n,o){return n+" checked in · "+o+" checked out";},
  tap:"Tap the picture to enlarge it.", close:"Close",
  route:"Directions in Google Maps",
  unknown:"This tent number is not on the site plan. Please come to the niuway booth on campsite C5Z.",
  again:"Check another address", helpH:"Good to know",
  help:["The tent number is on the label on the tent."],
  demo:"<b>Demo data.</b> <code>bookings.csv</code> still holds example addresses only. Try: <code>%s</code>",
  foot:"Got a question or need help? Write to %name on WhatsApp: %wa · %hours<br>niuway · This page loads nothing and stores nothing."
}};

var lang="de";
try{ var st=localStorage.getItem("nw-lang"); if(st==="de"||st==="en") lang=st;
     else if((navigator.language||"").slice(0,2).toLowerCase()!=="de") lang="en"; }
catch(e){ if((navigator.language||"").slice(0,2).toLowerCase()!=="de") lang="en"; }
function t(){return T[lang];}

/* --- helpers ----------------------------------------------------------- */
function esc(s){return String(s).replace(/[&<>"]/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function el(id){return document.getElementById(id);}
function find(key){                                   // key is "C9:301"
  var bits=String(key).split(":"), a=AREAS[bits[0]];
  if(!a) return null;
  for(var i=0;i<a.tents.length;i++) if(String(a.tents[i].no)===bits[1]) return {a:a,t:a.tents[i]};
  return null;
}

/* --- campsite photo ---------------------------------------------------- */
function photo(a,full){
  if(!a.plan) return "";
  return '<img class="shot'+(full?" full":"")+'" src="'+a.plan+'" width="'+a.w+'" height="'+a.h+
         '" alt="'+esc(a.name)+'" loading="lazy">';
}

/* --- result card ------------------------------------------------------- */
function card(entry,n,total){
  var key=entry[0], pickup=entry[1]==="pickup", hit=find(key), L=t();
  if(!hit) return '<article class="card"><p class="tent-no">'+esc(String(key).split(":")[1]||"?")+'</p>'+
                  '<p class="tent-sub">'+esc(L.unknown)+'</p></article>';
  var a=hit.a, x=hit.t, key=a.key+":"+x.no;
  return '<article class="card'+(pickup?" is-pickup":"")+'">'+
   (total>1 ? '<div class="res-hd"><span class="idx">'+esc(L.idx(n,total))+'</span></div>' : '')+
   '<p class="tent-eyebrow">'+esc(pickup?L.pickup:L.tent)+'</p>'+
   '<p class="tent-no">'+esc(x.no)+'</p>'+
   '<p class="tent-sub">'+esc(pickup?L.pickupSub:L.sub)+'</p>'+
   '<dl class="facts">'+
     '<div><dt>'+esc(L.camping)+'</dt><dd>'+esc(a.key)+'</dd></div>'+
   '</dl>'+
   (CHECK ? checkBlock(key, L) : '')+
   '<p class="addon">'+esc(L.addon)+'</p>'+
   (a.geo ? '<a class="route" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps?q='+
     a.geo[0]+','+a.geo[1]+'">'+esc(L.route)+'</a>' : '')+
   (a.plan ? '<figure class="map"><button type="button" class="planbtn" data-key="'+esc(key)+'" '+
     'aria-label="'+esc(L.tap)+'">'+photo(a,false)+'</button>'+
     '<figcaption>'+esc(a.name)+' · '+esc(L.tap)+'</figcaption></figure>' : '')+
   '</article>';
}

/* --- check-in ----------------------------------------------------------
   Needs the /api/checkin function (Vercel). Served as a plain static file
   there is nowhere to write to, so CHECK stays null and no check-in UI is
   rendered at all — the page still works, it just does less. -------------- */
var CHECK=null;
function loadCheck(){
  return fetch("api/checkin",{headers:{Accept:"application/json"}})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ CHECK = j && j.tents ? j.tents : null; })
    .catch(function(){ CHECK=null; });
}
function checkIn(key,how){                 // how: "in" | "out" | "undo"
  var body={tent:key};
  if(how==="out") body.out=true;
  if(how==="undo") body.undo=true;
  return fetch("api/checkin",{method:"POST",headers:{"Content-Type":"application/json"},
                              body:JSON.stringify(body)})
    .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(){
      if(!CHECK) CHECK={};
      if(how==="undo") delete CHECK[key];
      else if(how==="out") CHECK[key]={i:(CHECK[key]&&CHECK[key].i)||Date.now(), o:Date.now()};
      else CHECK[key]={i:Date.now()};
    });
}
function state(key){                       // "" | "in" | "out"
  var r=CHECK && CHECK[key];
  if(!r) return "";
  return r.o ? "out" : "in";
}

/* --- overview, for the addresses in ADMINS ------------------------------ */
function overview(){
  var L=t(), tot=0, bk=0, inn=0, out=0, body="";
  Object.keys(OVERVIEW).forEach(function(k){
    var a=OVERVIEW[k], n=a.tents.length, b=0;
    var chips=a.tents.map(function(x){
      if(x.pos) b++;
      var st=state(k+":"+x.no);
      if(st==="in") inn++; else if(st==="out") out++;
      return '<li class="chip'+(st?" is-"+st:"")+(x.pos?"":" is-free")+'">'+
             '<b>'+esc(x.no)+'</b><span>'+esc(x.pos && x.pos!=="-" ? x.pos : (x.pos?"":L.free))+'</span></li>';
    }).join("");
    tot+=n; bk+=b;
    body+='<div class="ov-site"><h3>'+esc(a.name)+' <span>'+n+'</span></h3><ul class="chips">'+chips+'</ul></div>';
  });
  return '<article class="card admin">'+
    '<div class="res-hd"><span class="ov-h">'+esc(L.allH)+'</span>'+
      '<span class="idx">'+esc(L.allSum(tot,bk))+(CHECK?" · "+esc(L.inCount(inn,out)):"")+'</span></div>'+
    '<div class="ov">'+body+'<p class="ov-note">'+esc(L.allNote)+'</p></div></article>';
}

function checkBlock(key, L){
  var st=state(key);
  if(st==="out") return '<p class="checked out">'+esc(L.checkedOut)+'</p>';
  if(st==="in"){
    if(leaving===key){
      return '<div class="leave"><p class="leave-q">'+esc(L.coQ)+'</p>'+
        '<div class="leave-btns"><button type="button" class="checkout" data-out="'+esc(key)+'">'+
        esc(L.coYes)+'</button>'+
        '<button type="button" class="leave-no" data-no="'+esc(key)+'">'+esc(L.coNo)+'</button></div></div>';
    }
    return '<p class="checked">'+esc(L.checkedIn)+'</p>'+
           '<p class="remind">'+esc(L.remind)+'</p>'+
           '<button type="button" class="checkout ask" data-ask="'+esc(key)+'">'+esc(L.checkout)+'</button>';
  }
  return '<button type="button" class="checkin" data-key="'+esc(key)+'">'+esc(L.checkin)+'</button>';
}

/* --- C5Z: no map, no number until the booth hands one out ---------------- */
var ASSIGNED=[];
function loadAssigned(hash){
  return fetch("api/assign",{headers:{Accept:"application/json"}})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(j){
      var a=(j&&j.assign)||{};
      ASSIGNED=Object.keys(a).filter(function(no){ return a[no].h===hash; })
                            .sort(function(x,y){ return x-y; });
    })
    .catch(function(){ ASSIGNED=[]; });
}
function c5zCard(g){
  var L=t();
  // no pitched tent means nothing will ever be assigned: they carry theirs away
  var pitched=Object.keys(g.t||{}).length>0;
  var booked=Object.keys(g.t||{}).map(function(k){ return (g.t[k]>1?g.t[k]+"× ":"")+k; }).join(" · ");
  var pick = (g.p&&g.p.length)
    ? '<ul class="picklist">'+g.p.map(function(a){
        return '<li><span class="pq">'+a[1]+'×</span>'+esc(a[0])+'</li>'; }).join("")+'</ul>'
    : '<p class="tent-sub" style="padding:0">'+esc(L.pickNone)+'</p>';

  return '<article class="card">'+
    '<p class="tent-eyebrow">'+esc(L.c5zTitle)+'</p>'+
    (ASSIGNED.length
      ? '<p class="tent-no">'+esc(ASSIGNED.join(" · "))+'</p>'+
        '<p class="tent-sub">'+esc(L.sub)+'</p>'
      : '<p class="c5z-wait">'+esc(pitched ? L.c5zNo : L.c5zPickOnly)+'</p>')+
    (booked?'<dl class="facts"><div><dt>'+esc(L.c5zBooked)+'</dt><dd class="sm">'+
      esc(booked)+'</dd></div></dl>':'')+
    '<div class="pickbox"><h3>'+esc(L.pickH)+'</h3>'+pick+'</div>'+
    (a_geo()?'<a class="route" target="_blank" rel="noopener noreferrer" href="'+a_geo()+'">'+
      esc(L.route)+'</a>':'')+
    '</article>';
}
function a_geo(){ return ""; }

/* --- lightbox ---------------------------------------------------------- */
function openPlan(key){
  var hit=find(key); if(!hit || !hit.a.plan) return;
  el("lbBody").innerHTML=photo(hit.a,true);
  el("lbClose").setAttribute("aria-label",t().close);
  el("lb").classList.add("active");
  document.body.classList.add("locked");
  el("lbClose").focus();
}
function closePlan(){
  el("lb").classList.remove("active");
  document.body.classList.remove("locked");
  el("lbBody").innerHTML="";
}
el("lb").addEventListener("click",function(e){ if(e.target===el("lb")) closePlan(); });
el("lbClose").addEventListener("click",closePlan);
document.addEventListener("keydown",function(e){ if(e.key==="Escape") closePlan(); });

/* --- render ------------------------------------------------------------ */
var shown=null, c5zHit=null, isAdmin=false, leaving=null, tries=0, blockedUntil=0;
function render(){
  var box=el("out");
  box.innerHTML="";
  if(c5zHit){
    el("addonTop").hidden=true;            // nothing is laid out in a C5Z tent
    box.innerHTML=c5zCard(c5zHit)+
      '<button type="button" class="again" id="again">'+esc(t().again)+'</button>';
    el("again").addEventListener("click",function(){
      c5zHit=null; shown=null; render(); el("msg").textContent=""; el("msg").className="msg";
      el("email").value=""; el("email").focus(); window.scrollTo({top:0,behavior:"smooth"});
    });
    return;
  }
  el("addonTop").hidden=false;
  if(!shown) return;
  box.innerHTML=shown.map(function(e,i){return card(e,i+1,shown.length);}).join("")+
    (isAdmin?overview():"")+
    '<button type="button" class="again" id="again">'+esc(t().again)+'</button>';
  [].forEach.call(box.querySelectorAll(".planbtn"),function(b){
    b.addEventListener("click",function(){ openPlan(b.getAttribute("data-key")); });
  });
  [].forEach.call(box.querySelectorAll(".checkin"),function(b){
    b.addEventListener("click",function(){
      b.disabled=true;
      checkIn(b.getAttribute("data-key"),"in").then(render).catch(function(){
        b.disabled=false; b.textContent=t().checkFail;
      });
    });
  });
  [].forEach.call(box.querySelectorAll("[data-ask]"),function(b){
    b.addEventListener("click",function(){ leaving=b.getAttribute("data-ask"); render(); });
  });
  [].forEach.call(box.querySelectorAll("[data-no]"),function(b){
    b.addEventListener("click",function(){ leaving=null; render(); });
  });
  [].forEach.call(box.querySelectorAll("[data-out]"),function(b){
    b.addEventListener("click",function(){
      b.disabled=true;
      checkIn(b.getAttribute("data-out"),"out").then(function(){ leaving=null; render(); })
        .catch(function(){ b.disabled=false; b.textContent=t().checkFail; });
    });
  });
  el("again").addEventListener("click",function(){
    shown=null; c5zHit=null; isAdmin=false; render(); el("msg").textContent=""; el("msg").className="msg";
    el("email").value=""; el("email").focus();
    window.scrollTo({top:0, behavior:"smooth"});
  });
}
function apply(){
  var L=t();
  document.documentElement.lang=lang;
  document.title=L.title;
  el("h1").textContent=L.h1;
  el("intro").textContent=L.intro;
  el("lab").textContent=L.label;
  el("email").placeholder=L.ph;
  el("go").textContent=L.submit;
  el("helpH").textContent=L.helpH;
  el("helpL").innerHTML=L.help.map(function(s){return "<li>"+s+"</li>";}).join("");
  el("nudgeH").textContent=L.lostH;
  el("nudgeB").textContent=L.lostB;
  el("nudgeHours").textContent=L.hours.replace("%h",DATA.contact.hours);
  var cta=el("nudgeCta");
  cta.href="https://wa.me/"+DATA.contact.wa;
  cta.textContent=DATA.contact.phone;
  var wa='<a class="wa" href="https://wa.me/'+esc(DATA.contact.wa)+'" target="_blank" '+
         'rel="noopener noreferrer">'+esc(DATA.contact.phone)+'</a>';
  el("foot").innerHTML=L.foot.replace("%name",esc(DATA.contact.name)).replace("%wa",wa)
                             .replace("%hours",esc(L.hours.replace("%h",DATA.contact.hours)));
  el("addonTop").textContent=L.addon;
  var d=el("demo");
  if(d) d.innerHTML=L.demo.replace("%s",esc(DATA.sample));
  [].forEach.call(document.querySelectorAll(".lang button"),function(b){
    b.setAttribute("aria-pressed", String(b.getAttribute("data-lang")===lang));
  });
  var m=el("msg");
  if(m.dataset.key) m.textContent = m.dataset.key==="found" ? L.found(Number(m.dataset.n)) : L[m.dataset.key];
  render();
}
[].forEach.call(document.querySelectorAll(".lang button"),function(b){
  b.addEventListener("click",function(){
    lang=b.getAttribute("data-lang");
    try{ localStorage.setItem("nw-lang",lang); }catch(e){}
    apply();
  });
});

/* --- the nudge: Alex on WhatsApp, five seconds in ----------------------- */
var nudged=false;
try{ nudged=sessionStorage.getItem("nw-nudge")==="1"; }catch(e){}
function nudge(show){
  var n=el("nudge");
  if(show){ n.hidden=false; requestAnimationFrame(function(){ n.classList.add("up"); }); }
  else{
    n.classList.remove("up"); nudged=true;
    try{ sessionStorage.setItem("nw-nudge","1"); }catch(e){}
    setTimeout(function(){ n.hidden=true; }, 300);
  }
}
el("nudgeX").addEventListener("click",function(){ nudge(false); });
el("nudgeCta").addEventListener("click",function(){ nudge(false); });
if(!nudged) setTimeout(function(){ if(!nudged) nudge(true); }, 5000);

/* --- lookup ------------------------------------------------------------ */
function say(key,n){
  var m=el("msg");
  m.dataset.key=key; if(n!==undefined) m.dataset.n=n;
  m.className="msg"+(key==="found"?"":" bad");
  m.textContent = key==="found" ? t().found(n) : t()[key];
}
el("finder").addEventListener("submit",function(ev){
  ev.preventDefault();
  var mail=String(el("email").value).trim().toLowerCase(), form=el("finder");
  shown=null; c5zHit=null; isAdmin=false; render(); form.classList.remove("invalid");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){ form.classList.add("invalid"); say("invalid"); return; }
  if(Date.now()<blockedUntil){ say("wait"); return; }
  var h=sha256(SALT+mail), keys=BOOK[h], c5=C5Z[h];
  isAdmin=ADMINS.indexOf(h)>=0;
  if(!keys && c5){
    tries=0; shown=null; c5zHit=c5; say("found",1);
    loadAssigned(h).then(function(){ render();
      if(el("out").firstChild) el("out").firstChild.scrollIntoView({behavior:"smooth",block:"start"}); });
    return;
  }
  c5zHit=null;
  if(!keys){
    isAdmin=false;
    tries++;
    if(tries>=5){ blockedUntil=Date.now()+30000; tries=0; say("wait"); }
    else { say("none"); }
    form.classList.add("invalid");
    return;
  }
  tries=0; shown=keys; say("found",keys.length); render();
  el("out").firstChild.scrollIntoView({behavior:"smooth", block:"start"});
});
apply();
loadCheck().then(function(){ if(CHECK) render(); });
})();
