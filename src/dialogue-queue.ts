/** A source speech cue must not replace a file picker, stat sheet or other owned dialog. */
export function waitForDialogGap(isCurrent:()=>boolean,root:Document=document):Promise<boolean>{
 if(!isCurrent()||!root.querySelector('dialog[open]'))return Promise.resolve(isCurrent());
 return new Promise(resolve=>{const observer=new MutationObserver(()=>{if(!isCurrent()||!root.querySelector('dialog[open]')){observer.disconnect();resolve(isCurrent());}});observer.observe(root.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});});
}
