; PMS NSIS Installer Hooks

!macro KillPmsProcesses
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "PMSL.exe"'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "pms-app.exe"'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "pms-backend.exe"'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "pms-backend-x86_64-pc-windows-msvc.exe"'
  Sleep 750
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro KillPmsProcesses
!macroend

!macro NSIS_HOOK_INSTALL
  ; Add Windows Defender exclusion so the 1086 backend files are NOT scanned on every launch.
  ; Without this, Defender scans all DLLs in pms-backend\_internal\ causing 5+ minute startup.
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Add-MpPreference -ExclusionPath \"$INSTDIR\pms-backend\" -ErrorAction SilentlyContinue"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillPmsProcesses
!macroend

!macro NSIS_HOOK_UNINSTALL
  ; Remove Defender exclusion on uninstall
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Remove-MpPreference -ExclusionPath \"$INSTDIR\pms-backend\" -ErrorAction SilentlyContinue"'
!macroend