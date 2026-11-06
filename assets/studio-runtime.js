/* Shared scroll scheduler. Read all geometry first, then commit all visual updates. */
(() => {
  'use strict';
  const tasks=new Map(),errors=[];
  let raf=0,lastY=scrollY,scrollActiveUntil=0;
  function flush(now){
    raf=0;if(document.hidden)return;
    const started=performance.now(),y=scrollY;
    const context={now,y,delta:y-lastY,width:innerWidth,height:innerHeight,total:document.documentElement.scrollHeight};
    lastY=y;
    const commits=[];
    for(const [name,measure] of tasks){
      try{const commit=measure(context);if(typeof commit==='function')commits.push([name,commit]);}
      catch(error){errors.push({task:name,phase:'measure'});}
    }
    for(const [name,commit] of commits){
      try{commit();}catch(error){errors.push({task:name,phase:'commit'});}
    }
    if(errors.length>20)errors.splice(0,errors.length-20);
    window.XPPerf?.recordWork(performance.now()-started);
  }
  function request(){if(!raf&&!document.hidden)raf=requestAnimationFrame(flush);}
  window.XPScroll={
    register(name,measure){tasks.set(name,measure);request();return()=>tasks.delete(name);},
    request,getTasks:()=>[...tasks.keys()],getErrors:()=>errors.slice(),isScrolling:()=>performance.now()<scrollActiveUntil
  };
  addEventListener('scroll',()=>{scrollActiveUntil=performance.now()+180;request();},{passive:true});
  addEventListener('resize',request,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{lastY=scrollY;request();}
  });
  if('ResizeObserver' in window)new ResizeObserver(request).observe(document.body);
  if(document.fonts)document.fonts.ready.then(request);

  // Local-only diagnostics. Not enabled in the normal portfolio.
  if(new URLSearchParams(location.search).get('perf')!=='1')return;
  const deltas=[],scrollDeltas=[],work=[],longTasks=[];
  let recording=false,frame=0,last=0,totalFrames=0,totalMs=0,hiddenBreaks=0,longTasksSupported=false;
  const percentile=(list,p)=>{if(!list.length)return null;const a=list.slice().sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*p)-1)];};
  function snapshot(){
    return {
      measured:totalFrames>0,measurement:'requestAnimationFrame callback timing; not GPU presentation timing',
      callbackFps:totalMs?Number((totalFrames*1000/totalMs).toFixed(1)):null,
      samples:totalFrames,visibleSamplingMs:Math.round(totalMs),rollingP95ms:percentile(deltas,.95),
      rollingP99ms:percentile(deltas,.99),rollingMaxMs:deltas.length?Math.max(...deltas):null,
      framesOver33ms:deltas.filter(n=>n>33.34).length,
      rollingSamples:deltas.length,scrollWorkP95ms:percentile(work,.95),
      scrollCallbackFps:scrollDeltas.length?Number((scrollDeltas.length*1000/scrollDeltas.reduce((a,b)=>a+b,0)).toFixed(1)):null,
      scrollFrameP95ms:percentile(scrollDeltas,.95),scrollSamples:scrollDeltas.length,
      longTaskCount:longTasksSupported?longTasks.length:null,hiddenBreaks,
      reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,
      activeScrollTasks:window.XPScroll.getTasks(),schedulerErrors:window.XPScroll.getErrors(),
      coverage:window.XPScrollCoverage?.()||[],
      quality:document.documentElement.classList.contains('effects-balanced')?'balanced':'full'
    };
  }
  function tick(now){
    frame=0;if(!recording||document.hidden){last=0;return;}
    if(last){
      const dt=now-last;totalFrames++;totalMs+=dt;deltas.push(dt);if(deltas.length>720)deltas.shift();
      if(window.XPScroll.isScrolling()){scrollDeltas.push(dt);if(scrollDeltas.length>720)scrollDeltas.shift();}
    }
    last=now;frame=requestAnimationFrame(tick);
  }
  function begin(){
    if(recording)return;recording=true;last=0;
    if(!document.hidden)frame=requestAnimationFrame(tick);render();
  }
  function stop(){recording=false;cancelAnimationFrame(frame);frame=0;last=0;render();}
  const api=window.XPPerf={snapshot,start:begin,stop,recordWork(ms){if(recording){work.push(ms);if(work.length>720)work.shift();}}};
  if('PerformanceObserver' in window){
    try{new PerformanceObserver(list=>{
      if(recording)for(const entry of list.getEntries()){longTasks.push(Math.round(entry.duration));if(longTasks.length>200)longTasks.shift();}
    }).observe({type:'longtask',buffered:false});longTasksSupported=true;}catch(error){longTasksSupported=false;}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenBreaks++;cancelAnimationFrame(frame);frame=0;last=0;}
    else if(recording&&!frame)frame=requestAnimationFrame(tick);
  });
  const panel=document.createElement('aside');panel.className='perf-panel';panel.setAttribute('aria-label','本机滚动性能记录');
  panel.innerHTML='<div class="perf-panel-top"><strong>本机性能记录</strong><button data-perf-fold aria-label="收起性能面板">−</button></div><div class="perf-panel-body"><p>滚动整页，并切换左侧四项功能。</p><dl><div><dt>帧回调 FPS</dt><dd data-perf-fps>—</dd></div><div><dt>P95 帧间隔</dt><dd data-perf-p95>—</dd></div><div><dt>长任务</dt><dd data-perf-long>—</dd></div><div><dt>滚动计算 P95</dt><dd data-perf-work>—</dd></div></dl><p data-perf-state>等待采样</p><div class="perf-actions"><button data-perf-record>暂停记录</button><button data-perf-quality>精简特效</button><button data-perf-export>导出记录</button></div><small>数据仅保存在当前页面。FPS 为浏览器帧回调频率。</small></div>';
  document.body.append(panel);
  const scrollMetric=document.createElement('div');
  scrollMetric.innerHTML='<dt>滚动帧回调 FPS</dt><dd data-perf-scroll>—</dd>';
  panel.querySelector('dl').append(scrollMetric);
  const $=s=>panel.querySelector(s),fmt=n=>n===null?'—':n.toFixed(1);
  function render(){
    const data=snapshot();
    $('[data-perf-fps]').textContent=fmt(data.callbackFps);
    $('[data-perf-p95]').textContent=fmt(data.rollingP95ms)+' ms';
    $('[data-perf-long]').textContent=data.longTaskCount===null?'不支持':String(data.longTaskCount);
    $('[data-perf-scroll]').textContent=fmt(data.scrollCallbackFps);
    $('[data-perf-work]').textContent=fmt(data.scrollWorkP95ms)+' ms';
    $('[data-perf-state]').textContent=(recording?'记录中 · ':'已暂停 · ')+data.samples+' 帧样本';
    $('[data-perf-record]').textContent=recording?'暂停记录':'继续记录';
  }
  $('[data-perf-record]').addEventListener('click',()=>recording?stop():begin());
  $('[data-perf-fold]').addEventListener('click',()=>panel.classList.toggle('perf-folded'));
  $('[data-perf-quality]').addEventListener('click',()=>{
    const balanced=document.documentElement.classList.toggle('effects-balanced');
    $('[data-perf-quality]').textContent=balanced?'完整特效':'精简特效';
    dispatchEvent(new Event('xp-qualitychange'));window.XPScroll.request();
  });
  $('[data-perf-export]').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='xp-studio-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const interval=setInterval(()=>{if(!document.hidden&&!panel.classList.contains('perf-folded'))render();},1000);
  addEventListener('pagehide',()=>{stop();clearInterval(interval);});
  begin();
})();
