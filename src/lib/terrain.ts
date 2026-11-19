import type { TerrainData } from './types';
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function terrainXY(d:TerrainData,lon:number,lat:number):[number,number]{return[(lon-d.bounds[0])/(d.bounds[2]-d.bounds[0])*120-60,(d.bounds[3]-lat)/(d.bounds[3]-d.bounds[1])*100-50];}
export function terrainSampler(d:TerrainData){
 const min=Math.min(...d.heights),n=d.size;
 return(x:number,z:number)=>{const a=clamp((x+60)/120*(n-1),0,n-1),b=clamp((z+50)/100*(n-1),0,n-1),i=Math.min(n-2,Math.floor(a)),j=Math.min(n-2,Math.floor(b)),u=a-i,v=b-j;return((1-v)*((1-u)*d.heights[j*n+i]+u*d.heights[j*n+i+1])+v*((1-u)*d.heights[(j+1)*n+i]+u*d.heights[(j+1)*n+i+1])-min)/10*1.35+3;};
}
// A prescribed downhill corridor on the actual DEM. It is not a physical runout calculation.
export function slideRoute(d:TerrainData):[number,number][]{
 const height=terrainSampler(d);let start:[number,number]=[0,-20],highest=-Infinity;
 for(let x=-20;x<=20;x+=4)for(let z=-34;z<=34;z+=4){const h=height(x,z);if(h>highest){highest=h;start=[x,z];}}
 let end:[number,number]=[0,40],score=Infinity;
 for(let x=-48;x<=48;x+=4)for(let z=-40;z<=40;z+=4){const dist=Math.hypot(x-start[0],z-start[1]);if(dist<45||dist>85)continue;const value=height(x,z)+dist*.045;if(value<score){score=value;end=[x,z];}}
 const dx=end[0]-start[0],dz=end[1]-start[1],len=Math.hypot(dx,dz)||1;
 return Array.from({length:91},(_,i)=>{const t=i/90,bend=Math.sin(t*Math.PI)*2.5;return[start[0]+dx*t-dz/len*bend,start[1]+dz*t+dx/len*bend];});
}
export function routeExposure(d:TerrainData,route:[number,number][],lon:number,lat:number){
 const [x,z]=terrainXY(d,lon,lat);let best=Infinity,along=0;
 for(let i=0;i<route.length-1;i++){const [ax,az]=route[i],[bx,bz]=route[i+1],dx=bx-ax,dz=bz-az,u=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1),dist=Math.hypot(x-ax-u*dx,z-az-u*dz);if(dist<best){best=dist;along=(i+u)/(route.length-1);}}
 return{along,normalized:best/(3+along*4)};
}
