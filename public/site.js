import { createVideoSession } from './video-session.mjs';
import { createMediaResolver } from './media-runtime.mjs';
const root = document.documentElement;
const modal = document.querySelector('#reader');
const content = modal.querySelector('.reader-content');
const storage = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k,v) { try { localStorage.setItem(k,String(v)); } catch {} } };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let responsiveMedia = new Map();
function applyResponsiveCovers() {
  document.querySelectorAll('.gallery-card img').forEach(img => {
    const variants = responsiveMedia.get(img.src);
    if (variants?.length) {
      img.srcset = variants.map(v => new URL(v.url.slice(1),new URL('./',import.meta.url)).href + ' ' + v.width + 'w').join(', ');
      img.sizes = Math.max(1,Math.ceil(img.clientWidth)) + 'px';
    }
  });
}
let data, currentView = null, currentFilter = null, active = null, opener = null, pageScroll = 0;
const mediaPositions = new Map(), studyPositions = new Map(), pagePositions = new Map();
let videoSession = null;
let lightbox = null, lightboxOpener = null, thumbnailDrag = null, thumbnailClickBlockedUntil = 0;
const route = () => { const [type,id,detail] = decodeURIComponent(location.hash.slice(1)).split('/'); return {type,id,study:detail === 'research'}; };
const find = (type,id) => (type === 'series' ? data.series : data.projects).find(item => item.id === id);
const mediaKey = () => active ? active.type + '/' + active.id : '';
const isMobile = () => matchMedia('(max-width:780px)').matches;
const icons = {
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.5 8.5 0 1 0 11.4 11.4Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
function syncTheme() {
  const dark = root.classList.contains('dark'), button = document.querySelector('.theme');
  button.setAttribute('aria-label',dark ? '当前暗色，切换为浅色' : '当前浅色，切换为暗色');
  button.title = dark ? '切换为浅色' : '切换为暗色';
  button.innerHTML = icon(dark ? 'moon' : 'sun');
}
root.classList.toggle('dark',storage.get('nl-v2-theme') === 'dark'); syncTheme();
document.querySelector('.theme').onclick = () => { root.classList.toggle('dark'); storage.set('nl-v2-theme',root.classList.contains('dark') ? 'dark' : 'light'); syncTheme(); };
function setWidth(value,remember = false) {
  const max = innerWidth, min = Math.min(560,max), width = Math.min(max,Math.max(min,value));
  root.style.setProperty('--canvas-width',width + 'px');
  document.querySelectorAll('.resize').forEach(h => { h.setAttribute('aria-valuenow',Math.round(width)); h.setAttribute('aria-valuemin',min); h.setAttribute('aria-valuemax',max); });
  if (remember) storage.set('nl-v3-width',width);
}
setWidth(Number(storage.get('nl-v3-width')) || 800);
for (const handle of document.querySelectorAll('.resize')) {
  handle.onpointerdown = event => {
    if (event.button !== 0) return;
    handle.setPointerCapture(event.pointerId); handle.classList.add('dragging'); document.body.classList.add('dragging');
    handle.onpointermove = e => setWidth(2 * Math.abs(e.clientX - innerWidth / 2));
    const end = () => { handle.onpointermove = null; handle.onpointerup = null; handle.onpointercancel = null; handle.classList.remove('dragging'); document.body.classList.remove('dragging'); setWidth(parseFloat(root.style.getPropertyValue('--canvas-width')),true); };
    handle.onpointerup = end; handle.onpointercancel = end;
  };
  handle.ondblclick = () => setWidth(800,true);
  handle.onkeydown = e => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault(); const sign = handle.classList.contains('left') ? -1 : 1;
    setWidth(e.key === 'Home' ? 800 : e.key === 'End' ? innerWidth : parseFloat(root.style.getPropertyValue('--canvas-width')) + sign * (e.key === 'ArrowRight' ? 24 : -24),true);
  };
}
addEventListener('resize',() => setWidth(Number(storage.get('nl-v3-width')) || 800));
function renderIndex() {
  document.querySelector('#series-list').innerHTML = data.home.featuredSeriesIds.map((id,i) => {
    const item = find('series',id);
    return `<button class="series-row" data-open-series="${esc(id)}"><h3>${esc(item.titleZh)}<sup class="series-number num">${String(i+1).padStart(2,'0')}</sup></h3><span class="series-meta">${esc(item.subtitle)}</span></button>`;
  }).join('');
}
function renderGallery() {
  const entries = data.gallery.filter(entry => {const p=find('work',entry.projectId);return p && !p.placeholder;});
  document.querySelector('.gallery-grid').innerHTML = entries.map((entry,i) => {
    const p=find('work',entry.projectId),m=p.cover || p.media[entry.mediaIndex || 0];
    return `<button class="gallery-card" data-open-work="${esc(p.id)}" data-media-start="0" data-aspect="${m.width/m.height}" data-size="${entry.size || 'regular'}" aria-label="查看${esc(p.titleZh)}"><figure><img src="${esc(m.src)}" alt="${esc(m.alt)}" width="${m.width}" height="${m.height}" ${i<3?'fetchpriority="high"':'loading="lazy"'} decoding="async"></figure></button>`;
  }).join('');
  document.querySelector('#empty-state').hidden=entries.length>0;
  document.querySelector('#empty-state').textContent='项目正在整理。';
  requestAnimationFrame(layoutGallery);
}
function layoutGallery() {
  if(currentView!=='gallery')return;
  const grid=document.querySelector('.gallery-grid'),width=grid.clientWidth;if(!width)return;
  const columns=width>=680?3:width>=260?2:1,gap=width<500?16:28,track=(width-gap*(columns-1))/columns,heights=Array(columns).fill(0);let lastY=0;
  grid.querySelectorAll('.gallery-card').forEach(card=>{
    const ratio=Number(card.dataset.aspect),span=Math.min(columns,card.dataset.size==='large' && ratio>1?2:1);
    let col=0,y=Infinity;
    for(let start=0;start<=columns-span;start++){const top=Math.max(lastY,...heights.slice(start,start+span));if(top<y){y=top;col=start;}}
    const itemWidth=track*span+gap*(span-1);
    card.style.width=itemWidth+'px';card.style.left=col*(track+gap)+'px';card.style.top=y+'px';
    for(let i=col;i<col+span;i++)heights[i]=y+itemWidth/ratio+gap;
    lastY=y;
  });
  grid.style.height=Math.max(0,Math.max(...heights)-gap)+'px'; applyResponsiveCovers();
}
new ResizeObserver(layoutGallery).observe(document.querySelector('.gallery-main'));
function paintView() {
  const params = new URLSearchParams(location.search), view = params.get('view') === 'gallery' ? 'gallery' : 'index';
  const category = '全部';
  const changed = currentView !== view, filtered = currentFilter !== category;
  if (changed && currentView) pagePositions.set(currentView,modal.open ? pageScroll : scrollY);
  currentView = view; currentFilter = category;
  document.body.classList.toggle('is-gallery',view === 'gallery');
  document.querySelector('.index-view').hidden = view !== 'index'; document.querySelector('.gallery-view').hidden = view !== 'gallery';
  document.querySelector('[data-view]').setAttribute('aria-pressed',String(view === 'gallery'));
  const viewLabel = view === 'gallery' ? '回到首页' : '全部项目';
  const viewLabelEn = view === 'gallery' ? 'Index View' : 'Gallery View';
  const viewHelp = view === 'gallery' ? '返回首页 · 主要项目' : '切换到全部项目';
  document.querySelector('.view-label-zh').textContent = viewLabel;
  document.querySelector('.view-label-en').textContent = viewLabelEn;
  document.querySelector('[data-view]').setAttribute('aria-label',viewLabelEn + '，' + viewHelp);
  document.querySelector('#view-help').textContent = viewHelp;
  if (view === 'gallery' && (changed || filtered)) renderGallery();
  if (changed) requestAnimationFrame(() => scrollTo(0,pagePositions.get(view) || 0));
}
function changeView(view) {
  const url = new URL(location.href); url.hash = ''; url.search = view === 'gallery' ? '?view=gallery' : '';
  history.pushState({nlDepth:0},'',url); renderRoute();
}
function saveStudy() { const pane = modal.querySelector('.study-scroll'); if (pane && active?.type === 'series') studyPositions.set(active.id,pane.scrollTop); }
function navigate(hash) { saveStudy(); history.pushState({nlDepth:(history.state?.nlDepth || 0)+1},'',location.pathname + location.search + hash); renderRoute(); }
function back() {
  saveStudy();
  if (history.state?.nlDepth > 0) history.back();
  else { const r = route(); history.replaceState({nlDepth:0},'',location.pathname + location.search + (r.study ? '#series/' + r.id : '')); renderRoute(); }
}
function closeAll() {
  saveStudy(); const depth = history.state?.nlDepth || 0;
  if (depth > 0) history.go(-depth); else { history.replaceState({nlDepth:0},'',location.pathname + location.search); renderRoute(); }
}
function pauseMedia() { modal.querySelectorAll('video').forEach(v => v.pause()); }
function openShell() {
  if (modal.open) return;
  opener = document.activeElement; pageScroll = scrollY; document.body.style.overflow = 'hidden'; document.body.classList.add('has-reader'); modal.showModal();
}
function closeShell() {
  videoSession?.dispose(); videoSession = null;
  closeLightbox(false);
  if (!modal.open && !active && !document.body.classList.contains('has-reader')) return;
  pauseMedia(); if (modal.open) modal.close(); document.body.style.overflow = ''; document.body.classList.remove('has-reader'); scrollTo(0,pageScroll);
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true});
  active = null; content.innerHTML = '';
}
function videoPreview(m,i) {
  return `<button class="video-preview" data-video-play data-video-index="${i}" aria-label="播放视频${String(i+1).padStart(2,'0')}"><img src="${esc(m.poster || '')}" alt="" draggable="false"><span aria-hidden="true">▷</span></button>`;
}
function fillVideoPosters(p) {
  modal.querySelectorAll('.media-slide').forEach((slide,i)=>{
    if(p.media[i]?.kind==='video' && !slide.firstElementChild)slide.innerHTML=videoPreview(p.media[i],i);
  });
}
function updateVideoControls() {
  const p=active && active.type!=='about' ? find(active.type,active.id) : null;
  const isVideo=!!(videoSession && p?.media[mediaPositions.get(mediaKey()) || 0]?.kind==='video');
  modal.querySelectorAll('.video-actions').forEach(group=>{
    group.hidden=!isVideo;
    if(!isVideo)return;
    const state=videoSession.state, play=group.querySelector('[data-video-play]'), sound=group.querySelector('[data-video-sound]');
    if(play){play.textContent=state.paused ? (state.ended ? '重播' : '播放') : '暂停';play.setAttribute('aria-label',state.paused ? '播放视频' : '暂停视频');}
    if(sound){sound.textContent=state.muted ? '开声' : '静音';sound.setAttribute('aria-label',state.muted ? '开启声音' : '关闭声音');sound.setAttribute('aria-pressed',String(!state.muted));}
  });
}
function mediaMarkup(p,type) {
  if (p.document) return `<section class="panel media-panel proposal-panel" aria-label="方案阅读"><div class="media-toolbar"><span>方案策划</span><button data-close-all aria-label="关闭方案">关闭</button></div><iframe class="proposal-document" src="${esc(p.document)}" title="${esc(p.titleZh)}完整方案"></iframe><div class="media-footer"><h2>${esc(p.titleZh)}</h2><a href="${esc(p.document)}" target="_blank" rel="noopener">打开完整方案 PDF</a></div></section>`;
  const year = type === 'series' ? (p.subtitle || '') : p.year || (p.placeholder ? '内容待补充' : '集合影像');
  const thumbnails = p.media.map((m,index) => `<button type="button" data-media-select="${index}" aria-label="查看第${index+1}项：${esc(m.caption || m.alt || '项目媒体')}" aria-pressed="false">${m.kind !== 'video' || m.poster ? `<img src="${esc(m.thumbnail || (m.kind === 'video' ? m.poster : m.src))}" alt="" draggable="false" loading="lazy">` : '<span>视频</span>'}${m.kind === 'video' ? '<span class="thumbnail-video">视频</span>' : ''}</button>`).join('');
  return `<section class="panel media-panel ${type === 'work' ? 'is-work' : ''}" aria-label="项目影像"><div class="media-toolbar"><span>${type === 'series' ? '集合影像' : ''}</span><div>${history.state?.nlDepth > 1 ? '<button data-back>返回</button>' : ''}<button data-close-all aria-label="关闭项目影像">关闭</button></div></div><div class="media-window"></div><div class="media-controls"><div class="video-actions" hidden><button data-video-play aria-label="播放视频">播放</button><button data-video-sound aria-label="开启声音">开声</button><button data-video-expand aria-label="放大查看视频">放大</button></div><div><button data-prev aria-label="上一张">‹</button><span class="counter num"></span><button data-next aria-label="下一张">›</button></div></div><div class="media-thumbnails" tabindex="0" role="group" aria-label="媒体缩略图，可横向滚动或拖动">${thumbnails}</div><div class="media-footer"><div><h2>${esc(p.titleZh)}</h2>${type === 'series' ? `<span class="year">${esc(year)}</span>` : ''}</div>${type === 'series' ? '<button class="study-toggle" data-study aria-expanded="false">项目研读</button>' : ''}</div></section>`;
}
const mediaCount = (index,total) => `${String(total ? index+1 : 0).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
function paintMedia(align = true) {
  const p = find(active.type,active.id); if (p.document) return;
  const list = p.media;
  const index = Math.max(0,Math.min(list.length-1,mediaPositions.get(mediaKey()) || 0)); mediaPositions.set(mediaKey(),index);
  const windowEl = modal.querySelector('.media-window');
  windowEl.classList.toggle('has-video',!!videoSession);
  if (!windowEl.children.length) {
    windowEl.innerHTML = list.map((m,i) => `<div class="media-slide" style="--media-ratio:${Number(m.width)/Number(m.height) || 1.5}">${m.kind === 'video' ? videoPreview(m,i) : `<img src="${esc(m.src)}" alt="${esc(m.alt)}" data-media-index="${i}" loading="${i===index?'eager':'lazy'}" decoding="async" tabindex="0" draggable="false" aria-label="${esc(m.alt)}，点击放大">`}</div>`).join('');
    windowEl.addEventListener('scroll',() => {
      if (windowEl._scrollFrame) return;
      const ownerKey=mediaKey();
      windowEl._scrollFrame = requestAnimationFrame(() => {
        windowEl._scrollFrame = null;
        if(!windowEl.isConnected || ownerKey!==mediaKey())return;
        const slides = [...windowEl.children], left = windowEl.scrollLeft + windowEl.clientWidth/2;
        const nearest = slides.reduce((best,slide,i) => Math.abs(slide.offsetLeft-windowEl.offsetLeft+slide.clientWidth/2-left) < Math.abs(slides[best].offsetLeft-windowEl.offsetLeft+slides[best].clientWidth/2-left) ? i : best,0);
        if (nearest !== (mediaPositions.get(mediaKey()) || 0)) { mediaPositions.set(mediaKey(),nearest); paintMedia(false); }
      });
    },{passive:true});
  }
  if (align) {
    if (!videoSession) pauseMedia();
    const slide = windowEl.children[index];
    if (slide) windowEl.scrollLeft = slide.offsetLeft-windowEl.offsetLeft-(windowEl.clientWidth-slide.clientWidth)/2;
  }
  const selectedImage=windowEl.children[index]?.querySelector('img[data-media-index]');if(selectedImage){selectedImage.loading='eager';selectedImage.fetchPriority='high';}
  if (videoSession && !lightbox) videoSession.mount(index,windowEl.children[index],{allowInitialAutoplay:!(isMobile() && route().study)});
  if (videoSession) fillVideoPosters(p);
  updateVideoControls();
  modal.querySelector('.counter').textContent = mediaCount(index,list.length);
  modal.querySelector('[data-prev]').disabled = index <= 0; modal.querySelector('[data-next]').disabled = index >= list.length-1;
  const track = modal.querySelector('.media-thumbnails');
  track.querySelectorAll('[data-media-select]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.mediaSelect) === index)));
  const selected = track.querySelector('[aria-pressed="true"]');
  if (selected) {
    const item = selected.getBoundingClientRect(), bounds = track.getBoundingClientRect();
    if (item.left < bounds.left) track.scrollLeft += item.left-bounds.left;
    else if (item.right > bounds.right) track.scrollLeft += item.right-bounds.right;
  }
}
function changeMedia(direction) { mediaPositions.set(mediaKey(),(mediaPositions.get(mediaKey()) || 0)+direction); paintMedia(); if (lightbox) paintLightbox(); }
function paintLightbox() {
  const p = find(active.type,active.id), index = mediaPositions.get(mediaKey()) || 0, m = p.media[index];
  const viewport = lightbox.querySelector('.lightbox-window'); viewport.classList.remove('is-zoomed');
  if (m.kind === 'video' && videoSession) {
    videoSession.mount(index,viewport,{allowInitialAutoplay:false});fillVideoPosters(p);
  } else {
    videoSession?.mount(index,viewport,{allowInitialAutoplay:false});
    viewport.innerHTML = `<img src="${esc(m.src)}" alt="${esc(m.alt)}" tabindex="0" aria-label="${esc(m.alt)}，按实际像素查看">`;
  }
  updateVideoControls();
  lightbox.querySelector('.lightbox-caption').textContent = p.titleZh;
  lightbox.querySelector('.lightbox-count').textContent = mediaCount(index,p.media.length);
  lightbox.querySelector('[data-lightbox-prev]').disabled = index <= 0;
  lightbox.querySelector('[data-lightbox-next]').disabled = index >= p.media.length-1;
}
function openLightbox(image) {
  if (lightbox) return;
  mediaPositions.set(mediaKey(),Number(image?.dataset.mediaIndex ?? mediaPositions.get(mediaKey()) ?? 0)); paintMedia();
  lightboxOpener = image; content.inert = true; modal.querySelector('.split-handle').inert = true;
  lightbox = document.createElement('section'); lightbox.className = 'panel media-lightbox'; lightbox.setAttribute('role','dialog'); lightbox.setAttribute('aria-modal','true'); lightbox.setAttribute('aria-label','放大查看项目媒体');
  lightbox.innerHTML = '<header class="lightbox-bar"><span class="lightbox-caption"></span><button data-lightbox-close aria-label="关闭放大查看">关闭</button></header><div class="lightbox-window"></div><footer class="lightbox-bar"><div class="video-actions" hidden><button data-video-play aria-label="播放视频">播放</button><button data-video-sound aria-label="开启声音">开声</button></div><button data-lightbox-prev aria-label="放大查看上一项">‹</button><span class="lightbox-count num"></span><button data-lightbox-next aria-label="放大查看下一项">›</button></footer>';
  modal.append(lightbox); paintLightbox(); lightbox.querySelector('[data-lightbox-close]').focus({preventScroll:true});
}
function closeLightbox(restoreFocus=true) {
  if (!lightbox) return;
  if (videoSession) { videoSession.pause(); const i=mediaPositions.get(mediaKey()) || 0; const slide=modal.querySelectorAll('.media-slide')[i]; if(slide)videoSession.mount(i,slide,{allowInitialAutoplay:false}); }
  lightbox.querySelectorAll('video').forEach(video => video.pause()); lightbox.remove(); lightbox = null;
  content.inert = false; modal.querySelector('.split-handle').inert = false;
  if (restoreFocus) (modal.querySelector(`.media-window img[data-media-index="${mediaPositions.get(mediaKey()) || 0}"]`) || lightboxOpener)?.focus({preventScroll:true});
  lightboxOpener = null; updateVideoControls();
}
function studyMarkup(p) {
  const study = p.caseStudy;
  const figure = image => `<figure class="study-figure${image.layout === 'portrait' ? ' study-figure--portrait' : ''}${image.presentation === 'composite' ? ' study-figure--composite' : ''}" style="--study-image-ratio:${Number(image.width)/Number(image.height)}"><a href="${esc(image.src)}" target="_blank" rel="noopener" aria-label="查看大图：${esc(image.alt)}"><img src="${esc(image.src)}" alt="${esc(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"></a></figure>`;
  const heading = study
    ? `<header class="case-study-header"><h2>${esc(study.title)}</h2><p class="case-study-subtitle">${esc(study.subtitle)}</p>${(study.introParagraphs || [study.intro]).map(text => `<p class="study-lead">${esc(text)}</p>`).join('')}${study.openingImage ? figure(study.openingImage) : ''}</header>`
    : `<p class="draft-note">${p.placeholder ? '叙事结构示意 · 内容待补充' : '研读草稿 · 个人贡献与正式文案待补充'}</p><h2>${esc(p.titleZh)}</h2><p class="study-lead">${esc(p.summary)}</p>`;
  const chapters = p.research.map((b,i) => {
    const chapterImage = p.media.find(m => m.id === b.mediaId);
    const paragraphs = (b.paragraphs || [b.text]).map((text,index) => {
      const images = (b.images || []).filter(image => image.afterParagraph === index+1);
      const visuals = images.map(figure).join('');
      return `<p>${esc(text)}</p>${b.imageLayout === 'strip' && images.length > 1 ? `<div class="study-gallery"><div class="study-image-strip" tabindex="0" role="group" aria-label="${esc(b.heading)}配图，可左右滚动">${visuals}</div></div>` : visuals}`;
    }).join('');
    const placeholder = b.placeholderLabel ? `<figure class="study-media-placeholder" aria-label="${esc(b.placeholderLabel)}"><figcaption>${esc(b.placeholderLabel)}</figcaption></figure>` : '';
    return `<section class="study-chapter"${b.id ? ` data-chapter-id="${esc(b.id)}"` : ''}><span class="chapter-number num">${String(i+1).padStart(2,'0')}</span><h3>${esc(b.heading)}</h3>${paragraphs}${chapterImage ? `<img src="${esc(chapterImage.src)}" alt="${esc(chapterImage.alt)}" loading="lazy">` : ''}${placeholder}${b.evidence ? `<p class="source-note">${esc(b.evidence)}</p>` : ''}</section>`;
  }).join('');
  const note = study?.note ? `<aside class="case-study-note" aria-label="名称说明"><p>${esc(study.note)}</p></aside>` : '';
  const related = study?.showRelated === false ? '' : `<section class="related"><h3>相关项目</h3>${p.relatedProjectIds.map(id => find('work',id)).filter(Boolean).map(item => `<button data-open-work="${esc(item.id)}"><span>${esc(item.titleZh)}</span><span class="num">${item.year || '待补充'}</span></button>`).join('')}</section>`;
  return `<aside class="panel study-panel" aria-label="项目研读"><header class="panel-bar"><span>项目研读</span><button data-study-close aria-label="关闭研读，返回影像">关闭</button></header><div class="study-scroll${study ? ' case-study-reading' : ''}" tabindex="0">${study ? '<article class="case-study-article">' : ''}${heading}${chapters}${note}${related}${study ? '</article>' : ''}</div></aside>`;
}
function aboutMarkup() {
  const profile = data.profile;
  const paragraphs = values => (values || []).map(text => `<p>${esc(text)}</p>`).join('');
  const resumeSection = (id,heading,body) => `<section class="about-resume-section" aria-labelledby="about-${id}"><h3 id="about-${id}">${heading}</h3>${body}</section>`;
  const contacts = profile.contacts.map(contact => contact.type === 'qr'
    ? `<details class="about-qr" data-contact-id="${esc(contact.id)}"><summary>${esc(contact.label)}</summary><img src="${esc(contact.image)}" alt="${esc(contact.label)}二维码" loading="lazy"></details>`
    : `<div class="about-contact" data-contact-id="${esc(contact.id)}"><span class="contact-label">${esc(contact.label)}</span><a href="${esc(contact.href)}">${esc(contact.value)}</a></div>`).join('');
  const overview = (profile.about || []).map(item => `<div class="resume-block" data-profile-id="${esc(item.id)}"><h4>${esc(item.heading)}</h4><p>${esc(item.text)}</p></div>`).join('');
  const experience = profile.experience.map(job => `<article class="resume-job" data-experience-id="${esc(job.id)}">
    <header class="resume-job-header"><h4>${esc(job.company)}</h4><p class="resume-job-meta"><span>${esc(job.period)}</span><span class="resume-role">${esc(job.role)}</span></p></header>
    ${job.introduction ? `<p class="resume-job-intro">${esc(job.introduction)}</p>` : ''}
    ${job.sections.map(section => `<section class="resume-job-section" data-section-id="${esc(section.id)}"><h5>${esc(section.heading)}</h5>${paragraphs(section.paragraphs)}${section.items?.length ? `<ul class="resume-projects">${section.items.map(item => `<li>${item.heading ? `<h6>${esc(item.heading)}</h6>` : ''}<p>${esc(item.text)}</p></li>`).join('')}</ul>` : ''}</section>`).join('')}
  </article>`).join('');
  const education = profile.education.map(item => `<article class="resume-block" data-education-id="${esc(item.id)}"><h4>${esc(item.school)}</h4><p class="resume-education-meta"><span>${esc(item.degree)}</span><span>${esc(item.period)}</span></p><p>${esc(item.description)}</p></article>`).join('');
  const skills = profile.skills.map(item => `<div class="resume-block" data-skill-id="${esc(item.id)}"><h4>${esc(item.label)}</h4><p>${esc(item.text)}</p></div>`).join('');
  const languages = profile.languages.map(item => `<p data-language-id="${esc(item.id)}">${esc(item.text)}</p>`).join('');
  const honors = profile.honors.map(item => {
    const company = profile.experience.find(job => job.id === item.companyId);
    return `<article class="resume-block" data-honor-id="${esc(item.id)}"><h4>${esc(company?.company)}</h4><p>${esc(item.text)}</p></article>`;
  }).join('');
  return `<section class="panel about-panel" aria-label="关于我">
    <header class="panel-bar"><span class="en">About</span><button data-close-all aria-label="关闭关于我">关闭</button></header>
    <div class="about-scroll"><div class="about-section about-resume-layout">
      <aside class="about-label" aria-label="联系方式与简历">
        <div class="about-contacts">${contacts}${profile.resumePdf ? `<a class="resume-download" href="${esc(profile.resumePdf)}" download="${esc(profile.resumeFileName)}">下载简历 <span class="en">PDF</span></a>` : ''}</div>
      </aside>
      <img class="about-portrait" src="${esc(profile.portrait)}" alt="${esc(profile.name)}个人肖像">
      <div class="about-copy">
        <section class="about-overview" aria-label="个人介绍">${overview}</section>
        ${resumeSection('experience','工作经历',experience)}
        ${resumeSection('education','教育背景',education)}
        ${resumeSection('skills','专业技能',skills)}
        ${resumeSection('languages','语言',languages)}
        ${resumeSection('honors','任职荣誉',honors)}
      </div>
    </div></div>
  </section>`;
}
function renderRoute() {
  closeLightbox(false);
  paintView(); const r = route();
  if (!['series','work','about'].includes(r.type)) { closeShell(); return; }
  const previousStudy = modal.classList.contains('study-open');
  modal.classList.toggle('study-open',r.study && r.type === 'series');
  const split = modal.querySelector('.split-handle'); split.hidden = !(r.type === 'series' && r.study);
  if (r.type === 'about') {
    if (active?.type !== 'about') { videoSession?.dispose(); videoSession=null; pauseMedia(); content.innerHTML = aboutMarkup(); active = {type:'about',id:'about'}; }
    openShell(); return;
  }
  const p = find(r.type,r.id); if (!p) { closeShell(); return; }
  const changed = active?.id !== r.id || active?.type !== r.type;
  if (changed) { videoSession?.dispose(); videoSession=null; pauseMedia(); active = {type:r.type,id:r.id}; if(p.media.some(m=>m.kind==='video')){mediaPositions.set(mediaKey(),Math.max(0,p.media.findIndex(m=>m.autoplayOnOpen)));videoSession=createVideoSession(p.media,updateVideoControls);} content.innerHTML = mediaMarkup(p,r.type); paintMedia(); }
  const study = modal.querySelector('.study-panel');
  if (r.study && r.type === 'series') {
    if (!study) { content.insertAdjacentHTML('beforeend',studyMarkup(p)); modal.querySelector('.study-scroll').scrollTop = studyPositions.get(p.id) || 0; }
  } else study?.remove();
  const toggle = modal.querySelector('[data-study]'); if (toggle) toggle.setAttribute('aria-expanded',String(r.study));
  // Hidden desktop media must also leave the keyboard focus order on mobile.
  modal.querySelector('.media-panel').inert = !!(isMobile() && r.study);
  openShell();
  if(videoSession && !r.study){const index=mediaPositions.get(mediaKey()) || 0;videoSession.mount(index,modal.querySelectorAll('.media-slide')[index]);}
  if (r.study && (!previousStudy || changed)) modal.querySelector('[data-study-close]')?.focus({preventScroll:true});
  else if (previousStudy && !r.study) toggle?.focus({preventScroll:true});
}
document.addEventListener('click',event => {
  const button = event.target.closest('button'); if (!button || !data) return;
  if (button.matches('[data-video-play]')) { if(performance.now()<thumbnailClickBlockedUntil)return; const i=Number(button.dataset.videoIndex ?? mediaPositions.get(mediaKey()) ?? 0); if(i!==(mediaPositions.get(mediaKey()) || 0)){mediaPositions.set(mediaKey(),i);paintMedia();} videoSession?.togglePlay(); }
  else if (button.matches('[data-video-sound]')) videoSession?.toggleSound();
  else if (button.matches('[data-video-expand]')) openLightbox(button);
  else if (button.matches('[data-lightbox-close]')) closeLightbox();
  else if (button.matches('[data-lightbox-prev]')) changeMedia(-1);
  else if (button.matches('[data-lightbox-next]')) changeMedia(1);
  else if (button.matches('[data-about]')) navigate('#about');
  else if (button.matches('[data-home]')) { if (currentView === 'gallery') changeView('index'); else scrollTo({top:0,behavior:'smooth'}); }
  else if (button.matches('[data-view]')) changeView(currentView === 'gallery' ? 'index' : 'gallery');
  else if (button.matches('[data-open-series]')) navigate('#series/' + button.dataset.openSeries);
  else if (button.matches('[data-open-work]')) {
    if (button.dataset.mediaStart !== undefined) mediaPositions.set('work/' + button.dataset.openWork,Number(button.dataset.mediaStart));
    navigate('#work/' + button.dataset.openWork);
  }
  else if (button.matches('[data-close-all]')) { if (active?.type === 'work') back(); else closeAll(); }
  else if (button.matches('[data-back],[data-study-close]')) back();
  else if (button.matches('[data-study]')) { if (route().study) back(); else navigate('#series/' + active.id + '/research'); }
  else if (button.matches('[data-prev]')) changeMedia(-1);
  else if (button.matches('[data-next]')) changeMedia(1);
  else if (button.matches('[data-media-select]')) {
    if (performance.now() < thumbnailClickBlockedUntil) return;
    mediaPositions.set(mediaKey(),Number(button.dataset.mediaSelect)); paintMedia();
  }
});
modal.addEventListener('click',event => {
  if (lightbox) { if (event.target === modal) closeLightbox(); else if (event.target.matches('.lightbox-window img')) event.target.parentElement.classList.toggle('is-zoomed'); return; }
  if (event.target === modal) { if (active?.type === 'work') back(); else closeAll(); }
  else if (event.target.matches('.media-window .media-slide > img') && performance.now() >= thumbnailClickBlockedUntil) openLightbox(event.target);
});
modal.addEventListener('cancel',event => { event.preventDefault(); if (lightbox) closeLightbox(); else back(); });
modal.addEventListener('close',()=>{if(!modal.open){pauseMedia();videoSession?.dispose();videoSession=null;active=null;}});
modal.addEventListener('keydown',event => {
  if(event.key==='Escape' && !document.fullscreenElement){event.preventDefault();event.stopPropagation();if(lightbox)closeLightbox();else back();return;}
  if (lightbox) {
    if (event.target.matches('.lightbox-window img') && ['Enter',' '].includes(event.key)) { event.preventDefault(); event.target.parentElement.classList.toggle('is-zoomed'); }
    if (['ArrowLeft','ArrowRight'].includes(event.key) && !event.target.closest('video')) { event.preventDefault(); changeMedia(event.key === 'ArrowLeft' ? -1 : 1); }
    return;
  }
  if (event.target.matches('.media-window .media-slide > img') && ['Enter',' '].includes(event.key)) { event.preventDefault(); openLightbox(event.target); }
  if (['ArrowLeft','ArrowRight'].includes(event.key) && active?.type !== 'about' && !find(active?.type,active?.id)?.document && !event.target.closest('.study-panel,.split-handle,video,iframe')) {
    event.preventDefault(); changeMedia(event.key === 'ArrowLeft' ? -1 : 1);
    if (event.target.closest('.media-thumbnails')) modal.querySelector('.media-thumbnails [aria-pressed="true"]')?.focus({preventScroll:true});
  }
});
modal.addEventListener('pointerdown',event => {
  const track = event.target.closest('.media-thumbnails,.media-window');
  if (event.target.closest('video')) return;
  if (!track || event.pointerType === 'touch' || event.button !== 0) return;
  thumbnailDrag = {track,x:event.clientX,scroll:track.scrollLeft,pointerId:event.pointerId,moved:false};
});
modal.addEventListener('pointermove',event => {
  if (!thumbnailDrag) return;
  const drag = thumbnailDrag, distance = event.clientX-drag.x;
  if (!drag.moved && Math.abs(distance) < 6) return;
  if (!drag.moved) { drag.moved = true; drag.track.setPointerCapture(drag.pointerId); drag.track.classList.add('is-dragging'); }
  event.preventDefault(); drag.track.scrollLeft = drag.scroll-distance;
});
function endThumbnailDrag() {
  if (!thumbnailDrag) return;
  thumbnailDrag.track.classList.remove('is-dragging');
  if (thumbnailDrag.moved) thumbnailClickBlockedUntil = performance.now()+150;
  thumbnailDrag = null;
}
addEventListener('pointerup',endThumbnailDrag); addEventListener('pointercancel',endThumbnailDrag);
modal.addEventListener('wheel',event => {
  const track = event.target.closest('.media-thumbnails,.media-window');
  if (event.target.closest('video')) return;
  if (!track || track.scrollWidth <= track.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.preventDefault(); track.scrollLeft += event.deltaY;
},{passive:false});
const splitHandle = modal.querySelector('.split-handle');
function setSplit(value,remember=false) { const split = Math.max(30,Math.min(70,value)); root.style.setProperty('--split',split + '%'); splitHandle.setAttribute('aria-valuenow',Math.round(split)); if (remember) storage.set('nl-v3-split',split); }
setSplit(Number(storage.get('nl-v3-split')) || 50);
splitHandle.onpointerdown = e => {
  if (e.button !== 0) return;
  splitHandle.setPointerCapture(e.pointerId);
  splitHandle.classList.add('dragging'); document.body.classList.add('dragging');
  splitHandle.onpointermove = event => setSplit(event.clientX/innerWidth*100);
  const end = () => {
    splitHandle.onpointermove = null; splitHandle.onpointerup = null; splitHandle.onpointercancel = null;
    splitHandle.classList.remove('dragging'); document.body.classList.remove('dragging');
    setSplit(parseFloat(root.style.getPropertyValue('--split')),true);
  };
  splitHandle.onpointerup = end; splitHandle.onpointercancel = end;
};
splitHandle.onkeydown = e => { if (['ArrowLeft','ArrowRight','Home'].includes(e.key)) { e.preventDefault(); setSplit(e.key === 'Home' ? 50 : parseFloat(root.style.getPropertyValue('--split')) + (e.key === 'ArrowLeft' ? -2 : 2),true); } };
addEventListener('resize',() => { const media = modal.querySelector('.media-panel'); if (media) media.inert = !!(isMobile() && route().study); });
addEventListener('popstate',() => { if(data) { saveStudy(); renderRoute(); } }); addEventListener('hashchange',() => { if(data) renderRoute(); });
try {
  const response = await fetch('./content.preview.json'); if (!response.ok) throw new Error('Content could not be loaded');
  const registryResponse = await fetch(new URL('./media-registry.json',import.meta.url)); if (!registryResponse.ok) throw new Error('Media registry could not be loaded');
  const registry = await registryResponse.json();
  responsiveMedia = new Map(registry.map(m => [new URL(m.url.slice(1),new URL('./',import.meta.url)).href,m.variants]));
  const resolver = createMediaResolver(registry);
  data = resolver.hydrate(await response.json());
  document.querySelectorAll('[data-media-id]').forEach(element => element.setAttribute(element.tagName.toLowerCase() === 'image' ? 'href' : 'src',resolver.urlFor(element.dataset.mediaId)));
  const avatar = document.querySelector('.avatar img');
  avatar.src = data.profile.avatar; avatar.alt = data.profile.name;
  document.querySelector('.intro-copy').textContent = data.home.intro;
  // Give a direct link the same close/back hierarchy as entering from the index.
  const initialRoute = route();
  if (['series','work','about'].includes(initialRoute.type) && !history.state?.nlDepth) {
    const hash = location.hash, base = location.pathname + location.search;
    history.replaceState({nlDepth:0},'',base);
    if (initialRoute.type === 'series' && initialRoute.study) {
      history.pushState({nlDepth:1},'',base + '#series/' + initialRoute.id);
      history.pushState({nlDepth:2},'',base + hash);
    } else history.pushState({nlDepth:1},'',base + hash);
  }
  renderIndex(); renderRoute(); document.fonts.ready.then(layoutGallery);
} catch(error) { document.querySelector('#series-list').textContent = '内容暂时无法读取，请刷新页面。'; console.error(error); }

addEventListener('pagehide',()=>{if(videoSession){videoSession.dispose();videoSession=null;active=null;}pauseMedia();});
addEventListener('pageshow',event=>{if(event.persisted && data)renderRoute();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseMedia();});
