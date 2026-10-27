export function approvalPage(nonce: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Owlbear · Codex of Heroes</title>
<style nonce="${nonce}">
:root{color-scheme:dark;font-family:Segoe UI,sans-serif;background:#172334;color:#e8edf2}*{box-sizing:border-box}body{margin:0;padding:32px 18px}main{max-width:640px;margin:auto}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:32px;margin:18px 0}h2{font-size:23px}p{line-height:1.6}small,.quiet{color:#b3c1d0}.panel{padding:22px;background:#243347;border:1px solid #526174;border-radius:8px;margin:20px 0}.code{font-size:30px;font-weight:650;letter-spacing:5px;color:#dfc28a;margin:12px 0}label{display:block;margin:16px 0}select,button,a.button{font:inherit;padding:10px 14px;border-radius:5px;border:1px solid #526174;background:#304259;color:inherit}select{display:block;width:100%;margin-top:8px}button,a{cursor:pointer}button:disabled{opacity:.45;cursor:default}a{color:#93cbb8}.primary{background:#dfc28a;color:#172334;border-color:#dfc28a}button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #93cbb8;outline-offset:3px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.connection{border-top:1px solid #526174;padding:16px 0;display:flex;gap:12px;align-items:center;justify-content:space-between}.connection span{display:block}#status{min-height:24px;line-height:1.5;overflow-wrap:anywhere}input{margin-right:8px}#login[hidden],[hidden]{display:none!important}
</style></head><body><main><a href="/">Codex of Heroes</a><h1>Connect your Owlbear sheet</h1><p>Connect your sheet to authorised characters from one game room. Review the requested access below. Your website permissions still apply.</p>
<p id="status" role="status" aria-live="polite">Checking your account…</p>
<div id="login" hidden class="panel"><p>Sign in to the account you want to connect, then return here.</p><a class="button" href="/login" target="_blank" rel="noopener noreferrer">Sign in to website</a><button id="retry">Check sign-in</button></div>
<section id="approval" hidden class="panel"><p>Connecting as <strong id="account"></strong></p><p>Check that this code matches the one in your Owlbear sheet:</p><div class="code" id="code"></div><p class="quiet">Requested by <span id="origin"></span></p><p id="access-scope"></p><label>Game room<select id="rooms"></select></label><label><input id="confirm" type="checkbox">The code matches the sheet I am connecting.</label><p class="quiet"><span id="lifetime">This connection expires after one hour.</span> Only the play controls named above are permitted. Character definitions, assignments and room settings cannot be changed.</p><div class="actions"><button id="approve" class="primary" disabled>Approve read-only access</button><button id="deny">Deny</button></div></section>
<section id="connections" hidden><h2>Your active connections</h2><p class="quiet">Revoke access here at any time. Each browser sheet has its own connection.</p><div id="list"></div><button id="refresh">Refresh connections</button></section>
</main><script nonce="${nonce}">
const root='/api/extension/v1/approval',id=new URL(location.href).searchParams.get('request'),el=x=>document.getElementById(x);let csrf='',working=false;
async function api(path,body){const r=await fetch(root+path,{credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json',...(csrf?{'X-Extension-CSRF':csrf}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){const error=new Error(data.error||'Request failed.');error.status=r.status;throw error}return data}
function status(message){el('status').textContent=message}
function controls(){el('approve').disabled=working||!el('confirm').checked||!el('rooms').value;el('deny').disabled=working}
function writeNames(grant){return [grant.hpWrite?'HP changes':'',grant.slotsWrite?'spell-slot changes':'',grant.tempHpWrite?'temporary HP changes':'',grant.resourcesWrite?'resource-counter changes':'',grant.combatWrite?'combat-tracker changes (inspiration, hit dice and death saves)':'',grant.equipmentWrite?'equipment-state changes (equip and attunement)':'',grant.preparationWrite?'spell-preparation changes (prepare and unprepare)':'',grant.inventoryWrite?'inventory-count changes (add or remove one; empty items are unequipped)':'',grant.effectsWrite?'manual spell-effect changes (no casting costs or duration tracking)':'',grant.featuresWrite?'feature pin changes (pin and unpin existing features)':''].filter(Boolean)}
async function list(){
  const data=await api('/connections');el('list').replaceChildren();
  for(const connection of data.connections){
    const row=document.createElement('div');row.className='connection';
    const info=document.createElement('div'),name=document.createElement('strong');name.textContent=connection.roomName;
    const detail=document.createElement('span');detail.className='quiet';
    detail.textContent=connection.origin+' / '+(writeNames(connection).join(' + ')||'Read-only')+' / expires '+new Date(connection.expiresAt).toLocaleTimeString();
    info.append(name,detail);const button=document.createElement('button');button.textContent='Revoke';
    button.onclick=async()=>{button.disabled=true;try{await api('/connections/'+connection.id+'/revoke',{});status('Connection revoked.');await list()}catch(error){status(error.message);button.disabled=false}};
    row.append(info,button);el('list').append(row);
  }
  if(!data.connections.length)el('list').textContent='No active connections.';
}
async function init(){
  el('approval').hidden=true;
  try{
    const data=await api('/context'+(id?'?request='+encodeURIComponent(id):''));csrf=data.csrf;
    el('login').hidden=true;el('connections').hidden=false;await list();
    if(!data.pairing){status('Manage your Owlbear connections here.');return}
    el('account').textContent=data.account.displayName;el('code').textContent=data.pairing.code;el('origin').textContent=data.pairing.origin;
    el('lifetime').textContent=data.pairing.gameSession?'This game connection expires 12 hours after approval is completed. It does not renew automatically. You can revoke it at any time.':'This connection expires after one hour.';
    const writes=writeNames(data.pairing);
    el('access-scope').textContent=(data.pairing.details?'Includes vitals, attacks, equipment, spells, features, proficiencies, biography and notes for characters you may access.':'Includes character names and vitals only.')+
      (writes.length?' Also permits '+writes.join(' and ')+' for those characters. All other values remain read-only.':' No changes are permitted.');
    el('approve').textContent=writes.length?'Approve access and '+writes.join(' and '):'Approve read-only access';
    el('rooms').replaceChildren();
    for(const room of data.rooms){const option=document.createElement('option');option.value=room.id;option.textContent=room.name+' ('+(room.role==='dm'?'DM':'Player')+')';el('rooms').append(option)}
    el('approval').hidden=false;
    status(data.rooms.length?'Choose the room to share with your sheet.':'This account has no game rooms. Join a test room on the website first.');controls();
  }catch(error){status(error.message);el('login').hidden=error.status!==401}
}
async function decide(action){working=true;controls();try{await api('/pairings/'+encodeURIComponent(id)+'/'+action,{roomId:el('rooms').value});el('approval').hidden=true;status(action==='approve'?'Approved. Return to your Owlbear sheet; it will finish connecting automatically.':'Connection denied. You may close this tab.');await list()}catch(error){status(error.message)}finally{working=false;controls()}}
el('confirm').onchange=controls;el('rooms').onchange=controls;el('approve').onclick=()=>decide('approve');el('deny').onclick=()=>decide('deny');el('retry').onclick=init;el('refresh').onclick=()=>list().catch(error=>status(error.message));init();
</script></body></html>`
}
