/** Source-linked resting or representative poses for native-state scenes whose
 * source scripts are not running. They are presentation, never gameplay state. */
export interface StoryPose {entityId:string;view:number;loop:number;cel:number;x:number;y:number;sourceRef:string}
export interface StoryProjection {poses:StoryPose[];hidden:string[]}
export function storyProjection(state:{room:number;flags:Record<string,unknown>;minutes?:number}):StoryProjection {
  const poses:StoryPose[]=[],hidden:string[]=[];
  if(state.room===15){
    if(state.flags.koboldKey)hidden.push('kobKey');
    else if(state.flags.koboldDefeated)poses.push({entityId:'kobKey',view:178,loop:6,cel:0,x:229,y:85,sourceRef:'rm15.sc:335-345,483-491'});
  }
  if(state.room===16){
    if(state.flags.seedFound)hidden.push('flyingSeed');
    else poses.push({entityId:'flyingSeed',view:16,loop:4,cel:0,x:110,y:48,sourceRef:'rm16.sc:625-639,1637-1650'});
  }
  if(state.room===60){
    // rm60.sc:698-707 defines the dropped fur; the Meep's offer initializes
    // it in the source script at1481. Native dialogue records the same offer.
    if(state.flags.meepFurVisible&&!state.flags['rule:meep-fur'])poses.push({entityId:'fur',view:61,loop:8,cel:0,x:173,y:105,sourceRef:'rm60.sc:698-707,1481'});
    else hidden.push('fur');
  }
  if(state.room===22){
    if(state.flags.skullGem){
      poses.push({entityId:'gate',view:23,loop:0,cel:0,x:194,y:229,sourceRef:'rm22.sc:610-624'});
      hidden.push('gateEyes');
    }
    if(state.flags.babaBanished)hidden.push('hut','feet','hutDoor','wing1','wing2');
    else{
      // Settled source poses after the initial landing and the spoken rhyme.
      // The native scene does not execute the original landing animation.
      poses.push({entityId:'hut',view:22,loop:0,cel:0,x:221,y:state.flags.hutDown?122:98,sourceRef:'rm22.sc:941-946,978-987'});
      poses.push({entityId:'feet',view:22,loop:2,cel:0,x:156,y:state.flags.hutDown?152:142,sourceRef:'rm22.sc:942,975'});
      if(state.flags.hutDown)poses.push({entityId:'hutDoor',view:22,loop:5,cel:6,x:189,y:83,sourceRef:'rm22.sc:991,379-388'});
      else hidden.push('hutDoor');
    }
  }
  if(state.room===64){
    // Native picking is offered in its midnight window. Use the source plant
    // pose rather than an empty baseline sampled before it initialized.
    if(!state.flags.mandrakeTaken&&state.minutes!==undefined&&state.minutes>=0&&state.minutes<=30)poses.push({entityId:'mandrake',view:63,loop:3,cel:0,x:214,y:150,sourceRef:'rm64.sc:98-99,518-526'});
    else hidden.push('mandrake');
  }
  if(state.room===84&&state.flags.secretEntrance){
    // The source rock uses z=100; the settled display anchor is y-z=3.
    poses.push({entityId:'theRock',view:84,loop:0,cel:4,x:62,y:3,sourceRef:'rm84.sc:90,773-800,414-427'});
  }
  if(state.room===93&&state.flags.minotaurCalmed&&!state.flags.minotaurDefeated){
    // rm93's Calm sequence settles him to sleep at x=112. Patrol y varies;
    // native presentation uses the source initial patrol y as representative.
    poses.push({entityId:'minotaur',view:426,loop:2,cel:2,x:112,y:170,sourceRef:'rm93.sc:750-760,1110-1166'});
  }
  if(state.room===95){
    // Settled final poses from the source action scripts; native flags represent
    // completed actions, not a simulation of pursuer or swing timing.
    if(state.flags.diningFrontBarred)poses.push({entityId:'fDoor',view:95,loop:8,cel:0,x:272,y:189,sourceRef:'rm95.sc:192-214,558-581'});
    if(state.flags.diningChairBlocked)poses.push({entityId:'chairBlockDoor',view:95,loop:7,cel:1,x:285,y:92,sourceRef:'rm95.sc:327-354,853-903'});
    if(state.flags.diningCandelabraDown)poses.push({entityId:'theCandelabra',view:95,loop:4,cel:5,x:236,y:86,sourceRef:'rm95.sc:217-249,910-968'});
    if(state.flags.diningKnochelkopfsDown)hidden.push('rope');
  }
  if(state.room===97&&state.flags.mirrorFound){
    // The native desk action collects the mirror and both potions together.
    hidden.push('mirror','potion1','potion2');
  }
  if(state.room===89&&!state.flags.trollDefeated){
    poses.push({entityId:'troll',view:450,loop:0,cel:0,x:250,y:95,sourceRef:'rm89.sc:88-98'});
  }
  return {poses,hidden};
}
