' WordForge 服务器静默自启动脚本
' 放置在 Windows 启动文件夹中，开机自动运行
' 不会弹出命令行窗口，在后台静默运行

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取脚本所在目录的绝对路径
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
backendDir = scriptDir & "\backend"

' 等待网络就绪（开机后网络可能需要几秒才能连接）
WScript.Sleep 5000

' 静默启动服务器（0 = 隐藏窗口）
WshShell.Run "cmd /c cd /d """ & backendDir & """ && python main.py", 0, False

' 记录启动日志
Set logFile = fso.OpenTextFile(scriptDir & "\auto_start.log", 8, True)
logFile.WriteLine Now & " - WordForge 服务器已自动启动"
logFile.Close
