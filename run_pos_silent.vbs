' Portable Silent Launcher for POS Sale App
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strPath = fso.GetParentFolderName(WScript.ScriptFullName)
batFile = strPath & "\RUN_POS.bat"

WshShell.CurrentDirectory = strPath
WshShell.Run """" & batFile & """", 0, False

