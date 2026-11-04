const fs=require('fs'),path=require('path'),assert=require('assert'),{spawn,execFileSync}=require('child_process'),pup=require('puppeteer-core'),WS=require('ws');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve('temp/window-stack-'+Date.now());fs.mkdirSync(root,{recursive:true});
const exe=path.resolve(process.env.KANVAZ_TEST_EXE||'dist/win-unpacked/Kanvaz 中文版.exe');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let child,browser,socket,helper;let rpcId=0;const pending=new Map();
async function evaluate(expression){const id=++rpcId;const p=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));const r=await p;if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const native=()=>evaluate(`(()=>{const w=process.mainModule.require('electron').BrowserWindow.getAllWindows()[0];return {top:w.isAlwaysOnTop(),focused:w.isFocused(),bounds:w.getBounds(),handle:w.getNativeWindowHandle().readBigUInt64LE().toString()};})()`);
async function launch(user){
  child=spawn(exe,['--remote-debugging-port=9399','--inspect=9401','--user-data-dir='+user],{env,windowsHide:true,stdio:'ignore'});
  for(let i=0;i<45;i++){try{browser=await pup.connect({browserURL:'http://127.0.0.1:9399'});break;}catch{await wait(200);}}
  assert(browser);const page=(await browser.pages())[0];await page.waitForFunction('typeof KanvazUI_Extended!=="undefined"');
  const list=await (await fetch('http://127.0.0.1:9401/json/list')).json();socket=new WS(list[0].webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));socket.on('message',m=>{const r=JSON.parse(m);if(pending.has(r.id)){pending.get(r.id).resolve(r.result);pending.delete(r.id);}});
  await wait(300);return page;
}
async function stop(){if(socket)socket.close();socket=null;if(browser)await browser.disconnect();browser=null;if(child){const c=child;child=null;c.kill();await new Promise(r=>{c.once('exit',r);setTimeout(r,1500);});}await wait(250);}
function pointPid(x,y,mainHandle,otherHandle){
  const script=`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class StackProbe{[StructLayout(LayoutKind.Sequential)]public struct P{public int X;public int Y;}[DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(P p);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern IntPtr GetWindow(IntPtr h,uint cmd);}'; $pt=New-Object StackProbe+P;$pt.X=${Math.round(x)};$pt.Y=${Math.round(y)};$pidAtPoint=0;[void][StackProbe]::GetWindowThreadProcessId([StackProbe]::WindowFromPoint($pt),[ref]$pidAtPoint);$foregroundPid=0;[void][StackProbe]::GetWindowThreadProcessId([StackProbe]::GetForegroundWindow(),[ref]$foregroundPid); $above=$false;$h=[IntPtr]::new([Int64]${mainHandle});for($n=0;$n -lt 1000;$n++){$h=[StackProbe]::GetWindow($h,3);if($h -eq [IntPtr]::Zero){break};if($h.ToInt64() -eq [Int64]${otherHandle}){$above=$true;break}};@{pointPid=$pidAtPoint;foregroundPid=$foregroundPid;otherAbove=$above}|ConvertTo-Json -Compress`;
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true}));
}
async function otherWindow(bounds){
  const dir=path.join(root,'helper-'+Date.now());fs.mkdirSync(dir);const ready=path.join(dir,'ready');
  fs.writeFileSync(path.join(dir,'main.cjs'),`const {app,BrowserWindow}=require('electron'),fs=require('fs');app.whenReady().then(()=>{const w=new BrowserWindow({x:${bounds.x},y:${bounds.y},width:${bounds.width},height:${bounds.height},show:false,title:'Window stacking test',backgroundColor:'#285b83',webPreferences:{sandbox:true}});w.loadURL('data:text/html,<body style="background:%23285b83;color:white;font:24px sans-serif">External window stacking test</body>').then(()=>{w.show();w.focus();fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid,handle:w.getNativeWindowHandle().readBigUInt64LE().toString()}));});});`);
  helper=spawn(path.resolve('D:/Codex-Kanvaz-20261023/electron-runtime/electron.exe'),[path.join(dir,'main.cjs'),'--user-data-dir='+path.join(dir,'profile')],{env,windowsHide:true,stdio:['ignore',fs.openSync(path.join(dir,'stdout.txt'),'w'),fs.openSync(path.join(dir,'stderr.txt'),'w')]});
  for(let i=0;i<100&&!fs.existsSync(ready);i++)await wait(100);assert(fs.existsSync(ready),'separate process shows a window');return JSON.parse(fs.readFileSync(ready,'utf8'));
}
(async()=>{try{
  const user=path.join(root,'legacy');const profile=require('../src/profiles').getActiveProfileDir(user);fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({_version:4,alwaysOnTop:true,strongSnapV1:true,openOnStartup:false}));
  let page=await launch(user);await page.waitForFunction(()=>KanvazUI_Extended.getSettings().normalWindowV1===true&&KanvazUI_Extended.getSettings().alwaysOnTop===false);assert.equal((await native()).top,false);
  console.log('PASS legacy forced-on setting migrates once to normal native window');
  await evaluate(`process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].setBounds({x:160,y:120,width:1000,height:700})`);const before=await native();const pid=await otherWindow(before.bounds);await wait(2900);
  const stack=pointPid(before.bounds.x+before.bounds.width/2,before.bounds.y+before.bounds.height/2,before.handle,pid.handle);assert.equal(stack.otherAbove,true,'other process stays visually above Kanvaz');assert.notEqual(stack.foregroundPid,child.pid,'Kanvaz does not take foreground from another process');const after=await native();console.log('Native stacking state',JSON.stringify({mainPid:child.pid,foregroundPid:stack.foregroundPid,otherAbove:stack.otherAbove,topmost:after.top}));assert.equal(after.top,false);helper.kill();helper=null;
  console.log('PASS separate application window stays above Kanvaz beyond blur delays/watchdog; an external process remains foreground');
  await page.evaluate(()=>KanvazUI_Extended.updateSettings({alwaysOnTop:true}));await wait(250);assert.equal((await native()).top,true);await stop();
  page=await launch(user);assert.equal(await page.evaluate(()=>KanvazUI_Extended.getSettings().alwaysOnTop),true);assert.equal((await native()).top,true);
  console.log('PASS explicit manual always-on-top survives application restart');
  await page.evaluate(()=>KanvazUI_Extended.updateSettings({alwaysOnTop:false}));await wait(250);assert.equal((await native()).top,false);
  await page.evaluate(()=>KanvazApp.toggleTopMode());await wait(150);assert.equal((await native()).top,true);await page.evaluate(()=>KanvazApp.toggleTopMode());await wait(150);assert.equal((await native()).top,false);
  console.log('PASS explicit Top Mode pins temporarily and restores normal stacking on exit');await stop();
  await launch(path.join(root,'fresh'));assert.equal((await native()).top,false);console.log('PASS fresh profile defaults to normal window');console.log('ALL WINDOW STACKING TESTS PASSED');
}finally{if(helper)helper.kill();await stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
