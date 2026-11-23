'use strict';
fetch('downloads.json').then(r=>{if(!r.ok)throw Error('Downloads metadata unavailable.');return r.json();}).then(m=>{
 const list=document.querySelector('#ags-download-list');
 for(const a of m.artifacts){const row=document.createElement('p'),link=document.createElement('a'),details=document.createElement('small');link.href=a.url;link.rel='noopener';link.textContent=a.title+' · v'+a.version+' · '+a.bytes.toLocaleString()+' bytes';details.textContent='SHA-256 '+a.sha256;row.append(link,document.createElement('br'),details);list.append(row);}
 document.querySelector('#ags-download-status').textContent='Private game downloads · AGS '+m.version;
}).catch(e=>{document.querySelector('#ags-download-status').textContent=e.message;});
