' Starts the Service Health Board supervisor with no console window. Used by the "ServiceHealthBoard" logon task.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\run-loop.ps1""", 0, False
