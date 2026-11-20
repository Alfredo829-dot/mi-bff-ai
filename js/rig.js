// Mi BFF AI — puppet 2D con deformación de malla (WebGL), estilo Live2D simplificado
const VS = `
attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV;
void main(){ vUV=aUV; gl_Position=vec4(aPos,0.0,1.0); }`;
const FS_PUP = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex, uMask; uniform vec2 uSize; uniform float uAlpha;
uniform vec3 uHair; uniform float uHairOn; uniform vec3 uEye; uniform float uEyeOn; uniform vec3 uEar; uniform float uEarOn;
uniform vec4 uEyeL, uEyeR; uniform float uEyeAng, uBlink; uniform vec3 uSkin;
uniform vec3 uMouth; uniform float uOpen; uniform vec3 uTint; uniform float uFace;
vec3 rgb2hsl(vec3 c){ float mx=max(c.r,max(c.g,c.b)), mn=min(c.r,min(c.g,c.b)); float l=(mx+mn)*.5; float h=0., s=0.;
 if(mx>mn){ float d=mx-mn; s = l>.5? d/(2.-mx-mn) : d/(mx+mn);
  if(mx==c.r) h=(c.g-c.b)/d+(c.g<c.b?6.:0.); else if(mx==c.g) h=(c.b-c.r)/d+2.; else h=(c.r-c.g)/d+4.; h/=6.; }
 return vec3(h,s,l); }
float h2r(float p,float q,float t){ if(t<0.)t+=1.; if(t>1.)t-=1.; if(t<1./6.)return p+(q-p)*6.*t; if(t<.5)return q; if(t<2./3.)return p+(q-p)*(2./3.-t)*6.; return p; }
vec3 hsl2rgb(vec3 c){ if(c.y==0.) return vec3(c.z); float q=c.z<.5?c.z*(1.+c.y):c.z+c.y-c.z*c.y; float p=2.*c.z-q;
 return vec3(h2r(p,q,c.x+1./3.),h2r(p,q,c.x),h2r(p,q,c.x-1./3.)); }
vec3 recolor(vec3 rgb, vec3 tgt){ vec3 h=rgb2hsl(rgb); float l = tgt.z>1. ? 1.-(1.-h.z)/tgt.z : h.z*tgt.z; return hsl2rgb(vec3(tgt.x, clamp(h.y*tgt.y,0.,1.), clamp(l,0.,1.))); }
vec3 lid(vec3 col, vec2 px, vec4 e){
 vec2 d=px-e.xy; float ca=cos(-uEyeAng), sa=sin(-uEyeAng); vec2 p=vec2(d.x*ca-d.y*sa, d.x*sa+d.y*ca);
 float ee=(p.x*p.x)/(e.z*e.z)+(p.y*p.y)/(e.w*e.w);
 float yl=-e.w+2.*e.w*uBlink;
 if(ee<1.15 && p.y<yl) col = uSkin*(0.92+0.08*(p.y/e.w));
 if(ee<1.25 && abs(p.y-yl)<min(1.8,e.w*0.28) && uBlink>0.12) col = vec3(0.16,0.09,0.08);
 return col; }
void main(){
 vec4 c=texture2D(uTex,vUV); if(c.a<0.003) discard;
 vec3 rgb=c.rgb/c.a; vec4 m=texture2D(uMask,vUV); vec2 px=vUV*uSize;
 if(uHairOn>0.5 && m.r>0.02) rgb=mix(rgb,recolor(rgb,uHair),m.r);
 if(uEyeOn>0.5 && m.g>0.02) rgb=mix(rgb,recolor(rgb,uEye),m.g);
 if(uEarOn>0.5 && m.b>0.02) rgb=mix(rgb,recolor(rgb,uEar),m.b);
 if(uFace>0.5){
  if(uBlink>0.02){ rgb=lid(rgb,px,uEyeL); rgb=lid(rgb,px,uEyeR); }
  if(uOpen>0.03){ vec2 q=px-uMouth.xy; float ry=uOpen*6.5*clamp(uMouth.z/10.,0.35,1.); q.y-=ry*0.55; float rx=uMouth.z*(0.55+0.25*uOpen);
   float e=(q.x*q.x)/(rx*rx)+(q.y*q.y)/(ry*ry);
   if(e<1.){ vec3 mc=vec3(0.36,0.09,0.12); if(q.y<-ry*0.45) mc=vec3(0.96,0.93,0.92); rgb=mix(rgb,mc,smoothstep(1.,0.75,e)); } }
 }
 rgb*=uTint;
 float a=c.a*uAlpha; gl_FragColor=vec4(rgb*a,a);
}`;
const FS_BG = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uDim; uniform vec4 uGlow; uniform float uA;
void main(){ vec3 c=texture2D(uTex,vUV).rgb*uDim;
 vec2 g=(vUV-uGlow.xy)/uGlow.zw; float d=dot(g,g); c+=vec3(0.45,0.3,0.9)*0.18*max(0.,1.-d)*step(0.001,uGlow.z); gl_FragColor=vec4(c*uA,uA); }`;
const FS_VID = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uA;
void main(){ vec3 c=texture2D(uTex,vec2(vUV.x,vUV.y*0.5)).rgb; float a=texture2D(uTex,vec2(vUV.x,0.5+vUV.y*0.5)).r;
 a=clamp((a-0.04)/0.92,0.,1.)*uA; gl_FragColor=vec4(c*a,a); }`;
const FS_SH = `precision mediump float; varying vec2 vUV; uniform float uAlpha;
void main(){ vec2 p=vUV*2.-1.; float d=dot(p,p); float a=(1.-smoothstep(0.2,1.,d))*0.38*uAlpha; gl_FragColor=vec4(0.,0.,0.,a); }`;

function sh(gl, type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(gl, fs){ const p=gl.createProgram(); gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,VS)); gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,fs));
  gl.bindAttribLocation(p,0,'aPos'); gl.bindAttribLocation(p,1,'aUV'); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i); u[a.name]=gl.getUniformLocation(p,a.name);} return {p,u}; }

export function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.decoding='async'; i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

export class Renderer {
  constructor(canvas){
    this.c=canvas; const o={alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true};
    this.gl2=true; let gl=canvas.getContext('webgl2',o); if(!gl){ gl=canvas.getContext('webgl',o); this.gl2=false; }
    if(!gl) throw new Error('WebGL no disponible'); this.gl=gl;
    this.pPup=prog(gl,FS_PUP); this.pBg=prog(gl,FS_BG); this.pSh=prog(gl,FS_SH); this.pVid=prog(gl,FS_VID);
    this.buf=gl.createBuffer(); this.ibuf=gl.createBuffer(); this.qbuf=gl.createBuffer();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  texture(img, mip=true){ const gl=this.gl, t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, mip);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    const useMip = mip && this.gl2; if(useMip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,useMip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); return t; }
  resize(){ const d=Math.min(window.devicePixelRatio||1,2); const w=Math.round(this.c.clientWidth*d), h=Math.round(this.c.clientHeight*d);
    if(this.c.width!==w||this.c.height!==h){ this.c.width=w; this.c.height=h; } this.gl.viewport(0,0,w,h); this.W=this.c.clientWidth; this.H=this.c.clientHeight; }
  // cam: {k, cx, cy, ax, ay, aw, ah}
  toClip(X,Y,cam){ const sx=(X-cam.cx)*cam.k+cam.ax+cam.aw/2, sy=(Y-cam.cy)*cam.k+cam.ay+cam.ah/2; return [sx/this.W*2-1, 1-sy/this.H*2]; }
  quad(x0,y0,x1,y1,cam){ const a=this.toClip(x0,y0,cam), b=this.toClip(x1,y1,cam);
    const d=new Float32Array([a[0],a[1],0,0, b[0],a[1],1,0, a[0],b[1],0,1, b[0],b[1],1,1]);
    const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,this.qbuf); gl.bufferData(gl.ARRAY_BUFFER,d,gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0); gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); }
  clear(){ const gl=this.gl; gl.clearColor(0.06,0.03,0.09,1); gl.clear(gl.COLOR_BUFFER_BIT); }
  drawBg(tex,W,H,cam,dim=1,glow=null,rect=null,alpha=1){ const gl=this.gl,P=this.pBg; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(P.u.uTex,0); gl.uniform1f(P.u.uDim,dim); gl.uniform4fv(P.u.uGlow, glow||[0,0,0,0]); gl.uniform1f(P.u.uA,alpha);
    if(rect) this.quad(rect[0],rect[1],rect[2],rect[3],cam); else this.quad(0,0,W,H,cam); }
  videoTexture(){ const gl=this.gl,t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }
  updateVideo(t,video){ const gl=this.gl; gl.bindTexture(gl.TEXTURE_2D,t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video); return true; }catch(e){ return false; } }
  drawVideo(tex,rect,cam,alpha){ const gl=this.gl,P=this.pVid; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(P.u.uTex,0); gl.uniform1f(P.u.uA,alpha); this.quad(rect[0],rect[1],rect[2],rect[3],cam); }
  drawShadow(x,y,w,h,cam,a){ const gl=this.gl,P=this.pSh; gl.useProgram(P.p); gl.uniform1f(P.u.uAlpha,a); this.quad(x-w/2,y-h/2,x+w/2,y+h/2,cam); }
}

const smooth=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };

export class Puppet {
  // L: landmarks en px de la imagen
  constructor(R, img, maskImg, L, cols=18, rows=44){
    this.R=R; this.L=L; this.w=img.width; this.h=img.height; this.tex=R.texture(img,true); this.mtex=R.texture(maskImg,false);
    this.cols=cols; this.rows=rows; const nv=(cols+1)*(rows+1);
    this.uv=new Float32Array(nv*2); this.data=new Float32Array(nv*4); this.hair=new Float32Array(nv);
    // pesos de cabello desde la máscara
    const cv=document.createElement('canvas'); cv.width=maskImg.width; cv.height=maskImg.height; const cx=cv.getContext('2d'); cx.drawImage(maskImg,0,0);
    const md=cx.getImageData(0,0,cv.width,cv.height).data, msx=cv.width/this.w, msy=cv.height/this.h;
    let k=0; for(let j=0;j<=rows;j++) for(let i=0;i<=cols;i++){ const u=i/cols, v=j/rows; this.uv[k*2]=u; this.uv[k*2+1]=v;
      let s=0,n=0; const px=u*this.w, py=v*this.h; for(let dy=-14;dy<=14;dy+=7) for(let dx=-14;dx<=14;dx+=7){ const X=Math.round((px+dx)*msx), Y=Math.round((py+dy)*msy);
        if(X>=0&&Y>=0&&X<cv.width&&Y<cv.height){ s+=md[(Y*cv.width+X)*4]/255; n++; } } this.hair[k]=n?s/n:0; k++; }
    const idx=[]; for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){ const a=j*(cols+1)+i, b=a+1, c=a+cols+1, d=c+1; idx.push(a,b,c,b,d,c); }
    this.idx=new Uint16Array(idx); this.ibuf=R.gl.createBuffer(); R.gl.bindBuffer(R.gl.ELEMENT_ARRAY_BUFFER,this.ibuf); R.gl.bufferData(R.gl.ELEMENT_ARRAY_BUFFER,this.idx,R.gl.STATIC_DRAW);
    this.vbuf=R.gl.createBuffer();
    // tono de piel para párpados
    this.skin=[0.96,0.80,0.72];
    if(L.skin) this.skin=L.skin; else if(L.cheek){ const c2=document.createElement('canvas'); c2.width=c2.height=1; const x2=c2.getContext('2d'); x2.drawImage(img,L.cheek[0]-2,L.cheek[1]-2,5,5,0,0,1,1); const p=x2.getImageData(0,0,1,1).data; this.skin=[p[0]/255,p[1]/255,p[2]/255]; }
  }
  // deformación de un punto (u,v en px)
  deform(u,v,hw,P,t){
    const L=this.L; let x=u, y=v;
    if(L.kind==='desk'){
      const wHead=smooth(L.neckY+25,L.neckY-30,v)*smooth(L.headX0,L.headX0+40,u);
      // respiración
      const br=Math.sin(t*1.6)*1.2*smooth(L.neckY+260,L.neckY,v)*smooth(L.neckY-60,L.neckY+20,v); y-=br;
      // tecleo: manos
      const dh=Math.hypot(u-L.hands[0],v-L.hands[1]); if(dh<70){ const w=1-dh/70; y+=Math.sin(t*22+u*0.15)*2.2*w*P.typing; x+=Math.sin(t*9+v*0.2)*1.2*w*P.typing; }
      // mandíbula (perfil en compu/clóset)
      if(P.open>0.02&&L.mouth){ const jr=L.jawR||[20,14], dm=Math.hypot((u-L.mouth[0])/jr[0],(v-L.mouth[1]-jr[1])/jr[1]); if(dm<1&&v>L.mouth[1]-1) y+=P.open*(jr[1]/7)*(1-dm); }
      // cabeza
      const a=(P.headTilt*0.6+Math.sin(t*0.9)*0.02+P.typing*Math.sin(t*3.1)*0.015)*wHead; const dx=x-L.neck[0], dy=y-L.neck[1];
      x=L.neck[0]+dx*Math.cos(a)-dy*Math.sin(a); y=L.neck[1]+dx*Math.sin(a)+dy*Math.cos(a)+P.nod*3*wHead;
      x+=hw*smooth(L.neckY-40,L.neckY+300,v)*Math.sin(t*1.4+v*0.012)*3;
      return [x,y];
    }
    const cx=L.cx, legTop=L.legTop, foot=L.footY;
    // --- cambio de peso / cadera
    const wUp=smooth(foot,legTop,v); x+=P.hip*wUp;
    // --- respiración (pecho/hombros)
    const wT=smooth(L.shoulderY-30,L.shoulderY+20,v)*smooth(L.waistY+20,L.waistY-40,v);
    x+=(u-cx)*0.012*P.breath*wT; y-=P.breath*2.2*smooth(L.waistY,L.shoulderY-20,v);
    // --- brazos (pequeño balanceo alrededor del hombro)
    if(L.armL){ for(const [arm,ang] of [[L.armL,P.armL],[L.armR,P.armR]]){ if(!ang) continue;
      const wa=smooth(arm[0]-22,arm[0]+6,u)*smooth(arm[1]+22,arm[1]-6,u)*smooth(L.shoulderY,L.handY,v)*smooth(L.handY+60,L.handY,v);
      if(wa>0){ const px=(arm[0]+arm[1])/2, py=L.shoulderY; const dx=x-px, dy=y-py, a=ang*wa; x=px+dx*Math.cos(a)-dy*Math.sin(a); y=py+dx*Math.sin(a)+dy*Math.cos(a); } } }
    // --- pulgares (modo cel)
    if(L.thumbs && P.typing>0){ const dh=Math.hypot(u-L.thumbs[0],v-L.thumbs[1]); if(dh<32){ const w=1-dh/32; y+=Math.sin(t*20+(u>L.thumbs[0]?Math.PI:0))*2.2*w*P.typing; } }
    // --- mandíbula
    if(P.open>0.02){ const dm=Math.hypot((u-L.mouth[0])/34,(v-L.mouth[1]-24)/24); if(dm<1&&v>L.mouth[1]-2) y+=P.open*3.2*(1-dm); }
    // --- torso inclinación (alrededor de la cadera)
    const wLean=smooth(legTop+20,L.waistY-40,v); if(P.lean){ const a=P.lean*wLean, dx=x-cx, dy=y-legTop; x=cx+dx*Math.cos(a)-dy*Math.sin(a); y=legTop+dx*Math.sin(a)+dy*Math.cos(a); }
    // --- cabeza: inclinación + asentir + giro
    const wHead=smooth(L.neckY+18,L.neckY-36,v);
    // el cabello largo sigue a la cabeza parcialmente
    const wHH=Math.max(wHead, hw*smooth(L.waistY+80,L.neckY,v)*0.55);
    if(wHH>0){ const pvx=cx+P.hip, pvy=L.neckY-P.breath*2.2; const a=P.headTilt*wHH, dx=x-pvx, dy=y-pvy;
      x=pvx+dx*Math.cos(a)-dy*Math.sin(a)+P.headTurn*7*wHead; y=pvy+dx*Math.sin(a)+dy*Math.cos(a)+P.nod*5*wHead; }
    // --- vaivén del pelo (puntas)
    const hs=hw*smooth(L.shoulderY-40,L.waistY+120,v);
    x+=hs*(Math.sin(t*1.35+v*0.011)*3.2*P.hairAmp + P.hairWind);
    return [x,y];
  }
  // place: {x,y,s} ancla (cx,footY) o (0,0) para desk ; look: colores
  draw(P,t,place,cam,alpha,look){
    if(alpha<=0.003) return; const R=this.R, gl=R.gl, L=this.L, n=this.uv.length/2, D=this.data;
    const ax=L.kind==='desk'?0:L.cx, ay=L.kind==='desk'?0:L.footY;
    for(let k=0;k<n;k++){ const u=this.uv[k*2]*this.w, v=this.uv[k*2+1]*this.h; const [x,y]=this.deform(u,v,this.hair[k],P,t);
      const c=R.toClip(place.x+(x-ax)*place.s*(place.sx??1), place.y+(y-ay)*place.s, cam); D[k*4]=c[0]; D[k*4+1]=c[1]; D[k*4+2]=this.uv[k*2]; D[k*4+3]=this.uv[k*2+1]; }
    const Pp=R.pPup, U=Pp.u; gl.useProgram(Pp.p);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbuf); gl.bufferData(gl.ARRAY_BUFFER,D,gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0); gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibuf);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.tex); gl.uniform1i(U.uTex,0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,this.mtex); gl.uniform1i(U.uMask,1);
    gl.uniform2f(U.uSize,this.w,this.h); gl.uniform1f(U.uAlpha,alpha);
    gl.uniform3fv(U.uHair,look.hair||[0,1,1]); gl.uniform1f(U.uHairOn,look.hair?1:0);
    gl.uniform3fv(U.uEye,look.eye||[0,1,1]); gl.uniform1f(U.uEyeOn,look.eye?1:0);
    gl.uniform3fv(U.uEar,look.ear||[0,1,1]); gl.uniform1f(U.uEarOn,look.ear?1:0);
    gl.uniform3fv(U.uTint,look.tint||[1,1,1]);
    const face=!!L.eyes; gl.uniform1f(U.uFace,face?1:0);
    if(face){ gl.uniform4f(U.uEyeL,L.eyes[0][0],L.eyes[0][1],L.eyeR[0],L.eyeR[1]); gl.uniform4f(U.uEyeR,L.eyes[1][0],L.eyes[1][1],L.eyeR[0],L.eyeR[1]);
      gl.uniform1f(U.uEyeAng,L.eyeAng); gl.uniform1f(U.uBlink,P.blink); gl.uniform3fv(U.uSkin,this.skin);
      gl.uniform3f(U.uMouth,L.mouth[0],L.mouth[1],L.mouthW); gl.uniform1f(U.uOpen,P.open); }
    else { gl.uniform1f(U.uBlink,0); gl.uniform1f(U.uOpen,0); }
    gl.drawElements(gl.TRIANGLES,this.idx.length,gl.UNSIGNED_SHORT,0);
  }
}
