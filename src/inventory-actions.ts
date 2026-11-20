import {availableActions, type Action, type Campaign, type GameState} from './rules';

/** Inventory actions that affect the hero directly. The reducer remains the
 * authority for room, class, item and quest gates; scene/NPC targets stay in
 * the scene, even when their target happens to have the same name as an item. */
export function inventorySelfActionsFor(state:GameState,campaign:Campaign,item:string):Action[]{
  if(state.dead||state.won||!(state.inventory[item]>0))return [];
  return availableActions(state,campaign).filter(a=>a.item===item&&
    (a.type==='eat'||a.type==='drink'||(a.type==='use'&&a.target==='self')));
}
