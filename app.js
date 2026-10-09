(() => {
  const $ = id => document.getElementById(id);
  const config = window.CLASSFIX_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const db = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const STORE = 'classfix_two_portal_issues_v1';
  let issues = [];
  let demoAdmin = false; // demo access is intentionally disabled
  let currentSession = null;
  let toastTimer;

  const sampleIssues = [
    {id:'CF-1042',title:'Projector not displaying',description:'Projector powers on but no image appears on the screen.',category:'Projector / Display',building:'Main Block',room:'Room 204',priority:'High',status:'Submitted',reporter:'Student',contact:'',created_at:new Date(Date.now()-1000*60*45).toISOString(),completed_at:null,photo_url:''},
    {id:'CF-1041',title:'Ceiling fan making noise',description:'Fan makes a loud rattling noise during class.',category:'Fan / Air Conditioning',building:'Science Block',room:'Lab 2',priority:'Medium',status:'In Progress',reporter:'Staff member',contact:'',created_at:new Date(Date.now()-1000*60*60*8).toISOString(),completed_at:null,photo_url:''},
    {id:'CF-1040',title:'Wi-Fi connection unavailable',description:'Students cannot connect to the classroom Wi-Fi.',category:'Wi-Fi / Network',building:'Main Block',room:'Room 108',priority:'Critical',status:'Submitted',reporter:'Student',contact:'',created_at:new Date(Date.now()-1000*60*60*26).toISOString(),completed_at:null,photo_url:''},
    {id:'CF-1039',title:'Broken desk edge',description:'A desk has a sharp broken edge and needs repair.',category:'Furniture',building:'Arts Block',room:'Room 12',priority:'Low',status:'Completed',reporter:'Student',contact:'',created_at:new Date(Date.now()-1000*60*60*72).toISOString(),completed_at:new Date(Date.now()-1000*60*60*28).toISOString(),photo_url:''}
  ];
  function readLocal(){ try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []} }
  function writeLocal(){ localStorage.setItem(STORE,JSON.stringify(issues)); }
  function makeId(){return 'CF-'+Math.floor(10000+Math.random()*90000)}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function priorityFor(urgency, description, category){
    const t=(description+' '+category).toLowerCase();
    if(urgency==='Critical'||/smoke|fire|spark|electric shock|exposed wire|danger|emergency/.test(t))return 'Critical';
    if(urgency==='High'||/not working|unavailable|broken|class affected|projector|network/.test(t))return 'High';
    return urgency||'Medium';
  }
  function showToast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
  function showMessage(id,msg,type){const el=$(id);el.textContent=msg;el.className='message '+(type||'')}
  function setConnection(){ $('connection-title').textContent=configured?'Cloud connected':'Demo mode';$('connection-sub').textContent=configured?'Shared issue database':'Local preview data';document.querySelector('.status-dot').style.background=configured?'#13b58a':'#f2a33a';$('demo-login-note').textContent=configured?'Only admin123@gmail.com is permitted to access the admin dashboard.':'Cloud authentication is not configured. Follow SETUP.md to enable real sign-in.'; }
  function switchView(view){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('report-view').classList.toggle('hidden',view!=='report');$('admin-view').classList.toggle('hidden',view!=='admin');
    $('page-title').textContent=view==='report'?'Report a classroom issue':'Admin dashboard';
    if(view==='admin') updateAdminVisibility();
  }
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('photo').addEventListener('change',()=>{$('file-name').textContent=$('photo').files[0]?.name||'JPG, PNG or WEBP · max 5 MB'});
  async function fetchIssues(){
    if(configured && (currentSession || demoAdmin===false)){
      const {data,error}=await db.from('issues').select('*').order('created_at',{ascending:false});
      if(!error){issues=(data||[]).map(x=>({...x,title:x.title||x.category}));return}
      if(currentSession){showToast('Could not load cloud issues: '+error.message);return}
    }
    issues=readLocal();
  }
  async function uploadPhoto(file, issueId){
    if(!file)return '';
    if(file.size>5*1024*1024)throw new Error('Please choose an image smaller than 5 MB.');
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Please upload a JPG, PNG, or WEBP image.');
    if(configured){
      const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const path=issueId+'/'+Date.now()+'.'+ext;
      const {error}=await db.storage.from('issue-photos').upload(path,file,{upsert:false});
      if(error)throw new Error('Photo upload failed: '+error.message);
      const {data}=db.storage.from('issue-photos').getPublicUrl(path);
      return data.publicUrl;
    }
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Could not read photo.'));r.readAsDataURL(file)});
  }
  $('issue-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=$('submit-btn');btn.disabled=true;btn.textContent='Submitting…';
    try{
      const category=$('category').value, description=$('description').value.trim(), id=makeId(), file=$('photo').files[0]||null;
      const priority=priorityFor($('urgency').value,description,category);
      const photo_url=await uploadPhoto(file,id);
      const issue={id,title:description.length>55?description.slice(0,52)+'…':description,description,category,building:$('building').value.trim(),room:$('room').value.trim(),priority,status:'Submitted',reporter:$('reporter').value.trim()||'Anonymous',contact:$('contact').value.trim(),created_at:new Date().toISOString(),completed_at:null,photo_url};
      if(configured){
        const {error}=await db.from('issues').insert([issue]);
        if(error)throw new Error('Report was not saved to shared database: '+error.message);
      }else{issues=readLocal();issues.unshift(issue);writeLocal()}
      e.target.reset();$('file-name').textContent='JPG, PNG or WEBP · max 5 MB';
      showMessage('form-message',`Issue submitted successfully. Your tracking ID is ${id}.`,'success');
      showToast(configured?'Report sent to the shared admin dashboard.':'Report saved in this browser demo.');
      await refreshIssues();
    }catch(err){showMessage('form-message',err.message||'Could not submit report.','error')}
    finally{btn.disabled=false;btn.innerHTML='Submit issue <span>→</span>'}
  });
  function studentAuthMessage(msg,type=''){showMessage('student-auth-message',msg,type)}
  $('google-login').addEventListener('click',async()=>{if(!configured){studentAuthMessage('Configure Supabase and Google OAuth using SETUP.md first.','error');return}const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});if(error)studentAuthMessage(error.message,'error')});
  $('student-auth-form').addEventListener('submit',async e=>{e.preventDefault();if(!configured){studentAuthMessage('Configure Supabase first to enable real student/staff sign-in.','error');return}const email=$('student-email').value.trim(),password=$('student-password').value;const {data,error}=await db.auth.signInWithPassword({email,password});if(error){studentAuthMessage(error.message,'error');return}if(data.user?.email?.toLowerCase()==='admin123@gmail.com'){await db.auth.signOut();studentAuthMessage('Use the Admin Dashboard to sign in with the administrator account.','error');return}studentAuthMessage('Signed in successfully. You can submit your report now.','success');$('student-signout').classList.remove('hidden')});
  $('student-signup').addEventListener('click',async()=>{if(!configured){studentAuthMessage('Configure Supabase first to enable account creation.','error');return}const email=$('student-email').value.trim(),password=$('student-password').value;if(!email||password.length<6){studentAuthMessage('Enter an email and a password with at least 6 characters.','error');return}const {data,error}=await db.auth.signUp({email,password});if(error){studentAuthMessage(error.message,'error');return}studentAuthMessage(data.session?'Account created and signed in.':'Account created. Check your email to confirm it, then sign in.','success')});
  $('student-signout').addEventListener('click',async()=>{if(configured)await db.auth.signOut();$('student-signout').classList.add('hidden');studentAuthMessage('Signed out.');});

  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();showMessage('login-message','','');
    const email=$('admin-email').value.trim().toLowerCase(),password=$('admin-password').value;
    if(email !== 'admin123@gmail.com'){showMessage('login-message','Access denied. Only admin123@gmail.com can sign in to the admin portal.','error');return}
    if(!configured){showMessage('login-message','Real admin sign-in is not configured yet. Complete the Supabase setup in SETUP.md.','error');return}
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){showMessage('login-message','Sign-in failed. Check your credentials and try again.','error');return}
    currentSession=data.session;demoAdmin=false;await refreshIssues();updateAdminVisibility();showToast('Signed in successfully.');
  });
  $('logout-btn').addEventListener('click',async()=>{if(configured&&currentSession)await db.auth.signOut();currentSession=null;demoAdmin=false;updateAdminVisibility()});
  $('refresh-btn').addEventListener('click',async()=>{await refreshIssues();showToast('Issue list refreshed.')});
  $('search-issues').addEventListener('input',renderIssues);$('status-filter').addEventListener('change',renderIssues);$('priority-filter').addEventListener('change',renderIssues);
  function updateAdminVisibility(){
    const allowed=Boolean(demoAdmin||currentSession);
    $('admin-login').classList.toggle('hidden',allowed);$('admin-dashboard').classList.toggle('hidden',!allowed);
    if(allowed)renderIssues();
  }
  async function refreshIssues(){
    if(configured&&currentSession){const {data,error}=await db.from('issues').select('*').order('created_at',{ascending:false});if(error){showToast('Could not refresh cloud issues.');return}issues=data||[]}
    else if(!configured){issues=readLocal()}
    if(demoAdmin&&!issues.length){issues=sampleIssues.map(x=>({...x}));writeLocal()}
    renderIssues();
  }
  function filteredIssues(){
    const q=$('search-issues').value.toLowerCase().trim(),st=$('status-filter').value,pr=$('priority-filter').value;
    return issues.filter(i=>(st==='All'||i.status===st)&&(pr==='All'||i.priority===pr)&&(!q||[i.id,i.title,i.description,i.category,i.building,i.room,i.reporter].join(' ').toLowerCase().includes(q)));
  }
  function fmtDate(s){if(!s)return '—';const d=new Date(s);return isNaN(d)?'—':d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
  function renderIssues(){
    const list=filteredIssues(),active=issues.filter(i=>i.status!=='Completed'),completed=issues.filter(i=>i.status==='Completed');
    $('stat-all').textContent=issues.length;$('stat-active').textContent=active.length;$('stat-high').textContent=active.filter(i=>['High','Critical'].includes(i.priority)).length;$('stat-completed').textContent=completed.length;$('completed-summary').textContent=completed.length;
    $('issue-count').textContent=`Showing ${list.length} of ${issues.length} issues`;
    $('empty-state').classList.toggle('hidden',list.length>0);
    $('issues-body').innerHTML=list.map(i=>{
      const statusClass=i.status.replace(/\s+/g,'.');
      const statusOptions=['Submitted','In Progress','Completed'].map(s=>`<option ${i.status===s?'selected':''}>${s}</option>`).join('');
      const photo=i.photo_url?`<a href="${escapeHtml(i.photo_url)}" target="_blank" rel="noopener">View photo</a>`:'';
      return `<tr><td><div class="issue-title">${escapeHtml(i.title||i.category)}</div><div class="issue-id">${escapeHtml(i.id)} · ${escapeHtml(i.category)}</div>${photo?`<div class="issue-id">${photo}</div>`:''}</td><td><div class="location-main">${escapeHtml(i.building)}</div><div class="location-sub">${escapeHtml(i.room)}</div></td><td><span class="priority ${escapeHtml(i.priority)}">${escapeHtml(i.priority)}</span></td><td>${fmtDate(i.created_at)}</td><td><span class="status ${statusClass}">${escapeHtml(i.status)}</span></td><td><select class="table-action status-update" data-id="${escapeHtml(i.id)}" aria-label="Update status for ${escapeHtml(i.id)}">${statusOptions}</select></td></tr>`
    }).join('');
    document.querySelectorAll('.status-update').forEach(el=>el.addEventListener('change',()=>updateStatus(el.dataset.id,el.value)));
  }
  async function updateStatus(id,status){
    const issue=issues.find(i=>i.id===id);if(!issue)return;
    const completed_at=status==='Completed'?(issue.completed_at||new Date().toISOString()):null;
    if(configured&&currentSession){
      const {error}=await db.from('issues').update({status,completed_at}).eq('id',id);
      if(error){showToast('Update failed: '+error.message);await refreshIssues();return}
    }else{issues=issues.map(i=>i.id===id?{...i,status,completed_at}:i);writeLocal()}
    await refreshIssues();showToast(`${id} marked ${status.toLowerCase()}.`);
  }
  function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
  function exportCsv(onlyCompleted=false){
    const rows=(onlyCompleted?issues.filter(i=>i.status==='Completed'):issues).slice();
    if(!rows.length){showToast(onlyCompleted?'No completed issues to export yet.':'No issues to export yet.');return}
    const headers=['Issue ID','Title','Description','Category','Building','Room','Priority','Status','Reported By','Contact','Submitted At','Completed At','Photo URL'];
    const keys=['id','title','description','category','building','room','priority','status','reporter','contact','created_at','completed_at','photo_url'];
    const csv=[headers.map(csvEscape).join(','),...rows.map(i=>keys.map(k=>csvEscape(i[k])).join(','))].join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=onlyCompleted?'classfix_completed_issues.csv':'classfix_issues_report.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    showToast(`${rows.length} issue${rows.length===1?'':'s'} exported to CSV.`);
  }
  $('export-btn').addEventListener('click',()=>exportCsv(false));$('completed-export-btn').addEventListener('click',()=>exportCsv(true));
  setConnection();
  if(configured){db.auth.getSession().then(async({data})=>{currentSession=data.session;if(currentSession && currentSession.user.email?.toLowerCase()!=='admin123@gmail.com'){await db.auth.signOut();currentSession=null}if(currentSession){refreshIssues()}updateAdminVisibility()});db.auth.onAuthStateChange((_event,session)=>{currentSession=session && session.user.email?.toLowerCase()==='admin123@gmail.com'?session:null;updateAdminVisibility();if(currentSession)refreshIssues()})}
  else {issues=readLocal();updateAdminVisibility()}
})();