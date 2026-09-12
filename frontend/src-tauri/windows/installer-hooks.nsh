; Force-close every executable name used by current and previous PMS releases
; before NSIS writes into Program Files. PyInstaller's one-file bootstrap can
; leave its worker process alive after the desktop window has closed, and a
; prompt-only running-process check still lets users choose Ignore and install
; mismatched frontend/backend binaries.
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

; The same protection is needed when uninstalling before a clean reinstall.
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillPmsProcesses
!macroend
