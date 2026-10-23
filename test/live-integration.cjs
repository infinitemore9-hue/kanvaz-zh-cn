const fs=require('fs'),path=require('path'),assert=require('assert'),{spawn}=require('child_process'),puppeteer=require('puppeteer-core');
const root=process.cwd(), wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(path.join(root,'dist/win-unpacked/Kanvaz 中文版.exe'),['--remote-debugging-port=9388','--user-data-dir='+path.join(root,'temp/test-profile')],{env,windowsHide:true,stdio:'ignore'});
 let browser;try{
 for(let i=0;i<40;i++){try{browser=await puppeteer.connect({browserURL:'http://127.0.0.1:9388'});break;}catch{await wait(500);}}
 assert(browser,'Electron debugging connection');const page=(await browser.pages())[0]; await page.waitForFunction('typeof KanvazCards !== "undefined" && typeof KanvazLocalization !== "undefined"');await page.evaluate(()=>KanvazUI_Extended.updateSettings({simpleWorkspace:false}));
 const png=await page.evaluate(()=>{let c=document.createElement('canvas');c.width=80;c.height=60;let x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,80,60);return c.toDataURL();});
 const png2=await page.evaluate(()=>{let c=document.createElement('canvas');c.width=160;c.height=120;let x=c.getContext('2d');x.fillStyle='blue';x.fillRect(0,0,160,120);return c.toDataURL();});
 const dir=path.join(root,'temp/中文图片');fs.mkdirSync(dir,{recursive:true});const files=['一.png','二.png','三.png'].map(n=>path.join(dir,n));for(const f of files)fs.writeFileSync(f,Buffer.from(png.split(',')[1],'base64'));
 const ids=await page.evaluate(async files=>{KanvazBoards.newBoard(true,'测试画板');let ids=[];for(let i=0;i<files.length;i++){let r=await KanvazBridge.loadMedia(files[i]);r.type='image';r.displayW=200;r.displayH=150;let c=KanvazCards.createFromMedia(r,{x:i*250,y:100});ids.push(c.id);}return ids;},files);
 await wait(3000);const before=await page.evaluate(ids=>ids.map(id=>{let c=KanvazCards.getAll()[id];return {id:c.id,x:c.x,y:c.y,w:c.w,h:c.h,data:c.dataUrl};}),ids);
 const check=async(index,label)=>{await page.waitForFunction((id,data)=>KanvazCards.getAll()[id].dataUrl===data,{timeout:15000},ids[index],png2);const now=await page.evaluate(ids=>ids.map(id=>{let c=KanvazCards.getAll()[id];return {id:c.id,x:c.x,y:c.y,w:c.w,h:c.h,data:c.dataUrl};}),ids);for(let i=0;i<3;i++){assert.deepStrictEqual([now[i].x,now[i].y,now[i].w,now[i].h],[before[i].x,before[i].y,before[i].w,before[i].h]);}console.log('PASS '+label+'; positions and sizes unchanged');return now;};
 fs.writeFileSync(files[0],Buffer.from(png2.split(',')[1],'base64'));let now=await check(0,'direct overwrite');assert.equal(now[1].data,png);assert.equal(now[2].data,png);console.log('PASS other images unchanged');
 fs.writeFileSync(files[1]+'.tmp',Buffer.from(png2.split(',')[1],'base64'));fs.renameSync(files[1]+'.tmp',files[1]);await check(1,'atomic replacement');
 fs.unlinkSync(files[2]);await wait(2200);assert.equal(await page.evaluate(id=>KanvazCards.getAll()[id].dataUrl,ids[2]),png);fs.writeFileSync(files[2],Buffer.from('invalid'));await wait(2500);assert.equal(await page.evaluate(id=>KanvazCards.getAll()[id].dataUrl,ids[2]),png);fs.writeFileSync(files[2],Buffer.from(png2.split(',')[1],'base64'));await check(2,'delete, invalid write, recovery');
 await page.evaluate(()=>{let start=Array.from(document.querySelectorAll('button')).find(b=>/Start using Kanvaz|开始使用/.test(b.textContent));if(start)start.click();if(document.getElementById('startup-screen'))KanvazBoards.toggleHomeScreen();});assert.equal(await page.evaluate(()=>KanvazLocalization.language()),'zh-CN');await page.evaluate(()=>KanvazSidePanel.showSection('settings'));await page.click('#language-switch');await page.evaluate(()=>KanvazSidePanel.close());assert.equal(await page.evaluate(()=>KanvazLocalization.language()),'en');await page.evaluate(()=>KanvazSidePanel.showSection('settings'));await page.click('#language-switch');await page.evaluate(()=>KanvazSidePanel.close());console.log('PASS Chinese / English switch');
 await page.evaluate(()=>{const start=Array.from(document.querySelectorAll('button')).find(x=>/Start using Kanvaz|开始使用 Kanvaz/.test(x.textContent));if(start)start.click();});
 await page.evaluate(()=>{if(KanvazBoards.hideHomeScreen)KanvazBoards.hideHomeScreen();});
 for(const id of ids){assert.equal(await page.evaluate(id=>{var img=document.getElementById(id).querySelector('img');return img && img.src;},id),png2);}console.log('PASS all three rendered image sources updated');
 await page.screenshot({path:path.join(root,'temp/运行截图.png')});console.log('dictionary entries',await page.evaluate(()=>Object.keys(KanvazLocalization.dictionary).length));console.log('ALL LIVE TESTS PASSED');
 }finally{if(browser)await browser.disconnect();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
