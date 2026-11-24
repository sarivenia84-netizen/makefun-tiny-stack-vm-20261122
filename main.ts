#!/usr/bin/env node
const fs=require('node:fs'), path=require('node:path');
const S=256,C=64,N=256,L=1e6,O=65536;
const T={u:2,o:3,d:4,b:5,m:6,c:7,r:8,p:9,s:10,w:11};
const spec={0:[0,0,0],1:[1,0,1],2:[4,0,1],3:[0,1,0],4:[0,1,2],5:[0,2,2],6:[0,2,3],7:[0,3,3],16:[0,2,1],17:[0,2,1],18:[0,2,1],19:[0,2,1],20:[0,2,1],21:[0,2,1],22:[0,2,1],23:[0,1,1],24:[0,2,1],25:[0,2,1],26:[0,2,1],27:[0,1,1],28:[0,2,1],29:[0,2,1],30:[0,2,1],32:[0,2,1],33:[0,2,1],34:[0,2,1],48:[2,0,0],49:[2,1,0],50:[2,1,0],51:[2,0,0],52:[0,0,0],64:[0,1,1],65:[0,2,0],80:[0,1,0],81:[0,1,0],82:[0,0,1],83:[0,1,0]};
function run(code,inp){
 let d=new Int32Array(S),c=new Int32Array(C),m=new Int32Array(N),out=new Uint8Array(O),sp=0,cp=0,ip=0,pc=0,z=0,k=0,n=code.length;
 const end=e=>({stdout:out.slice(0,z),exit:e,trap:e,steps:k});
 for(;;){
  if(k===L)return end(T.s); if(pc<0||pc>=n)return end(T.p);
  let x=code[pc],q=spec[x];if(!q)return end(T.b);let [im,push,pop]=q;
  if(pc+im>=n)return end(T.p);k++;let nx=pc+im+1;
  if(sp<push)return end(T.u);if(sp-push+pop>S)return end(T.o);pc=nx;
  let a,b,v;
  switch(x){
   case 0:return {stdout:out.slice(0,z),exit:0,trap:null,steps:k};
   case 1:d[sp++]=(code[nx-1]<<24)>>24;break;
   case 2:d[sp++]=code[nx-4]|code[nx-3]<<8|code[nx-2]<<16|code[nx-1]<<24;break;
   case 3:sp--;break;
   case 4:d[sp]=d[sp-1];sp++;break;
   case 5:v=d[sp-1];d[sp-1]=d[sp-2];d[sp-2]=v;break;
   case 6:d[sp]=d[sp-2];sp++;break;
   case 7:v=d[sp-3];d[sp-3]=d[sp-2];d[sp-2]=d[sp-1];d[sp-1]=v;break;
   case 23:d[sp-1]=-d[sp-1]|0;break;
   case 27:d[sp-1]=~d[sp-1];break;
   case 48:case 49:case 50:
    v=(code[nx-2]|code[nx-1]<<8)<<16>>16;
    if(x===48)pc=nx+v;else if((d[--sp]===0)===(x===49))pc=nx+v;break;
   case 51:if(cp===C)return end(T.c);c[cp++]=nx;pc=code[nx-2]|code[nx-1]<<8;break;
   case 52:if(!cp)return end(T.r);pc=c[--cp];break;
   case 64:v=d[sp-1];if(v<0||v>=N)return end(T.m);d[sp-1]=m[v];break;
   case 65:v=d[sp-1];a=d[sp-2];if(v<0||v>=N)return end(T.m);sp-=2;m[v]=a;break;
   case 80:v=Buffer.from(String(d[--sp]));if(z+v.length>O)return end(T.w);out.set(v,z);z+=v.length;break;
   case 81:if(z===O)return end(T.w);out[z++]=d[--sp]&255;break;
   case 82:d[sp++]=ip<inp.length?inp[ip++]:-1;break;
   case 83:return {stdout:out.slice(0,z),exit:d[--sp]&255,trap:null,steps:k};
   default:
    b=d[--sp];a=d[--sp];
    switch(x){
     case 16:v=a+b|0;break;case 17:v=a-b|0;break;case 18:v=Math.imul(a,b);break;
     case 19:case 20:case 21:case 22:if(!b)return end(T.d);v=x===19?(a===-2147483648&&b===-1?a:a/b|0):x===20?(b===-1?0:a%b|0):x===21?Math.floor((a>>>0)/(b>>>0))|0:(a>>>0)%(b>>>0)|0;break;
     case 24:v=a&b;break;case 25:v=a|b;break;case 26:v=a^b;break;
     case 28:v=a<<(b&31);break;case 29:v=a>>(b&31);break;case 30:v=a>>>(b&31);break;
     case 32:v=+(a===b);break;case 33:v=+(a<b);break;case 34:v=+(a>>>0<b>>>0);break;
    }
    d[sp++]=v;break;
  }
 }
}
const I=process.env.MAKEFUN_INPUT_DIR||'/input',B=process.env.MAKEFUN_OUTPUT_DIR||'/output';
for(const id of fs.readdirSync(I).filter(x=>/^i\d+/.test(x)).sort()){
 const dir=path.join(I,id),to=path.join(B,id);fs.mkdirSync(to,{recursive:true});
 const r=run(fs.readFileSync(path.join(dir,'program.bin')),fs.readFileSync(path.join(dir,'input.bin')));
 fs.writeFileSync(path.join(to,'stdout.bin'),r.stdout);fs.writeFileSync(path.join(to,'exit.txt'),r.exit+'\n');
}
