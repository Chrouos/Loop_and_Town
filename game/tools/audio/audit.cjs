// Requires Playwright; set PLAYWRIGHT_MODULE to its module path if not installed locally.
// Start Vite first. AUDIO_LAB_URL and CHROME_PATH may override the local defaults.
// Usage: node game/tools/audio/audit.cjs [output.json]
// AUDIT_IDS=id,id restricts work to selected sounds; omit for the complete catalog.
// AUDIT_RATES=0.5,1,2 renders each synthesis recipe at each requested rate (default: 1).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),headless:true});
 const page=await browser.newPage();
 await page.goto(process.env.AUDIO_LAB_URL || 'http://127.0.0.1:5173/audio-lab.html');
 const rates=(process.env.AUDIT_RATES||'1').split(',').map(Number);
 if(rates.some(rate=>!Number.isFinite(rate)||rate<0.25||rate>4))throw Error('AUDIT_RATES must be between 0.25 and 4');
 const result=await page.evaluate(async({ids,rates})=>{
  const include=id=>!ids.length||ids.includes(id);
  const {SFX_SAMPLES,AMBIENCE_SAMPLES,sampleUrl}=await import('/src/audio/samples.ts');
  const {SFX_RECIPES}=await import('/src/audio/sounds.ts');
  const {Graph}=await import('/src/audio/core.ts');
  const {phoneTick}=await import('/src/audio/voice.ts');
  const {AMBIENCE, SFX}=await import('/src/audio/catalog.ts');
  const {startAmbience}=await import('/src/audio/ambience.ts');
  const db=x=>+(20*Math.log10(Math.max(1e-9,x))).toFixed(2);
  function measure(buf){
   const channels=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i));
   let peak=0,sum=0,dc=0,clipped=0,first=buf.length,last=0,rolling=0,maxWindow=0,tail=0;
   const win=Math.round(buf.sampleRate*.05), energy=new Float64Array(buf.length);
   for(let i=0;i<buf.length;i++){
    let frame=0,level=0;
    for(const d of channels){const x=d[i];if(!Number.isFinite(x))throw Error('non-finite audio sample');peak=Math.max(peak,Math.abs(x));sum+=x*x;dc+=x;if(Math.abs(x)>=.999)clipped++;frame+=x*x/channels.length;level=Math.max(level,Math.abs(x));}
    energy[i]=frame;rolling+=frame;if(i>=win)rolling-=energy[i-win];if(i>=win-1)maxWindow=Math.max(maxWindow,rolling/win);
    if(level>.000316){first=Math.min(first,i);last=i;}
    if(i>=buf.length-Math.round(buf.sampleRate*.01))tail=Math.max(tail,level);
   }
   return {duration:+buf.duration.toFixed(3),channels:channels.length,peak:db(peak),rms:db(Math.sqrt(sum/(buf.length*channels.length))),max50:db(Math.sqrt(maxWindow)),dc:+(dc/(buf.length*channels.length)).toFixed(6),clipped,leading:+(first/buf.sampleRate).toFixed(3),trailing:+((buf.length-1-last)/buf.sampleRate).toFixed(3),tailPeak:db(tail)};
  }
  const recordings=[];
  const ac=new AudioContext();
  for(const [kind,manifest] of [['sfx',SFX_SAMPLES],['amb',AMBIENCE_SAMPLES]])for(const [id,entry] of Object.entries(manifest))for(const file of entry.files){
   if(!include(id))continue;
   try{const response=await fetch(sampleUrl(file));if(!response.ok)throw Error(String(response.status));const b=await ac.decodeAudioData(await response.arrayBuffer());
    let loop;
    if(kind==='amb'){
     const from=Math.round(entry.loopStart*b.sampleRate),to=Math.round(entry.loopEnd*b.sampleRate);
     if(from<0||to>b.length||from>=to)throw Error('loop boundaries outside decoded audio');
     let jump=0,adjacent=0;
     for(let ch=0;ch<b.numberOfChannels;ch++){
      const d=b.getChannelData(ch);jump=Math.max(jump,Math.abs(d[from]-d[to-1]));
      for(const boundary of [from,to])for(let i=Math.max(1,boundary-2400);i<Math.min(d.length,boundary+2400);i++)adjacent=Math.max(adjacent,Math.abs(d[i]-d[i-1]));
     }
     loop={start:entry.loopStart,end:entry.loopEnd,jumpDb:db(jump),localAdjacentDb:db(adjacent),excessDb:+(db(jump)-db(adjacent)).toFixed(2)};
    }
    recordings.push({kind,id,file,...measure(b),...(loop?{loop}:{})});}catch(e){recordings.push({kind,id,file,error:String(e)});}
  }
  await ac.close();
  const synthesis=[];
  for(const [id,recipe] of Object.entries({...SFX_RECIPES,phone_tick:{play:phoneTick,jitter:0}})){
   if(!include(id))continue;
   try{
    // Three fixed seeds expose randomized parameter ranges reproducibly.
    for(const rate of rates)for(const seed of [17,83,211]){
     const original=Math.random;let state=seed;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
     const ac=new OfflineAudioContext(2,44100*16,44100), g=new Graph(ac),out=ac.createGain(),send=ac.createGain();out.gain.value=recipe.level??1;out.connect(ac.destination);
     let duration;try{duration=recipe.play({g,out,send,t:.05,p:rate,move:()=>{}});}finally{Math.random=original;}
     if(!Number.isFinite(duration)||duration<=0||duration>15)throw Error('invalid recipe duration: '+duration);
     const b=await ac.startRendering();const end=Math.min(b.length,Math.ceil((.05+duration)*b.sampleRate));const cut=new AudioBuffer({numberOfChannels:2,length:end,sampleRate:b.sampleRate});for(let ch=0;ch<2;ch++)cut.copyToChannel(b.getChannelData(ch).subarray(0,end),ch);
     let residualPeak=0,residualClipped=0;
     for(let ch=0;ch<b.numberOfChannels;ch++){
      const d=b.getChannelData(ch);
      for(let i=end;i<d.length;i++){
       if(!Number.isFinite(d[i]))throw Error('non-finite audio after reported endpoint');
       residualPeak=Math.max(residualPeak,Math.abs(d[i]));if(Math.abs(d[i])>=.999)residualClipped++;
      }
     }
     synthesis.push({id,seed,rate,reportedDuration:+duration.toFixed(3),...measure(cut),residualPeak:db(residualPeak),residualClipped});g.dispose();
    }
   }catch(e){synthesis.push({id,error:String(e)});}
  }
  const ambience=[];
  for(const id of Object.keys(AMBIENCE)){
   if(!include(id))continue;
   try{const ac=new OfflineAudioContext(2,44100*12,44100);const layer=startAmbience(ac,id,ac.destination,null);layer.fadeIn(.05);const b=await ac.startRendering();ambience.push({id,...measure(b)});layer.dispose();}catch(e){ambience.push({id,error:String(e)});}
  }
  return {date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date()),method:'Chrome OfflineAudioContext; dry recipe output with recipe.level, rates='+rates.join('/')+', seeds 17/83/211; recordings fully decoded, ambience synth 12-second excerpts; no perceptual listening',counts:{sfx:Object.keys(SFX).length,recordedSfx:Object.keys(SFX_SAMPLES).length,ambience:Object.keys(AMBIENCE).length},recordings,synthesis,ambience};
 },{ids:(process.env.AUDIT_IDS||'').split(',').map(id=>id.trim()).filter(Boolean),rates});
 fs.writeFileSync(process.argv[2] || 'audio-audit.json',JSON.stringify(result,null,2));
 const errors=[...result.recordings,...result.synthesis,...result.ambience].filter(x=>x.error);
 if(!result.recordings.length&&!result.synthesis.length&&!result.ambience.length)errors.push({id:'audit',error:'No sounds matched AUDIT_IDS'});
 console.log(JSON.stringify({counts:result.counts,recordings:result.recordings.length,synthesis:result.synthesis.length,ambience:result.ambience.length,errors}));
 await browser.close();
 if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1);});
