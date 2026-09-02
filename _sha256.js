/* SHA-256, plain JS so the page also works from a file:// URL.
   Verified against node crypto for ASCII and UTF-8 input. */
function sha256(str){
  var bytes=unescape(encodeURIComponent(str)), h=[], k=[], i, j;
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
         0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
         0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
         0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
         0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
         0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
         0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
         0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  function rr(x,n){return (x>>>n)|(x<<(32-n));}
  var len=bytes.length, bitLen=len*8, w=[], pad=bytes+"\x80";
  while(pad.length%64!==56) pad+="\x00";
  var words=[];
  for(i=0;i<pad.length;i++) words[i>>2]=(words[i>>2]||0)|(pad.charCodeAt(i)<<((3-i%4)*8));
  words.push(Math.floor(bitLen/4294967296)); words.push(bitLen|0);
  for(j=0;j<words.length;j+=16){
    for(i=0;i<16;i++) w[i]=words[j+i]|0;
    for(i=16;i<64;i++){
      var a=w[i-15], b=w[i-2];
      w[i]=(w[i-16]+(rr(a,7)^rr(a,18)^(a>>>3))+w[i-7]+(rr(b,17)^rr(b,19)^(b>>>10)))|0;
    }
    var v=H.slice(0);
    for(i=0;i<64;i++){
      var S1=rr(v[4],6)^rr(v[4],11)^rr(v[4],25);
      var ch=(v[4]&v[5])^((~v[4])&v[6]);
      var t1=(v[7]+S1+ch+K[i]+w[i])|0;
      var S0=rr(v[0],2)^rr(v[0],13)^rr(v[0],22);
      var mj=(v[0]&v[1])^(v[0]&v[2])^(v[1]&v[2]);
      var t2=(S0+mj)|0;
      v=[(t1+t2)|0,v[0],v[1],v[2],(v[3]+t1)|0,v[4],v[5],v[6]];
    }
    for(i=0;i<8;i++) H[i]=(H[i]+v[i])|0;
  }
  var out="";
  for(i=0;i<8;i++) for(j=3;j>=0;j--){ var bb=(H[i]>>(j*8))&255; out+=(bb<16?"0":"")+bb.toString(16); }
  return out;
}
