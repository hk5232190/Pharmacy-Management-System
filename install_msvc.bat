@echo off
echo Downloading Visual Studio Build Tools...
curl -sL https://aka.ms/vs/17/release/vs_buildtools.exe -o %TEMP%\vs_buildtools.exe
echo Installing C++ Build Tools (This may take 10-15 minutes, please wait...)
%TEMP%\vs_buildtools.exe --quiet --wait --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools;includeRecommended
echo Installation complete!
