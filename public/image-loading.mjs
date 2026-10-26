// No src on distant slides: browser lazy-load heuristics cannot fetch the full rail.
export function nearbyIndexes(index,total,radius=1){return Array.from({length:total},(_,i)=>i).filter(i=>Math.abs(i-index)<=radius);}
export function activateNearbyImages(container,index){
 for(const i of nearbyIndexes(index,container.children.length)){
  const img=container.children[i]?.querySelector('img[data-src]');if(!img)continue;
  img.loading='eager';img.fetchPriority=i===index?'high':'low';img.src=img.dataset.src;delete img.dataset.src;
 }
}
