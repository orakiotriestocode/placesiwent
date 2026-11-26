export function applyGroupLayer(html){
 let s=html;
 const patch=(a,b)=>{if(!s.includes(a))throw Error("Missing patch anchor: "+a.slice(0,80));s=s.replace(a,b)};
 patch("const fields=['name','role','pillar','region','country','product','productOwners','worksWith','manager'","const fields=['name','role','pillar','region','country','product','productOwners','worksWith','groups','allGroups','manager'");
 patch("const DATA_COLUMNS=['id','name','role','pillar','region','country','product','productOwners','worksWith','manager'","const DATA_COLUMNS=['id','name','role','pillar','region','country','product','productOwners','worksWith','groups','allGroups','manager'");
 const runtime=`
const groupCatalogKey='mesh-group-catalog-'+MODE+'-v1',groupSelectionKey='mesh-selected-groups-'+MODE+'-v1',groupDefaults=['MESH','IT'];
const splitGroups=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))];
function validateGroups(g){if(!Array.isArray(g)||!g.length||g.length>30)throw Error('Need 1-30 groups');const names=g.map(x=>String(x||'').trim());if(names.some(x=>!x||x.length>60||x.includes(','))||new Set(names.map(x=>x.toLowerCase())).size!==names.length)throw Error('Invalid group name or duplicate');return names}
let groupCatalog;try{groupCatalog=validateGroups(JSON.parse(localStorage.getItem(groupCatalogKey)||'null'))}catch(e){groupCatalog=[...groupDefaults]}
function foundingSimon(p){return String(p.id)==='p0'&&String(p.name||'').toLowerCase()==='simon hopkins'}
function normalizeGroupPerson(p){p={...p};if(!p.groups)p.groups=foundingSimon(p)?'MESH, IT':'MESH';if(!p.allGroups)p.allGroups=foundingSimon(p)?'true':'false';p.groups=splitGroups(p.groups).join(', ');p.allGroups=String(p.allGroups)==='true'?'true':'false';return p}
function memberGroups(p){return String(p.allGroups===undefined&&foundingSimon(p)?'true':p.allGroups)==='true'?groupCatalog:splitGroups(!p.groups?'MESH':p.groups).filter(g=>groupCatalog.includes(g))}
let selectedGroups;try{const v=JSON.parse(localStorage.getItem(groupSelectionKey)||'null');selectedGroups=new Set(Array.isArray(v)?v.filter(x=>groupCatalog.includes(x)):groupCatalog)}catch(e){selectedGroups=new Set(groupCatalog)}
if(!selectedGroups.size)selectedGroups=new Set(groupCatalog);
function visiblePeople(){return people.filter(p=>memberGroups(p).some(g=>selectedGroups.has(g)))}
function setGroupVisibility(){localStorage.setItem(groupSelectionKey,JSON.stringify([...selectedGroups]));render(false)}
function groupSave(){groupCatalog=validateGroups(groupCatalog);localStorage.setItem(groupCatalogKey,JSON.stringify(groupCatalog));selectedGroups=new Set([...selectedGroups].filter(g=>groupCatalog.includes(g)));if(!selectedGroups.size)selectedGroups.add(groupCatalog[0]);localStorage.setItem(groupSelectionKey,JSON.stringify([...selectedGroups]));persist();render(false)}
function renderGroupsToolbar(){
 selectedGroups=new Set([...selectedGroups].filter(g=>groupCatalog.includes(g)));if(!selectedGroups.size)selectedGroups=new Set(groupCatalog);
 let bar=document.getElementById('mesh-group-toolbar');if(!bar){bar=document.createElement('div');bar.id='mesh-group-toolbar';document.querySelector('nav.top').after(bar)}
 bar.replaceChildren();const title=document.createElement('strong');title.textContent='Groups';bar.append(title);
 const all=document.createElement('button');all.type='button';all.textContent='All';all.classList.toggle('active',selectedGroups.size===groupCatalog.length);all.onclick=()=>{selectedGroups=new Set(groupCatalog);setGroupVisibility()};bar.append(all);
 for(const group of groupCatalog){const button=document.createElement('button');button.type='button';button.textContent=group+' · '+people.filter(p=>memberGroups(p).includes(group)).length;button.classList.toggle('active',selectedGroups.has(group));button.setAttribute('aria-pressed',String(selectedGroups.has(group)));button.onclick=()=>{if(selectedGroups.has(group)){if(selectedGroups.size===1)return;selectedGroups.delete(group)}else selectedGroups.add(group);setGroupVisibility()};bar.append(button)}
 const count=document.createElement('span');count.textContent=visiblePeople().length+' / '+people.length+' people';bar.append(count);
 const manage=document.createElement('button');manage.type='button';manage.textContent='Manage groups';manage.className='mesh-group-manage';manage.disabled=view==='classic'&&classicDisplayMode==='compact';manage.title=manage.disabled?'Switch to Build to manage groups':'Add, rename or remove organizational groups';manage.onclick=openGroupManager;bar.append(manage)
}
const groupDialog=document.createElement('dialog');groupDialog.className='mesh-group-dialog';document.body.append(groupDialog);
function openGroupManager(){
 groupDialog.replaceChildren();const heading=document.createElement('h2');heading.textContent='Organizational groups';const info=document.createElement('p');info.textContent='A person can belong to multiple groups. Simon can remain a member of all current and future groups.';const list=document.createElement('div');list.className='mesh-group-rows';groupDialog.append(heading,info,list);
 const draw=()=>{list.replaceChildren();for(const name of groupCatalog){const row=document.createElement('div');row.className='mesh-group-row';const label=document.createElement('strong');label.textContent=name;const count=document.createElement('small');count.textContent=people.filter(p=>memberGroups(p).includes(name)).length+' people';const rename=document.createElement('button');rename.textContent='Rename';rename.type='button';rename.onclick=()=>{const next=prompt('Rename group',name);if(next===null||next.trim()===name)return;try{const changed=validateGroups(groupCatalog.map(x=>x===name?next.trim():x));for(const p of people)p.groups=splitGroups(p.groups).map(x=>x===name?next.trim():x).join(', ');groupCatalog=changed;if(selectedGroups.delete(name))selectedGroups.add(next.trim());groupSave();draw()}catch(e){alert(e.message)}};const remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.disabled=groupCatalog.length<=1;remove.onclick=()=>{if(!confirm('Remove '+name+' and its memberships?'))return;groupCatalog=groupCatalog.filter(x=>x!==name);for(const p of people){if(p.allGroups==='true')continue;let groups=splitGroups(p.groups).filter(x=>x!==name);p.groups=(groups.length?groups:[groupCatalog[0]]).join(', ')}groupSave();draw()};row.append(label,count,rename,remove);list.append(row)}};
 const addRow=document.createElement('div');addRow.className='mesh-group-row';const name=document.createElement('input');name.placeholder='New group name';const add=document.createElement('button');add.textContent='+ Add';add.type='button';add.onclick=()=>{try{groupCatalog=validateGroups([...groupCatalog,name.value.trim()]);selectedGroups.add(name.value.trim());name.value='';groupSave();draw()}catch(e){alert(e.message)}};name.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add.click()}};addRow.append(name,add);
 const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>groupDialog.close();groupDialog.append(addRow,close);draw();groupDialog.showModal()
}
function groupPersonPicker(person){
 const block=document.createElement('div');block.className='mesh-person-groups';const h=document.createElement('strong');h.textContent='Organizational groups';const allLabel=document.createElement('label');const all=document.createElement('input');all.type='checkbox';all.checked=String(person.allGroups)==='true';allLabel.append(all,document.createTextNode(' Member of all groups (including future groups)'));block.append(h,allLabel);
 const selected=new Set(splitGroups(person.groups||(!person.id&&selectedGroups.size===1?[...selectedGroups][0]:'MESH'))),list=document.createElement('div');list.className='mesh-group-options';
 function redraw(){list.replaceChildren();for(const group of groupCatalog){const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=all.checked||selected.has(group);check.disabled=all.checked;check.onchange=()=>{if(check.checked)selected.add(group);else selected.delete(group)};label.append(check,document.createTextNode(' '+group));list.append(label)}}all.onchange=redraw;
 const groupsField=document.createElement('input');groupsField.type='hidden';groupsField.id='f_groups';const allField=document.createElement('input');allField.type='hidden';allField.id='f_allGroups';block.capture=()=>{const groups=all.checked?groupCatalog:groupCatalog.filter(g=>selected.has(g));if(!groups.length)throw Error('Select at least one group');groupsField.value=groups.join(', ');allField.value=all.checked?'true':'false'};block.append(list,groupsField,allField);redraw();return block
}
`;
 patch("let lastRenderedView=null;","let lastRenderedView=null;\n"+runtime);
 patch("return rows.map((r,i)=>{if(!r||typeof r!=='object'||!String(r.name??'').trim())throw Error('Missing name on record '+(i+1));","return rows.map((r,i)=>{if(!r||typeof r!=='object'||!String(r.name??'').trim())throw Error('Missing name on record '+(i+1));r=normalizeGroupPerson(r);");
 for(const key of ["function renderClassic(){","function renderClassicCompact(){","function renderSeniority(){","function countryMapRecords(){"]){patch(key,key+"\n const people=visiblePeople();")}
 patch("async function renderCountryMap(){","async function renderCountryMap(){\n const people=visiblePeople();");
 patch("function render(animate=true){renderTypeLegend();","function render(animate=true){renderGroupsToolbar();const people=visiblePeople();renderTypeLegend();");
 patch("filter=e.target.value.trim().toLowerCase();people.forEach(card)","filter=e.target.value.trim().toLowerCase();render(false)");
 patch("for(const f of fields){if(f==='product'){form.append(productPicker(p));continue}","for(const f of fields){if(f==='groups'){form.append(groupPersonPicker(p));continue}if(f==='allGroups')continue;if(f==='product'){form.append(productPicker(p));continue}");
 patch("form.querySelector('.mesh-works-with-picker')?.capture();fields.forEach","form.querySelector('.mesh-works-with-picker')?.capture();try{form.querySelector('.mesh-person-groups')?.capture()}catch(err){alert(err.message);return}fields.forEach");
 patch("</style></head>",`
#mesh-group-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 12px;background:#122831;border-bottom:1px solid #304f57}
#mesh-group-toolbar>strong{font-size:12px;margin-right:6px}
#mesh-group-toolbar button{padding:5px 9px;font-size:11px;background:#1a3540;border:1px solid #486772;border-radius:7px;color:#d6eaea}
#mesh-group-toolbar button.active{background:#176754;border-color:#3fb092}
#mesh-group-toolbar .mesh-group-manage{margin-left:auto}
#mesh-group-toolbar span{font-size:11px;color:#abc8cc}
.mesh-group-dialog{width:min(640px,94vw);max-height:80vh;overflow:auto}
.mesh-group-rows{display:grid;gap:7px;margin:14px 0}
.mesh-group-row{display:flex;gap:8px;align-items:center;border:1px solid #49646e;border-radius:6px;padding:7px}
.mesh-group-row strong,.mesh-group-row input{flex:1;min-width:0}
.mesh-group-row small{color:#aac7c9}
.mesh-person-groups{margin:12px 0;padding:12px;border:1px solid #49646e;border-radius:8px;background:#15333e}
.mesh-person-groups>strong{display:block;margin-bottom:8px}
.mesh-person-groups label{display:inline-flex;align-items:center;gap:6px;margin:5px 12px 5px 0}
.mesh-person-groups input[type=checkbox]{width:16px;min-width:16px;margin:0;accent-color:#42b794}
</style></head>`);

 patch("format:'mesh-v5',environment:MODE,people,types:typeDefinitions,products","format:'mesh-v6',environment:MODE,people,types:typeDefinitions,products,groups:groupCatalog");
 patch("let data;let importedTypes=null,importedProducts=null;","let data;let importedTypes=null,importedProducts=null,importedGroups=null;");
 patch("if(!Array.isArray(obj)&&Array.isArray(obj.products))importedProducts=validatedProducts(obj.products)","if(!Array.isArray(obj)&&Array.isArray(obj.products))importedProducts=validatedProducts(obj.products);if(!Array.isArray(obj)&&Array.isArray(obj.groups))importedGroups=validateGroups(obj.groups)");
 patch("people=incoming;if(importedTypes){typeDefinitions=importedTypes;persistTypes()}products=combinedProducts(importedProducts||[],people);","people=incoming;if(importedTypes){typeDefinitions=importedTypes;persistTypes()}groupCatalog=importedGroups||validateGroups([...new Set([...groupDefaults,...people.flatMap(p=>splitGroups(p.groups))])]);localStorage.setItem(groupCatalogKey,JSON.stringify(groupCatalog));selectedGroups=new Set(groupCatalog);products=combinedProducts(importedProducts||[],people);");
 patch("function chartFingerprint(rows,types,productList=products){","function chartFingerprint(rows,types,productList=products,groupsList=groupCatalog){");
 patch("return JSON.stringify([normalized,colors,validatedProducts(productList)]);","return JSON.stringify([normalized,colors,validatedProducts(productList),validateGroups(groupsList).slice().sort()]);");
 patch("worksWith:'Works with',manager:","worksWith:'Works with',groups:'Groups',allGroups:'All groups',manager:");
 patch("return {rows,fields:rows.length,people:affected.size,types};","for(const name of new Set([...groupCatalog,...(publishedDocument.groups||groupDefaults)])){const local=groupCatalog.includes(name),remote=(publishedDocument.groups||groupDefaults).includes(name);if(local!==remote)rows.push({who:'Group catalogue',field:'Group',local:local?name:'—',published:remote?name:'—'})}return {rows,fields:rows.length,people:affected.size,types};");
 patch("JSON.stringify({people,types:typeDefinitions,products})","JSON.stringify({people,types:typeDefinitions,products,groups:groupCatalog})");
 patch("products=combinedProducts(publishedDocument.products,publishedDocument.people);localStorage.setItem(catalogKey,JSON.stringify(products));","products=combinedProducts(publishedDocument.products,publishedDocument.people);groupCatalog=validateGroups(publishedDocument.groups||groupDefaults);localStorage.setItem(groupCatalogKey,JSON.stringify(groupCatalog));localStorage.setItem(catalogKey,JSON.stringify(products));");
 patch("const publishedProducts=combinedProducts(data.products||[],publishedPeople);","const publishedProducts=combinedProducts(data.products||[],publishedPeople);const publishedGroups=validateGroups(data.groups||groupDefaults);");
 patch("publishedSnapshot=chartFingerprint(publishedPeople,publishedTypes,publishedProducts);","publishedSnapshot=chartFingerprint(publishedPeople,publishedTypes,publishedProducts,publishedGroups);");
 patch("publishedDocument={people:publishedPeople,types:publishedTypes,products:publishedProducts};","publishedDocument={people:publishedPeople,types:publishedTypes,products:publishedProducts,groups:publishedGroups};");
 patch("products=combinedProducts(JSON.parse(localStorage.getItem(catalogKey)||'[]'),people);unpublishedDraft=true;","products=combinedProducts(JSON.parse(localStorage.getItem(catalogKey)||'[]'),people);try{groupCatalog=validateGroups(JSON.parse(localStorage.getItem(groupCatalogKey)||'null'))}catch(e){groupCatalog=publishedGroups}unpublishedDraft=true;");
 patch("people=publishedPeople;typeDefinitions=publishedTypes;products=publishedProducts;unpublishedDraft=false;","people=publishedPeople;typeDefinitions=publishedTypes;products=publishedProducts;groupCatalog=publishedGroups;unpublishedDraft=false;");
 patch("}else{people=publishedPeople;typeDefinitions=publishedTypes;products=publishedProducts;unpublishedDraft=false}","}else{people=publishedPeople;typeDefinitions=publishedTypes;products=publishedProducts;groupCatalog=publishedGroups;unpublishedDraft=false}");
 patch("ensureLegacyTypes();localStorage.setItem(catalogKey,JSON.stringify(products));","ensureLegacyTypes();localStorage.setItem(catalogKey,JSON.stringify(products));localStorage.setItem(groupCatalogKey,JSON.stringify(groupCatalog));selectedGroups=new Set([...selectedGroups].filter(x=>groupCatalog.includes(x)));if(!selectedGroups.size)selectedGroups=new Set(groupCatalog);");
 patch("types:typeDefinitions,products});","types:typeDefinitions,products,groups:groupCatalog});");
 patch('data-version="1.44.0"','data-version="1.45.1"');
 return s;
}
