/* Cuenta conmigo · sincronización entre dispositivos (demo).
   Una "sala" agrupa los dispositivos de la mesa: ?sala=xxx en la URL; por defecto 'demo'.
   CC.push({title,body,img,k})  → notificación web a los celulares de la sala (función push de Supabase)
   CC.send(tipo, datos)         → mensaje en vivo a las páginas abiertas de la sala (Supabase Realtime)
   CC.on(tipo, fn)              → escuchar esos mensajes ('*' = todos) */
(()=>{
  const CFG={url:'https://fmlqoibnzlvdyisvhbsf.supabase.co', key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtbHFvaWJuemx2ZHlpc3ZoYnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MDA0NjcsImV4cCI6MjExMTA3NjQ2N30.YNLl_c0RmDggvLxBaS4Z1b_v1vRsc2lULcpEduMlMPA', vapid:'BPG6vaSbPJrUjAmFrHcLXRaAK8-qT8nCHyCu13UImSmS-1WCubEv-3BGSluY_NHOEVdqTo6QINwdfgCYP0VN_ys'};
  const ls=(k,v)=>{ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} };
  const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,40);
  const qs=new URLSearchParams(location.search);
  /* la sala sale solo de la URL (no se recuerda: una prueba con otra sala no debe quedar pegada) */
  const sala=clean(qs.get('sala'))||'demo'; try{ localStorage.removeItem('cc-sala'); }catch(e){}
  const ready=()=>!CFG.url.startsWith('__');
  const fn=body=>fetch(CFG.url+'/functions/v1/push',{method:'POST',keepalive:true,headers:{'content-type':'application/json',apikey:CFG.key,authorization:'Bearer '+CFG.key},body:JSON.stringify({sala,...body})})
    .then(r=>r.json()).catch(e=>({error:String(e)}));
  const push=m=>ready()?fn({action:'send',...m}):Promise.resolve({error:'sin configurar'});
  const subscribe=sub=>fn({action:'sub',sub,ua:navigator.userAgent});

  const H={}, ST=[]; let chP=null, state='off';
  const setState=s=>{ state=s; ST.forEach(f=>{ try{ f(s); }catch(e){} }); };
  const lib=()=>window.supabase?Promise.resolve():new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload=ok; s.onerror=ko; document.head.appendChild(s); });
  let cli=null, chObj=null;
  function chan(){
    if(chP) return chP; if(!ready()) return Promise.reject('sin configurar');
    setState('conectando');
    chP=lib().then(()=>new Promise(ok=>{
      const c=cli=cli||window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:false}});
      const ch=chObj=c.channel('cc:'+sala,{config:{broadcast:{self:false}}});
      ch.on('broadcast',{event:'m'},({payload:p})=>{ [...(H[p.t]||[]),...(H['*']||[])].forEach(f=>{ try{ f(p.d||{},p); }catch(e){ console.error(e); } }); });
      ch.subscribe(s=>{ setState(s==='SUBSCRIBED'?'en vivo':s==='CLOSED'?'off':'reconectando'); if(s==='SUBSCRIBED'){ ok(ch); (H['_conectado']||[]).forEach(f=>f()); } });
    }));
    return chP;
  }
  /* Safari corta la conexión con la pantalla apagada o la pestaña oculta: al volver, si no está en vivo, se rehace */
  function revive(){ if(!chP||state==='en vivo') return; try{ cli&&chObj&&cli.removeChannel(chObj); }catch(e){} chP=null; chan().catch(()=>{}); }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') setTimeout(revive,400); });
  addEventListener('online',()=>setTimeout(revive,400));
  setInterval(revive,8000);
  const send=(t,d={})=>chan().then(ch=>ch.send({type:'broadcast',event:'m',payload:{t,d,ts:Date.now()}})).catch(()=>{});
  const on=(t,f)=>{ (H[t]=H[t]||[]).push(f); chan().catch(()=>{}); };
  const onState=f=>{ ST.push(f); f(state); };
  window.CC={sala,ready,push,send,on,onState,subscribe,vapid:CFG.vapid};
})();
