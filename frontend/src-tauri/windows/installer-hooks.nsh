; Stop every executable name used by current and previous PMS releases before
; NSIS writes into Program Files.  Tauri's generated installer only checks the
; current main binary, so legacy frontends and orphaned sidecars can otherwise
; keep destination files locked during an update.
!macro NSIS_HOOK_PREINSTALL
  !insertmacro CheckIfAppIsRunning "PMSL.exe" "Pharmacy Management System"
  !insertmacro CheckIfAppIsRunning "pms-app.exe" "Pharmacy Management System"
  !insertmacro CheckIfAppIsRunning "pms-backend.exe" "Pharmacy Management System backend"
  !insertmacro CheckIfAppIsRunning "pms-backend-x86_64-pc-windows-msvc.exe" "Pharmacy Management System backend"
!macroend

; The same protection is needed when uninstalling before a clean reinstall.
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro CheckIfAppIsRunning "PMSL.exe" "Pharmacy Management System"
  !insertmacro CheckIfAppIsRunning "pms-app.exe" "Pharmacy Management System"
  !insertmacro CheckIfAppIsRunning "pms-backend.exe" "Pharmacy Management System backend"
  !insertmacro CheckIfAppIsRunning "pms-backend-x86_64-pc-windows-msvc.exe" "Pharmacy Management System backend"
!macroend
