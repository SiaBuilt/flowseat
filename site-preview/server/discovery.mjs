import records from '../data/shanghai-real-discovery.json' with {type:'json'};
import expansion from '../data/shanghai-expansion-20261025.json' with {type:'json'};
const marker='bootstrap:real-shanghai-v06';
// Bounded application data initialization. Never changes schema or replays after review.
async function ensureBaseDiscovery(db){
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(marker).first())return;
 const at=Date.now(),q=(sql,...args)=>db.prepare(sql).bind(...args);
 const tasks=[q("INSERT OR IGNORE INTO profiles(uid,name,updated_at) VALUES('system:flowseat','FlowSeat 资料整理',?)",at)];
 for(const record of records){const {id,...p}=record,payload=JSON.stringify(p);
  tasks.push(q("INSERT OR IGNORE INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) SELECT ?,'system:flowseat',?,?,'candidate','真实地点线索；办公条件待核实',?,? WHERE NOT EXISTS(SELECT 1 FROM audit WHERE id=?)",id,'tencent:'+p.poiId,payload,at,at,marker));
  if(id.startsWith('source-'))tasks.push(q("UPDATE places SET payload=?,status='candidate',note='真实地点线索；办公条件待核实',updated_at=? WHERE id=? AND author='system:flowseat' AND status='pending' AND NOT EXISTS(SELECT 1 FROM audit WHERE id=?)",payload,at,id,marker));
 }
 tasks.push(q("INSERT OR IGNORE INTO audit(id,actor,subject,action,note,at) VALUES(?,'system:flowseat','shanghai','seed','8 个真实地点线索，未认证办公条件',?)",marker,at));
 await db.batch(tasks);
}

export async function ensureDiscovery(db){
 await ensureBaseDiscovery(db);
 const batchId='bootstrap:shanghai-expansion-20261025';
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(batchId).first())return;
 const at=Date.now(),q=(sql,...args)=>db.prepare(sql).bind(...args);
 const tasks=expansion.map(({id,...p})=>q("INSERT OR IGNORE INTO places(id,author,fingerprint,payload,status,note,created_at,updated_at) VALUES(?,'system:flowseat',?,?,'candidate','公开资料线索；办公条件待核实',?,?)",id,'tencent:'+p.poiId,JSON.stringify(p),at,at));
 tasks.push(q("INSERT OR IGNORE INTO audit(id,actor,subject,action,note,at) VALUES(?,'system:flowseat','shanghai','seed','新增12个公开资料候选，未认证办公条件',?)",batchId,at));
 await db.batch(tasks);
}
