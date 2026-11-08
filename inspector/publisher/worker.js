// Secure browser-to-GitHub org-chart publisher. Cloudflare Worker module.
// Secrets: GITHUB_PRIVATE_KEY, GITHUB_CLIENT_SECRET, SESSION_SECRET.
// Vars: GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_CLIENT_ID.
const ORIGIN='https://placesiwent.eu', LOGIN='orakiotriestocode';
const REPO='orakiotriestocode/placesiwent', FILE='inspector/data/team.json', BRANCH='main';
const encode=new TextEncoder(),decode=new TextDecoder();
const base64=b=>{let s='';for(const c of b)s+=String.fromCharCode(c);return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')};
const unbase=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const cat=(...xs)=>{let n=0;for(const x of xs)n+=x.length;const b=new Uint8Array(n);let i=0;for(const x of xs){b.set(x,i);i+=x.length}return b};
function tlv(tag,value){let n=value.length,bytes=[];while(n){bytes.unshift(n&255);n=Math.floor(n/256)}const len=value.length<128?Uint8Array.of(value.length):Uint8Array.of(0x80|bytes.length,...bytes);return cat(Uint8Array.of(tag),len,value)}
// Cloudflare dashboard values can contain full PEM text, literal \n
// sequences, or only a base64 DER payload. Accept all three without logging
// the private key or any portion of its contents.
function keyBytes(pem){
 let raw=String(pem||'').trim().replace(/\\r\\n|\\n|\\r/g,'\n');
 raw=raw.replace(/^["']|["']$/g,'').trim();
 const match=raw.match(/-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]*?)-----END (?:RSA )?PRIVATE KEY-----/);
 const body=match?match[2]:raw;
 const compact=body.replace(/\s/g,'');
 if(!compact||!/^[a-zA-Z0-9+/=]+$/.test(compact))throw Error('Invalid GitHub private key format. Ensure Cloudflare contains the complete PEM file.');
 try{return Uint8Array.from(atob(compact),c=>c.charCodeAt(0))}
 catch(e){throw Error('Invalid GitHub private key base64 encoding')}
}
function wrapRsaPrivateKey(pkcs1){
 const oid=Uint8Array.of(0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00);
 return tlv(0x30,cat(Uint8Array.of(2,1,0),oid,tlv(4,pkcs1)));
}
async function signingKey(env){
 const data=keyBytes(env.GITHUB_PRIVATE_KEY);
 const algorithm={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
 // GitHub supplies RSA PKCS#1 private keys; other tools may export PKCS#8.
 // Try PKCS#8 first, then safely wrap PKCS#1.
 try{return await crypto.subtle.importKey('pkcs8',data,algorithm,false,['sign'])}
 catch(e){
  try{return await crypto.subtle.importKey('pkcs8',wrapRsaPrivateKey(data),algorithm,false,['sign'])}
  catch(inner){throw Error('Could not import GitHub App signing key. Confirm it is the .pem private key generated for this GitHub App.')}
 }
}
async function appJwt(env){
 const key=await signingKey(env);
 const time=Math.floor(Date.now()/1000),header=base64(encode.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),body=base64(encode.encode(JSON.stringify({iat:time-30,exp:time+540,iss:String(env.GITHUB_APP_ID)})));
 const msg=header+'.'+body,sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encode.encode(msg));
 return msg+'.'+base64(new Uint8Array(sig));
}
async function appToken(env){
 const r=await fetch('https://api.github.com/app/installations/'+env.GITHUB_INSTALLATION_ID+'/access_tokens',{method:'POST',headers:{Authorization:'Bearer '+await appJwt(env),Accept:'application/vnd.github+json','User-Agent':'orgchart-publisher','X-GitHub-Api-Version':'2022-11-28'},body:'{}'});
 if(!r.ok)throw Error('GitHub installation authentication failed: '+r.status);
 return (await r.json()).token;
}
async function github(env,method,body){
 const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+FILE+(method==='GET'?'?ref='+BRANCH:''),{method,headers:{Authorization:'Bearer '+await appToken(env),Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'orgchart-publisher','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});
 return r;
}
async function head(env){const r=await github(env,'GET');if(!r.ok)throw Error('GitHub data read failed: '+r.status);const j=await r.json();if(!j.sha)throw Error('GitHub did not return file SHA');return j.sha}
async function hmac(env){if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw Error('Invalid SESSION_SECRET');return crypto.subtle.importKey('raw',encode.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function sessionIssue(env,user){
 const exp=Math.floor(Date.now()/1000)+7200,body=base64(encode.encode(JSON.stringify({sub:String(user.id),login:user.login,exp,iss:'orgchart-publisher',aud:ORIGIN})));
 const sig=await crypto.subtle.sign('HMAC',await hmac(env),encode.encode(body));
 return {token:body+'.'+base64(new Uint8Array(sig)),expiresAt:exp,login:user.login};
}
async function sessionCheck(env,authorization){
 try{
  const token=String(authorization||'').replace(/^Bearer /,''),[body,sig,...extra]=token.split('.');
  if(!body||!sig||extra.length||body.length>4096)return null;
  if(!await crypto.subtle.verify('HMAC',await hmac(env),unbase(sig),encode.encode(body)))return null;
  const p=JSON.parse(decode.decode(unbase(body)));
  return p.iss==='orgchart-publisher'&&p.aud===ORIGIN&&p.login===LOGIN&&p.exp>Date.now()/1000?p:null;
 }catch(e){return null}
}
function cors(r){
 const h=new Headers(r.headers);h.set('Access-Control-Allow-Origin',ORIGIN);h.set('Access-Control-Allow-Headers','Authorization,Content-Type');h.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');h.set('Vary','Origin');h.set('Cache-Control','no-store');
 return new Response(r.body,{status:r.status,headers:h})
}
function json(v,status=200){return cors(new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json;charset=utf-8'}}))}
function fail(message,status){return json({ok:false,error:message},status)}
function cookie(req,name){return (req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''}
function html(text,status=200){
 return new Response(text,{status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none';script-src 'unsafe-inline';base-uri 'none';frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}})
}
function validate(doc){
 if(!doc||!Array.isArray(doc.people)||!Array.isArray(doc.types)||doc.people.length<1||doc.people.length>500||doc.types.length>80)throw Error('Invalid organization data');
 const ids=new Set(),names=new Set(),kinds=new Set();
 const str=(v,max=1024)=>{if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>max)throw Error('Invalid text field');return v};
 const columns=['id','name','role','pillar','region','country','product','manager','functionalManager','hierarchyLevel','type','startDate','endDate'];
 const people=doc.people.map(p=>{
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid person');
  const o={};for(const k of columns)o[k]=str(p[k]);
  if(!o.id||!o.name.trim()||ids.has(o.id)||names.has(o.name.trim().toLowerCase()))throw Error('Missing or duplicate name/ID: '+o.name);
  ids.add(o.id);names.add(o.name.trim().toLowerCase());
  for(const key of ['layoutOffsetDown','layoutOffsetRight'])if(p[key]!==undefined&&p[key]!==null&&p[key]!==''){const n=Number(p[key]);if(!Number.isFinite(n)||Math.abs(n)>100000)throw Error('Invalid position');o[key]=n}
  return o;
 });
 const types=doc.types.map(t=>{
  if(!t||typeof t!=='object')throw Error('Invalid type');
  const id=str(t.id),name=str(t.name),color=str(t.color);
  if(!id||!name||kinds.has(id)||!/^#[a-f0-9]{6}$/i.test(color))throw Error('Invalid or duplicate type');
  kinds.add(id);return {id,name,color:color.toLowerCase()}
 });
 return {format:'mesh-published-v1',environment:'live',people,types};
}
function githubB64(text){const bytes=encode.encode(text);let output='';for(let i=0;i<bytes.length;i+=8192){output+=String.fromCharCode(...bytes.subarray(i,i+8192))}return btoa(output)}
export default {
 async fetch(req,env){
  const u=new URL(req.url),path=u.pathname;
  try{
   if(path==='/health')return json({ok:true,service:'orgchart-publisher',configured:!!(env.GITHUB_APP_ID&&env.GITHUB_INSTALLATION_ID&&env.GITHUB_PRIVATE_KEY&&env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.SESSION_SECRET)});
   if(path==='/auth/start'&&req.method==='GET'){
    const random=new Uint8Array(32);crypto.getRandomValues(random);const state=base64(random);
    const destination='https://github.com/login/oauth/authorize?'+new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:u.origin+'/auth/callback',state});
    const r=new Response(null,{status:302,headers:{Location:destination,'Cache-Control':'no-store'}});
    r.headers.set('Set-Cookie','orgchart_state='+state+'; Max-Age=600; Path=/auth; HttpOnly; Secure; SameSite=Lax');return r;
   }
   if(path==='/auth/callback'&&req.method==='GET'){
    const code=u.searchParams.get('code'),state=u.searchParams.get('state');
    if(!code||!state||state!==cookie(req,'orgchart_state'))return html('Authorization state does not match. Close this window and try again.',403);
    const exchange=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:u.origin+'/auth/callback'})});
    if(!exchange.ok)throw Error('GitHub OAuth exchange failed');
    const access=(await exchange.json()).access_token;if(!access)throw Error('No OAuth access token');
    const identity=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+access,Accept:'application/vnd.github+json','User-Agent':'orgchart-publisher'}});
    if(!identity.ok)throw Error('GitHub user lookup failed');
    const user=await identity.json();
    if(user.login!==LOGIN)return html('You are not authorized to publish this chart.',403);
    const payload=JSON.stringify({type:'orgchart-auth',ok:true,...await sessionIssue(env,user)}).replace(/</g,'\\u003c');
    const page=html('<!doctype html><meta charset="utf-8"><title>Sign-in complete</title><p>Signed in. You can close this window.</p><script>if(window.opener){window.opener.postMessage('+payload+','+JSON.stringify(ORIGIN)+');window.close()}</script>');
    page.headers.set('Set-Cookie','orgchart_state=; Max-Age=0; Path=/auth; HttpOnly; Secure; SameSite=Lax');return page;
   }
   if(path.startsWith('/api/')){
    if(req.method==='OPTIONS')return cors(new Response(null,{status:204}));
    if(req.headers.get('Origin')!==ORIGIN)return fail('Origin not permitted',403);
    if(path==='/api/head'&&req.method==='GET')return json({ok:true,sha:await head(env)});
    if(path==='/api/session'&&req.method==='GET'){
     const claim=await sessionCheck(env,req.headers.get('Authorization'));
     return claim?json({ok:true,login:claim.login,expiresAt:claim.exp}):fail('Not signed in',401);
    }
    if(path==='/api/publish'&&req.method==='POST'){
     const claim=await sessionCheck(env,req.headers.get('Authorization'));
     if(!claim)return fail('Not authorized. Sign in with GitHub.',401);
     if(Number(req.headers.get('Content-Length')||0)>250000)return fail('Data exceeds maximum size',413);
     let input;try{input=await req.json()}catch(e){return fail('Invalid JSON',400)}
     const sha=String(input.baseSha||'');if(!/^[0-9a-f]{40}$/.test(sha))return fail('Missing original published version',400);
     let data;try{data=validate(input)}catch(e){return fail(e.message,400)}
     const content=JSON.stringify(data,null,2)+'\n';if(content.length>250000)return fail('Data exceeds maximum size',413);
     if(sha!==await head(env))return fail('Shared chart changed since you started editing. Reload the published version before trying again.',409);
     const result=await github(env,'PUT',{message:'Publish org chart from browser by '+claim.login,branch:BRANCH,sha,content:githubB64(content)});
     if(result.status===409||result.status===422)return fail('Concurrent update detected. Reload the published chart.',409);
     if(!result.ok)return fail('GitHub rejected publication: HTTP '+result.status,502);
     const saved=await result.json();return json({ok:true,commit:saved.commit?.sha,sha:saved.content?.sha,message:'Saved to GitHub. GitHub Pages deployment is separate.'});
    }
    return fail('Unknown endpoint',404)
   }
   return json({ok:true,service:'orgchart-publisher'});
  }catch(e){console.error('Publisher failure:',e);return fail('Publisher failed: '+String(e?.message||'unexpected error').slice(0,140),500)}
 }
};
