// Confirmed featured-project phone reader; desktop and other pages keep the existing reader.
const confirmedProjects=new Set(['xiamen-fashion-week','island-transfer','visual-direction']);
export const eligible=({enabled,mobile,type,id})=>!!(enabled&&mobile&&type==='series'&&confirmedProjects.has(id));
export const isBackdropTap=p=>!!(p?.outside&&p.endedOutside&&!p.moved);
export const enabledFromSearch=search=>new URLSearchParams(search).get('mobileStudy')!=='0';
export function createMobileStudy({modal,content,route,back,close,align,saveStudy}) {
 const enabled=()=>enabledFromSearch(location.search);
 const projectStates=new Map();let stateId=null;
 let attached=false,events,css,actions,entry,collapsed=false,readTop=0,reading=false,guardUntil=0,pointer=null,toolbarLabel=null,toolbarText='';
 const allowed=()=>eligible({enabled:enabled(),mobile:matchMedia('(max-width:780px)').matches,...route()});
 function remember(){const scroll=modal.querySelector('.study-scroll');if(attached&&reading&&scroll)readTop=scroll.scrollTop;if(attached&&stateId)projectStates.set(stateId,{readTop,collapsed});}
 function detach(){
  if(!attached)return;
  remember(); saveStudy();
  const study=modal.querySelector('.study-panel');const lostFocus=actions?.contains(document.activeElement)||entry?.contains(document.activeElement);if(study)content.append(study);
  events?.abort();events=null;actions?.remove();entry?.remove();css?.remove();
  if(toolbarLabel?.isConnected)toolbarLabel.textContent=toolbarText;toolbarLabel=null;
  modal.classList.remove('mobile-study','ms-reading','ms-collapsed');
  const media=modal.querySelector('.media-panel');if(media)media.inert=!!(matchMedia('(max-width:780px)').matches&&route().study);
  attached=false;pointer=null;if(lostFocus)modal.querySelector('[data-study-close],[data-study]')?.focus({preventScroll:true});
 }
 function realign(){
  guardUntil=performance.now()+320;
  requestAnimationFrame(()=>{if(attached){align();updateEntry();}});
 }
 function updateEntry(){
  if(!entry)return;
  const image=modal.querySelector('.media-thumbnails [aria-pressed="true"] img');
  const thumb=entry.querySelector('img');if(image){thumb.src=image.src;thumb.hidden=false;}else thumb.hidden=true;
  entry.querySelector('span').textContent='查看项目影像 · '+(modal.querySelector('.counter')?.textContent||'');
 }
 function sync(){
  remember();
  if(!allowed()){detach();return;}
  const id=route().id;
  if(stateId!==id){const saved=projectStates.get(id);readTop=saved?.readTop||0;collapsed=saved?.collapsed||false;stateId=id;}
  const media=modal.querySelector('.media-panel');if(!media)return;
  if(!attached){
   attached=true;events=new AbortController();
   css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./mobile-study.css',import.meta.url).href;css.addEventListener('load',realign,{once:true});document.head.append(css);
   modal.classList.add('mobile-study');
   toolbarLabel=media.querySelector('.media-toolbar>span');toolbarText=toolbarLabel?.textContent||'';if(toolbarLabel)toolbarLabel.textContent='';
   actions=document.createElement('div');actions.className='ms-actions';
   actions.innerHTML='<button type="button" data-ms-collapse aria-expanded="true">收起影像</button>';
   entry=document.createElement('button');entry.type='button';entry.className='ms-entry';entry.dataset.msExpand='';
   entry.innerHTML='<img alt=""><span></span><span aria-hidden="true">↗</span>';
   media.append(entry,actions);
   const signal=events.signal;
   modal.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,outside:e.target===modal,x:e.clientX,y:e.clientY,moved:false};},{capture:true,signal});
   modal.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.moved=true;},{capture:true,passive:true,signal});
   modal.addEventListener('pointerup',e=>{if(pointer&&pointer.id===e.pointerId)pointer.endedOutside=e.target===modal;},{capture:true,signal});
   modal.addEventListener('pointercancel',()=>{pointer=null;},{capture:true,signal});
   modal.addEventListener('click',e=>{
    if(modal.querySelector('.media-lightbox'))return;
    if(e.target===modal){
     e.preventDefault();e.stopImmediatePropagation();
     if(isBackdropTap(pointer))close();pointer=null;return;
    }
    const button=e.target.closest('button');
    if(button?.matches('[data-ms-collapse],[data-ms-expand]')){
     e.preventDefault();e.stopImmediatePropagation();remember();collapsed=button.matches('[data-ms-expand]')?false:!collapsed;entry.hidden=!collapsed;updateEntry();
     if(collapsed)modal.querySelectorAll('video').forEach(v=>v.pause());
     modal.classList.toggle('ms-collapsed',collapsed);const toggle=actions.querySelector('[data-ms-collapse]');toggle.textContent=collapsed?'展开影像':'收起影像';toggle.setAttribute('aria-expanded',String(!collapsed));
     const pane=modal.querySelector('.study-scroll');if(pane)pane.scrollTop=readTop;
     realign();
    }
   },{capture:true,signal});
  }
  const study=modal.querySelector('.study-panel');reading=!!route().study;
  modal.classList.toggle('ms-reading',reading);modal.classList.toggle('ms-collapsed',reading&&collapsed);
  media.inert=false;
  if(study){const needsFocus=study.querySelector('.panel-bar')?.contains(document.activeElement);media.append(study);study.querySelector('.study-scroll').scrollTop=readTop;modal.querySelectorAll('video').forEach(v=>v.pause());if(needsFocus)actions.querySelector('[data-ms-collapse]').focus({preventScroll:true});}
  actions.hidden=!reading;entry.hidden=!(reading&&collapsed);
  actions.querySelector('[data-ms-collapse]').textContent=collapsed?'展开影像':'收起影像';
  actions.querySelector('[data-ms-collapse]').setAttribute('aria-expanded',String(!collapsed));
  updateEntry();realign();
 }
 return {beforeRender:detach,sync,updateMedia:updateEntry,get transitioning(){return attached&&performance.now()<guardUntil;}};
}
