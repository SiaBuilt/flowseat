export type ProjectedPoint<T extends {id:string}>={place:T;x:number;y:number};
export type PointCluster<T extends {id:string}>={items:ProjectedPoint<T>[];x:number;y:number};
// Screen-space grouping keeps labels readable at every zoom. A selected place
// remains individually addressable; the other members stay in their cluster.
export function clusterProjectedPoints<T extends {id:string}>(points:ProjectedPoint<T>[],selectedId='',gapX=160,gapY=48):PointCluster<T>[]{
 const remaining=points.filter(p=>p.place.id!==selectedId),groups:PointCluster<T>[]=[];
 const seen=new Set<number>();
 for(let i=0;i<remaining.length;i++){
  if(seen.has(i))continue;
  const indexes=[i];seen.add(i);
  for(let n=0;n<indexes.length;n++){
   const p=remaining[indexes[n]];
   for(let j=0;j<remaining.length;j++)if(!seen.has(j)&&Math.abs(p.x-remaining[j].x)<gapX&&Math.abs(p.y-remaining[j].y)<gapY){seen.add(j);indexes.push(j);}
  }
  const items=indexes.map(j=>remaining[j]);
  groups.push({items,x:items.reduce((sum,p)=>sum+p.x,0)/items.length,y:items.reduce((sum,p)=>sum+p.y,0)/items.length});
 }
 for(const p of points.filter(p=>p.place.id===selectedId))groups.push({items:[p],x:p.x,y:p.y});
 return groups;
}
