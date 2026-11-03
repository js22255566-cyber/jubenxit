using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Diagnostics;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

// Per-user, offline installer. Cloud credentials and browser data are never read.
class Installer : Form {
 const string Version="0.1.0";
 const string RegistryPath=@"Software\Microsoft\Windows\CurrentVersion\Uninstall\DialogueAtelierDesktop";
 static readonly string Root=Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","DialogueAtelierDesktop"));
 static readonly string AppDir=Path.Combine(Root,"app");
 static readonly string AppExe=Path.Combine(AppDir,"对白工坊.exe");
 Label title=new Label(), description=new Label(), progress=new Label();
 Button proceed=new Button();
 CheckBox shortcut=new CheckBox();
 bool finished=false;
#if UNINSTALLER
 const bool Removing=true;
#else
 const bool Removing=false;
#endif
 [STAThread] static void Main(string[] args) {
  if(args.Length==1&&args[0]=="--verify-payload") {
   try { Verify(); File.WriteAllText(Assembly.GetExecutingAssembly().Location+".verified.txt","Payload checksum and archive paths verified; no installation performed.");Environment.Exit(0); }
   catch(Exception ex) { File.WriteAllText(Assembly.GetExecutingAssembly().Location+".verified.txt",ex.Message);Environment.Exit(1); }
   return;
  }
  Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false); Application.Run(new Installer());
 }
 Installer() {
  Text=Removing?"卸载对白工坊":"安装对白工坊";ClientSize=new Size(520,310);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;Font=new Font("Microsoft YaHei UI",10);
  title.Text=Removing?"卸载对白工坊":"对白工坊 · Windows 桌面版";title.Font=new Font(Font.FontFamily,18,FontStyle.Bold);title.SetBounds(28,25,470,42);
  description.Text=Removing?"将移除应用和快捷方式。\n登录、本地草稿和发送记录将保留。":"工坊与 WhatsApp 在同一个应用中。\n安装到当前 Windows 用户，无需管理员权限。\n\n浏览器中未同步的消息不会自动迁移，请保留原网页。";description.SetBounds(30,84,460,115);
  shortcut.Text="创建桌面快捷方式";shortcut.Checked=true;shortcut.SetBounds(30,204,300,26);shortcut.Visible=!Removing;
  progress.SetBounds(30,238,320,40);progress.ForeColor=Color.FromArgb(70,110,88);
  proceed.Text=Removing?"卸载":"安装";proceed.SetBounds(370,247,115,37);proceed.Click+=async (sender,eventArgs)=>{if(finished){Close();return;}proceed.Enabled=false;shortcut.Enabled=false;bool wantShortcut=shortcut.Checked;try{if(Removing)await Task.Run((Action)Uninstall);else await Task.Run(()=>Install(wantShortcut));finished=true;progress.Text=Removing?"卸载完成，用户数据已保留。":"安装完成，可从桌面或开始菜单打开。";proceed.Text="完成";}catch(Exception ex){MessageBox.Show(this,ex.Message,"操作未完成",MessageBoxButtons.OK,MessageBoxIcon.Warning);progress.Text="原有用户数据未作清理。";shortcut.Enabled=true;}finally{proceed.Enabled=true;}};
  Controls.AddRange(new Control[]{title,description,shortcut,progress,proceed});
  FormClosing+=(sender,e)=>{if(!proceed.Enabled)e.Cancel=true;};
 }
 static void CheckChild(string path) {string full=Path.GetFullPath(path);if(!full.StartsWith(Root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("安装路径校验失败。");}
 static string EntryPath(string folder,string name) {
  if(Path.IsPathRooted(name)||name.IndexOf(':')>=0)throw new InvalidDataException("安装包包含无效路径。");
  string target=Path.GetFullPath(Path.Combine(folder,name.Replace('/',Path.DirectorySeparatorChar)));
  if(!target.StartsWith(Path.GetFullPath(folder)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("安装包路径超出目标目录。");
  return target;
 }
 static Stream Payload() {Stream s=Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload.zip");if(s==null)throw new InvalidDataException("安装包缺少应用文件。");return s;}
 static void Verify() {
  using(Stream s=Payload())using(var sha=SHA256.Create()){string actual=BitConverter.ToString(sha.ComputeHash(s)).Replace("-","").ToLowerInvariant();if(actual!=PayloadHash.Value)throw new InvalidDataException("安装包完整性校验失败，请重新下载。");}
  using(Stream s=Payload())using(var zip=new ZipArchive(s,ZipArchiveMode.Read)) {bool app=false;foreach(var entry in zip.Entries){EntryPath(Path.Combine(Root,"verify"),entry.FullName);if(((entry.ExternalAttributes>>16)&0xF000)==0xA000)throw new InvalidDataException("安装包包含不允许的链接。");if(entry.FullName=="对白工坊.exe")app=true;}if(!app)throw new InvalidDataException("安装包缺少主程序。");}
 }
 static void EnsureClosed(){foreach(var process in Process.GetProcessesByName("对白工坊")){try{if(String.Equals(Path.GetFullPath(process.MainModule.FileName),AppExe,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("请先退出正在运行的对白工坊，再继续操作。");}catch(System.ComponentModel.Win32Exception){}finally{process.Dispose();}}}
 static void NoLinks(string folder) {CheckChild(folder);if(!Directory.Exists(folder))return;if((File.GetAttributes(folder)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("安装目录不是普通文件夹。");foreach(var item in Directory.EnumerateFileSystemEntries(folder)){var attr=File.GetAttributes(item);if((attr&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("安装目录中存在链接，已停止操作。");if((attr&FileAttributes.Directory)!=0)NoLinks(item);}}
 static void RemoveDirectory(string folder){CheckChild(folder);NoLinks(folder);if(Directory.Exists(folder))Directory.Delete(folder,true);}
 static void Install(bool desktopShortcut) {
  Verify();EnsureClosed();Directory.CreateDirectory(Root);if((File.GetAttributes(Root)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("安装根目录不是普通文件夹。");
  string stage=Path.Combine(Root,"stage-"+Guid.NewGuid().ToString("N")),backup=Path.Combine(Root,"backup-"+Guid.NewGuid().ToString("N"));CheckChild(stage);CheckChild(backup);Directory.CreateDirectory(stage);
  try {
   using(Stream s=Payload())using(var zip=new ZipArchive(s,ZipArchiveMode.Read))foreach(var entry in zip.Entries){string target=EntryPath(stage,entry.FullName);if(String.IsNullOrEmpty(entry.Name)){Directory.CreateDirectory(target);continue;}Directory.CreateDirectory(Path.GetDirectoryName(target));using(var input=entry.Open())using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write))input.CopyTo(output);}
   if(Directory.Exists(AppDir)){NoLinks(AppDir);Directory.Move(AppDir,backup);}
   try{Directory.Move(stage,AppDir);}catch{if(Directory.Exists(backup)&&!Directory.Exists(AppDir))Directory.Move(backup,AppDir);throw;}
   File.Copy(Path.Combine(AppDir,"Uninstall.exe"),Path.Combine(Root,"Uninstall.exe"),true);
   CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.Programs));if(desktopShortcut)CreateShortcut(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
   using(var key=Registry.CurrentUser.CreateSubKey(RegistryPath)){key.SetValue("DisplayName","对白工坊");key.SetValue("DisplayVersion",Version);key.SetValue("Publisher","Dialogue Atelier");key.SetValue("InstallLocation",AppDir);key.SetValue("DisplayIcon",AppExe);key.SetValue("UninstallString","\""+Path.Combine(Root,"Uninstall.exe")+"\"");key.SetValue("NoModify",1,RegistryValueKind.DWord);key.SetValue("NoRepair",1,RegistryValueKind.DWord);}
   if(Directory.Exists(backup))RemoveDirectory(backup);
  }finally{if(Directory.Exists(stage))RemoveDirectory(stage);}
 }
 static void CreateShortcut(string folder){Directory.CreateDirectory(folder);Type type=Type.GetTypeFromProgID("WScript.Shell");dynamic shell=Activator.CreateInstance(type);dynamic link=shell.CreateShortcut(Path.Combine(folder,"对白工坊.lnk"));link.TargetPath=AppExe;link.WorkingDirectory=AppDir;link.Description="对白工坊桌面版";link.Save();}
 static void DeleteShortcut(string folder){string file=Path.Combine(folder,"对白工坊.lnk");if(!File.Exists(file))return;dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));dynamic link=shell.CreateShortcut(file);if(String.Equals((string)link.TargetPath,AppExe,StringComparison.OrdinalIgnoreCase))File.Delete(file);}
 static void Uninstall(){EnsureClosed();if(Directory.Exists(Root)&&(File.GetAttributes(Root)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("安装根目录不是普通文件夹。");RemoveDirectory(AppDir);DeleteShortcut(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));DeleteShortcut(Environment.GetFolderPath(Environment.SpecialFolder.Programs));Registry.CurrentUser.DeleteSubKeyTree(RegistryPath,false);}
}
