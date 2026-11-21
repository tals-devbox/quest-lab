/** Phaser DisplayList.removeAll(true) skips removal callbacks; it does not
 * destroy objects. Retire input first, then destroy a copied list so a scene
 * refresh cannot leave invisible objects intercepting later pointer events. */
export function destroySceneObjects(list:{getChildren():{disableInteractive?():unknown;destroy():unknown}[]}):void {
 for(const object of list.getChildren().slice()){
  object.disableInteractive?.();
  object.destroy();
 }
}
