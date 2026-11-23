import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
 const b=fs.readFileSync(f),pe=b.readUInt32LE(60),n=b.readUInt16LE(pe+6),opt=pe+24,size=b.readUInt16LE(pe+20),magic=b.readUInt16LE(opt),dd=opt+(magic===0x10b?96:112),sections=[];
 for(let p=opt+size,i=0;i<n;i++,p+=40) sections.push({rva:b.readUInt32LE(p+12),raw:b.readUInt32LE(p+20),size:Math.max(b.readUInt32LE(p+8),b.readUInt32LE(p+16))});
 const off=r=>{const s=sections.find(s=>r>=s.rva&&r<s.rva+s.size);return s?s.raw+r-s.rva:0;};
 const str=p=>b.subarray(p,b.indexOf(0,p)).toString(); let p=off(b.readUInt32LE(dd+8)),imports=[];
 if(p) while(b.readUInt32LE(p+12)){imports.push(str(off(b.readUInt32LE(p+12))));p+=20;}
 console.log(JSON.stringify({f,machine:b.readUInt16LE(pe+4).toString(16),imports}));
}
