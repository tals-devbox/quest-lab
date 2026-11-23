using System;
using System.IO;
using System.Reflection;
class Probe {
  [STAThread] static int Main(string[] args) {
    try {
      Console.WriteLine("load");
      var asm=Assembly.LoadFrom(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"AGSEditor.exe"));
      Console.WriteLine("native");
      var type=asm.GetType("AGS.Editor.NativeProxy",true);
      var native=type.GetProperty("Instance",BindingFlags.Public|BindingFlags.Static).GetValue(null,null);
      Console.WriteLine("native ready");
      if(args.Length==2) {
        Directory.CreateDirectory(args[1]); Directory.SetCurrentDirectory(args[1]);
        type.GetMethod("ExtractTemplateFiles").Invoke(native,new object[]{args[0]});
        Console.WriteLine("extracted");
      }
      return 0;
    } catch(Exception e) { Console.WriteLine(e); return 1; }
  }
}
