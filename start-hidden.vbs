' Starts the Service Health Board with no console window. Used by the "ServiceHealthBoard" logon task.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run """C:\Program Files\nodejs\node.exe"" server.mjs", 0, False
