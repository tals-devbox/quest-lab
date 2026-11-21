declare const __QUEST_LAB_APP_VERSION__:string;
/** Compiled into the running bundle, so it cannot be confused with latest online metadata. */
export const APP_VERSION=typeof __QUEST_LAB_APP_VERSION__==='string'?__QUEST_LAB_APP_VERSION__:'development';
