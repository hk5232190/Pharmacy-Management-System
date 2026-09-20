OutFile "test.exe"
InstallDir "$PROGRAMFILES\Test"
Section
  SetOutPath "$INSTDIR"
  File /r "frontend\src-tauri\pms-backend\*.*"
SectionEnd
