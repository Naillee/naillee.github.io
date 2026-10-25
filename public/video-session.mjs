// A single mounted player per gallery session; inactive slides have posters only.
export function createVideoSession(media,onChange=()=>{}) {
  let player=null,index=-1,soundOn=false,initialAttempted=false,disposed=false;
  const positions=new Map(), initialIndex=media.findIndex(item=>item.autoplayOnOpen===true);
  const emit=()=>{if(!disposed)onChange();};
  function release() {
    if(!player)return;
    positions.set(index,player.currentTime || 0);player.pause();player.removeAttribute('src');player.load();player.remove();player=null;index=-1;
  }
  function mount(next,host,{allowInitialAutoplay=true}={}) {
    if(disposed)return;
    const item=media[next];
    if(item?.kind!=='video'){release();emit();return;}
    if(index!==next || !player){
      release();index=next;player=document.createElement('video');
      const current=player;
      current.controls=true;current.preload='metadata';current.playsInline=true;current.setAttribute('playsinline','');current.setAttribute('aria-label',item.alt || '项目视频');current.dataset.videoIndex=String(next);
      current.defaultMuted=true;current.muted=!soundOn;if(item.poster)current.poster=item.poster;
      current.addEventListener('play',()=>{
        if(disposed || current!==player){current.pause();return;}
        document.querySelectorAll('video').forEach(other=>{if(other!==current)other.pause();});emit();
      });
      for(const name of ['pause','ended','error'])current.addEventListener(name,emit);
      current.addEventListener('volumechange',()=>{if(current===player){soundOn=!current.muted;emit();}});
      current.addEventListener('loadedmetadata',()=>{const time=positions.get(next);if(time && Number.isFinite(current.duration))current.currentTime=Math.min(time,Math.max(0,current.duration-.05));emit();},{once:true});
      current.src=item.src;
    }
    if(player.parentElement!==host){
      const resume=!player.paused;host.replaceChildren(player);
      if(resume)player.play().catch(()=>emit());
    }
    if(next!==initialIndex)initialAttempted=true;
    if(next===initialIndex && allowInitialAutoplay && !initialAttempted){
      initialAttempted=true;player.muted=true;player.play().catch(()=>emit());
    }
    emit();return player;
  }
  return {
    mount,
    get element(){return player;},
    get index(){return index;},
    get state(){return {paused:player?.paused ?? true,ended:player?.ended ?? false,muted:player?.muted ?? !soundOn};},
    togglePlay(){if(!player)return;if(player.paused){if(player.ended)player.currentTime=0;player.play().catch(()=>emit());}else player.pause();},
    toggleSound(){soundOn=!soundOn;if(player)player.muted=!soundOn;emit();},
    pause(){player?.pause();},
    dispose(){disposed=true;release();positions.clear();soundOn=false;initialAttempted=false;}
  };
}
