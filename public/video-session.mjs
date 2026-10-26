// A gallery owns one player. Merely opening or changing slides never sets a video src.
export function videoSourcesFor(item) {
  if(item?.kind!=='video')return {};
  const supplied=item.videoSources || {};
  const sources={};
  if(supplied['720p'] || item.src)sources['720p']=supplied['720p'] || item.src;
  if(supplied['1080p'] && supplied['1080p']!==sources['720p'])sources['1080p']=supplied['1080p'];
  return sources;
}
export function createVideoSession(media,onChange=()=>{}) {
  let player=null,index=-1,soundOn=false,volume=1,quality='720p',loaded=false,disposed=false,removeRestore=null;
  const positions=new Map(),qualities=new Map();
  const emit=()=>{if(!disposed)onChange();};
  function release() {
    if(!player)return;
    positions.set(index,loaded ? player.currentTime : positions.get(index) || 0);
    volume=player.volume;removeRestore?.();removeRestore=null;
    player.pause();player.removeAttribute('src');player.load();player.remove();player=null;index=-1;loaded=false;
  }
  function loadSource({time=positions.get(index)||0,resume=false}={}) {
    if(!player)return;
    const current=player,src=videoSourcesFor(media[index])[quality];if(!src)return;
    removeRestore?.();
    const restore=()=>{
      if(disposed || player!==current)return;
      if(time>0 && Number.isFinite(current.duration))current.currentTime=Math.min(time,Math.max(0,current.duration-.05));
      emit();
    };
    current.addEventListener('loadedmetadata',restore,{once:true});
    removeRestore=()=>current.removeEventListener('loadedmetadata',restore);
    current.src=src;loaded=true;current.load();
    if(resume)current.play().catch(()=>emit());
    emit();
  }
  function mount(next,host) {
    if(disposed)return;
    const item=media[next];
    if(item?.kind!=='video'){release();emit();return;}
    if(index!==next || !player){
      release();index=next;quality=qualities.get(next)||'720p';player=document.createElement('video');
      const current=player;
      current.controls=true;current.preload='none';current.playsInline=true;current.setAttribute('playsinline','');current.setAttribute('aria-label',item.alt || '项目视频');current.dataset.videoIndex=String(next);
      current.defaultMuted=true;current.muted=!soundOn;current.volume=volume;if(item.poster)current.poster=item.poster;
      current.addEventListener('click',()=>{if(current===player && !loaded)loadSource({resume:true});});
      current.addEventListener('play',()=>{
        if(disposed || current!==player){current.pause();return;}
        document.querySelectorAll('video').forEach(other=>{if(other!==current)other.pause();});emit();
      });
      for(const name of ['pause','ended','error'])current.addEventListener(name,emit);
      current.addEventListener('volumechange',()=>{if(current===player){soundOn=!current.muted;volume=current.volume;emit();}});
    }
    if(player.parentElement!==host){
      const resume=loaded&&!player.paused;host.replaceChildren(player);
      if(resume)player.play().catch(()=>emit());
    }
    emit();return player;
  }
  return {
    mount,
    get element(){return player;},
    get index(){return index;},
    get state(){return {paused:player?.paused ?? true,ended:player?.ended ?? false,muted:player?.muted ?? !soundOn,quality,qualities:Object.keys(videoSourcesFor(media[index])),loaded};},
    togglePlay(){if(!player)return;if(!loaded){loadSource({resume:true});return;}if(player.paused){if(player.ended)player.currentTime=0;player.play().catch(()=>emit());}else player.pause();},
    setQuality(next){
      if(!player || next===quality || !videoSourcesFor(media[index])[next])return;
      const time=loaded ? player.currentTime : positions.get(index)||0,resume=loaded&&!player.paused;
      quality=next;qualities.set(index,next);
      if(loaded)loadSource({time,resume});else emit();
    },
    toggleSound(){soundOn=!soundOn;if(player)player.muted=!soundOn;emit();},
    pause(){player?.pause();},
    dispose(){disposed=true;release();positions.clear();qualities.clear();soundOn=false;}
  };
}
