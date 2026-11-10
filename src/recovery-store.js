'use strict';
var fs=require('fs'),path=require('path');
class RecoveryStore {
 constructor(dir){this.dir=dir;this.queue=Promise.resolve();this.lastArchive=null;}
 run(fn){var p=this.queue.then(fn);this.queue=p.catch(function(){});return p;}
 async write(data,manual){var self=this;return this.run(async function(){
  var parsed=JSON.parse(data);if(!parsed||!Array.isArray(parsed.boards)||parsed.boards.some(function(b){return !b||!Array.isArray(b.cards);}))throw Error('Invalid board snapshot');
  await fs.promises.mkdir(self.dir,{recursive:true});
  if(self.lastArchive===null){var existing=(await self.list()).filter(function(x){return x.id!=='autosave.kanvaz.tmp';});self.lastArchive=existing.length?existing[0].time:0;}
  var target=path.join(self.dir,'autosave.kanvaz.tmp'),tmp=target+'.writing';
  await fs.promises.writeFile(tmp,data,'utf8');await fs.promises.rename(tmp,target);
  if(manual||Date.now()-self.lastArchive>=300000){var name='backup-'+Date.now()+'-'+require('crypto').randomBytes(3).toString('hex')+'.json';await fs.promises.writeFile(path.join(self.dir,name),data,{encoding:'utf8',flag:'wx'});self.lastArchive=Date.now();var list=await self.list();for(var item of list.filter(function(x){return x.id!=='autosave.kanvaz.tmp';}).slice(5))await fs.promises.unlink(path.join(self.dir,item.id));}
  return {ok:true};
 });}
 async list(){var names;try{names=await fs.promises.readdir(this.dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}var out=[];for(var id of names.filter(function(x){return x==='autosave.kanvaz.tmp'||/^backup-\d+-[a-f0-9]+\.json$/.test(x);})){var stat=await fs.promises.stat(path.join(this.dir,id));out.push({id:id,time:stat.mtimeMs,size:stat.size});}return out.sort(function(a,b){return b.time-a.time;});}
 async read(id){if(id!=='autosave.kanvaz.tmp'&&!/^backup-\d+-[a-f0-9]+\.json$/.test(id))throw Error('Invalid backup identifier');return {ok:true,data:await fs.promises.readFile(path.join(this.dir,id),'utf8')};}
 clear(){var self=this;return this.run(async function(){await fs.promises.unlink(path.join(self.dir,'autosave.kanvaz.tmp')).catch(function(e){if(e.code!=='ENOENT')throw e;});return {ok:true};});}
}
module.exports=RecoveryStore;
