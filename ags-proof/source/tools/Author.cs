using System;
using System.IO;
using System.Reflection;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using AGS.Types;
using Font=System.Drawing.Font;
using View=AGS.Types.View;

// Version-pinned local authoring adapter. No third-party bridge, HTTP listener or runtime plugin.
class Author {
 static Assembly asm; static object editor,native; static Game game;
 static readonly BindingFlags All=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static;
 static object Get(object o,string n) { return o.GetType().GetProperty(n,All).GetValue(o,null); }
 static object Call(object o,string n,params object[] a) {
   foreach(var m in o.GetType().GetMethods(All)) if(m.Name==n && m.GetParameters().Length==a.Length) return m.Invoke(o,a);
   throw new Exception("No method: "+n+"/"+a.Length);
 }
 static object Factory(string n) { return asm.GetType("AGS.Editor.Factory").GetProperty(n,All).GetValue(null,null); }
 static Bitmap Mask(Action<Bitmap> fill) {
   var b=new Bitmap(320,240,PixelFormat.Format8bppIndexed); var p=b.Palette;
   for(int i=0;i<256;i++) p.Entries[i]=Color.FromArgb(i,i,i); b.Palette=p;
   fill(b); return b;
 }
 static void Rect(Bitmap b,int x,int y,int w,int h,byte c) {
   var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadWrite,b.PixelFormat);
   var row=new byte[d.Stride]; for(int yy=y;yy<y+h;yy++) { Marshal.Copy(IntPtr.Add(d.Scan0,yy*d.Stride),row,0,row.Length); for(int xx=x;xx<x+w;xx++)row[xx]=c; Marshal.Copy(row,0,IntPtr.Add(d.Scan0,yy*d.Stride),row.Length); } b.UnlockBits(d);
 }
 static Bitmap Background(int n,bool edit) {
   var b=new Bitmap(320,240,PixelFormat.Format32bppArgb); using(var g=Graphics.FromImage(b)) {
    g.Clear(n==2?Color.FromArgb(71,56,48):Color.FromArgb(40,80,65));
    g.FillRectangle(new SolidBrush(n==2?Color.FromArgb(133,103,74):Color.FromArgb(162,143,101)),0,100,320,140);
    g.FillRectangle(Brushes.SaddleBrown,270,55,38,90); g.FillRectangle(Brushes.Black,278,67,23,73);
    if(n==1) {g.FillRectangle(Brushes.SaddleBrown,195,70,15,115); g.FillEllipse(Brushes.DarkGreen,164,30,80,80);}
    if(n==2) {g.FillRectangle(Brushes.Chocolate,165,120,48,28);g.FillEllipse(Brushes.Bisque,180,85,12,12);g.FillRectangle(Brushes.CadetBlue,178,97,16,25);}
    if(n==3) {g.FillEllipse(Brushes.CornflowerBlue,90,110,70,36);g.FillRectangle(Brushes.Goldenrod,135,170,12,12);}
    if(edit){g.FillEllipse(Brushes.MediumPurple,24,55,35,35);if(n==1){g.FillRectangle(Brushes.Goldenrod,9,193,5,39);g.DrawString("Garden",new Font("Arial",8),Brushes.White,15,204);}}
    g.DrawString(n==1?"COURTYARD":n==2?"HEALER'S HUT":"PROMPT GARDEN",new Font("Arial",10,FontStyle.Bold),Brushes.White,8,8);
    g.DrawString("Door",new Font("Arial",8),Brushes.White,275,45);
   } return b;
 }
 static void Room(int n,bool edit) {
   UnloadedRoom old=null; foreach(var r in game.RootRoomFolder.AllItemsFlat)if(r.Number==n)old=(UnloadedRoom)r;
   bool fresh=old==null; Room room;
   if(fresh) {
    room=new Room(n);room.GameID=game.Settings.UniqueID;room.Width=320;room.Height=240;room.MaskResolution=1;room.ColorDepth=32;room.BackgroundCount=1;room.RightEdgeX=319;room.BottomEdgeY=239;
    room.Interactions.ScriptModule=room.ScriptFileName;
    Call(native,"SaveDefaultRoom",room); old=new UnloadedRoom(n);game.RootRoomFolder.Items.Add(old);
   }
   if(!File.Exists(old.ScriptFileName))File.WriteAllText(old.ScriptFileName,"// Room\n");old.LoadScript();
   room=(Room)Call(native,"LoadRoom",old,null);room.Description=n==1?"Courtyard":n==2?"Healer's hut":"Prompt garden";
   room.Interactions.ScriptModule=room.ScriptFileName;room.Interactions.SetScriptFunctionNameForInteractionSuffix("Load","room_Load");
   room.Hotspots[1].Name="hDoor";room.Hotspots[1].Description="Door";
   room.Hotspots[2].Name=n==2?"hMira":"hHerb";room.Hotspots[2].Description=n==2?"Mira the healer":"Herb";
   room.Hotspots[3].Name="hTree";room.Hotspots[3].Description="Tree";
   room.Objects.Clear();
   if(n==1)room.Objects.Add(new RoomObject(room){ID=0,Name="oHerb",Description="Healing herb",StartX=70,StartY=168,Image=game.RootInventoryItemFolder.Items[0].Image});
   room.WalkBehinds[1].Baseline=185;
   using(var b=Background(n,edit)) {Call(native,"ImportBackground",room,0,b,false,false);b.Save("room"+n+"-background.png");}
   using(var b=Mask(delegate(Bitmap a){Rect(a,3,145,314,92,1);if(n==1)Rect(a,193,145,19,41,0);if(edit)Rect(a,32,190,30,20,0);})) {Call(native,"ImportAreaMask",room,RoomAreaMaskType.WalkableAreas,b);b.Save("room"+n+"-walk.png");}
   using(var b=Mask(delegate(Bitmap a){Rect(a,268,55,41,91,1);if(n==1)Rect(a,64,150,34,24,2);if(n==2)Rect(a,168,80,46,70,2);if(n==3)Rect(a,132,163,20,22,2);})) {Call(native,"ImportAreaMask",room,RoomAreaMaskType.Hotspots,b);b.Save("room"+n+"-hotspots.png");}
   using(var b=Mask(delegate(Bitmap a){if(n==1){Rect(a,195,70,15,115,1);Rect(a,164,30,80,60,1);}})) {Call(native,"ImportAreaMask",room,RoomAreaMaskType.WalkBehinds,b);b.Save("room"+n+"-foreground.png");}
   room.Script.Text="function room_Load() { Arrive(); }\n";room.Script.SaveToDisk(true);
   Call(native,"SaveRoom",room);Call(native,"UnloadRoom",room);
   // Native SaveRoom may retain compiled bytecode. Force /compile to rebuild the .asc.
   File.SetLastWriteTimeUtc(room.FileName,new DateTime(2000,1,1,0,0,0,DateTimeKind.Utc));
   Console.WriteLine((fresh?"created ":"edited ")+room.FileName);
 }
 [STAThread] static int Main(string[] args) {
  try {
   string ed=AppDomain.CurrentDomain.BaseDirectory, dir=Path.GetFullPath(args[0]); bool edit=args.Length>1&&args[1]=="edit";
   Directory.SetCurrentDirectory(ed);asm=Assembly.LoadFrom(Path.Combine(ed,"AGSEditor.exe"));
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   var app=Activator.CreateInstance(asm.GetType("AGS.Editor.ApplicationController"),All,null,new object[]{new string[]{"/compile",Path.Combine(dir,"Game.agf")}},null);
   editor=Factory("AGSEditor");native=Factory("NativeProxy");
   if(!(bool)Call(Get(editor,"Tasks"),"LoadGameFromDisk",Path.Combine(dir,"Game.agf"),false))throw new Exception("Load failed");
   game=(Game)Get(editor,"CurrentGame");
   game.Settings.GameName="Quest Lab AGS Proof";game.Settings.GameFileName="questlab-proof";game.Settings.SaveGameFolderName="QuestLabAGSProof";
   game.Settings.CustomResolution=new Size(320,240);game.Settings.DebugMode=false;game.Settings.BuildTargets="Windows, Web";
   game.RootGUIFolder.Items.Clear();
   var hero=game.PlayerCharacter;hero.StartingRoom=1;hero.StartX=120;hero.StartY=210;hero.RealName="Loom";
   if(!edit) {
    var api=(IAGSEditor)app.GetType().GetField("_pluginEditorController",All).GetValue(app);
    int sprite;
    using(var b=new Bitmap(14,26)) {using(var g=Graphics.FromImage(b)){g.Clear(Color.Transparent);g.FillEllipse(Brushes.Bisque,4,0,7,7);g.FillRectangle(Brushes.RoyalBlue,3,7,9,11);g.FillRectangle(Brushes.DarkBlue,3,18,4,8);g.FillRectangle(Brushes.DarkBlue,9,18,4,8);} sprite=api.CreateNewSprite(game.RootSpriteFolder,b,SpriteImportTransparency.LeaveAsIs,true).Number;}
    game.RootViewFolder.Items.Clear();var view=new View{ID=1,Name="vHero"};for(int i=0;i<4;i++){var loop=new ViewLoop(i);loop.Frames.Add(new ViewFrame{ID=0,Image=sprite});view.Loops.Add(loop);}game.RootViewFolder.Items.Add(view);hero.NormalView=1;
    int herbSprite;using(var b=new Bitmap(18,12)){using(var g=Graphics.FromImage(b)){g.Clear(Color.Transparent);g.FillEllipse(Brushes.LimeGreen,1,2,16,8);}herbSprite=api.CreateNewSprite(game.RootSpriteFolder,b,SpriteImportTransparency.LeaveAsIs,true).Number;}
    game.RootInventoryItemFolder.Items.Clear();game.RootInventoryItemFolder.Items.Add(new InventoryItem(1,"iHerb"){Description="Healing herb",Image=herbSprite});
   }
   Room(1,edit);Room(2,false);if(edit)Room(3,true);
   game.TextParser.Words.Clear();string[][] words={new[]{"look","inspect"},new[]{"take","get","pick"},new[]{"herb","plant"},new[]{"enter","open"},new[]{"door","hut"},new[]{"talk","speak"},new[]{"healer","mira"},new[]{"give","offer"},new[]{"leave","exit"},new[]{"garden"},new[]{"inventory","bag"},new[]{"about"}};
   for(int i=0;i<words.Length;i++)foreach(string w in words[i])game.TextParser.Words.Add(new TextParserWord{Word=w,WordGroup=i+1});game.TextParser.Words.Add(new TextParserWord{Word="stone",WordGroup=13});game.TextParser.Words.Add(new TextParserWord{Word="sunstone",WordGroup=13});
   if(!(bool)Call(editor,"SaveGameFiles"))throw new Exception("Save failed");
   Console.WriteLine("saved native project "+dir);Call(app,"GUIController_OnEditorShutdown");Call(editor,"Dispose");Application.Exit();return 0;
  } catch(Exception e) {Console.Error.WriteLine(e);Environment.Exit(1);return 1;}
 }
}
