import type {MapPoint, MapRegion} from './room-maps'

const cross=(a:MapPoint,b:MapPoint,c:MapPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
const onSegment=(p:MapPoint,a:MapPoint,b:MapPoint)=>Math.abs(cross(a,b,p))<1e-10&&p.x>=Math.min(a.x,b.x)-1e-10&&p.x<=Math.max(a.x,b.x)+1e-10&&p.y>=Math.min(a.y,b.y)-1e-10&&p.y<=Math.max(a.y,b.y)+1e-10
export function inRegion(point:MapPoint,region:Pick<MapRegion,'points'>){
  let inside=false
  for(let i=0,j=region.points.length-1;i<region.points.length;j=i++){
    const a=region.points[j]!,b=region.points[i]!
    if(onSegment(point,a,b))return true
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside
  }
  return inside
}
export function regionBounds(region:Pick<MapRegion,'points'>){
  if(!region.points.length)return {x:0,y:0,width:0,height:0}
  const xs=region.points.map(p=>p.x),ys=region.points.map(p=>p.y)
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}
}
/** Keep labels inside concave borders by using the longest interior span. */
export function regionLabelPoint(region:Pick<MapRegion,'points'>):MapPoint{
  const bounds=regionBounds(region),y=bounds.y+bounds.height/2,intersections:number[]=[]
  for(let i=0;i<region.points.length;i++){
    const a=region.points[i]!,b=region.points[(i+1)%region.points.length]!
    if((a.y>y)!==(b.y>y))intersections.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y))
  }
  intersections.sort((a,b)=>a-b)
  let x=bounds.x+bounds.width/2,longest=0
  for(let i=0;i+1<intersections.length;i+=2){const left=intersections[i]!,right=intersections[i+1]!;if(right-left>longest){longest=right-left;x=(left+right)/2}}
  return {x,y}
}
/** Concave shapes are supported. Reject crossings and repeated vertices so
 * pin inclusion and border editing remain unambiguous. */
export function regionProblem(points:MapPoint[]):string {
  if(points.length<3)return 'Add at least three border points.'
  const seen=new Set<string>();let area=0
  for(let i=0;i<points.length;i++){
    const a=points[i]!,b=points[(i+1)%points.length]!,key=`${a.x},${a.y}`
    if(seen.has(key))return 'Two border points share the same position. Move or remove one.'
    seen.add(key);area+=a.x*b.y-b.x*a.y
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||i===0&&j===points.length-1)continue
      const c=points[j]!,d=points[(j+1)%points.length]!
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b))return 'The border crosses or touches itself. Move or remove a point.'
    }
  }
  return Math.abs(area)<1e-9?'The border must enclose an area.':''
}
