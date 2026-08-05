@echo off
set "NODE_DIR=%USERPROFILE%\.codex\tools\node-v24.19.0-win-x64"
set "NPM_PREFIX=%USERPROFILE%\.npm-global"
set "PATH=%NODE_DIR%;%NPM_PREFIX%;%PATH%"

if "%~1"=="" (
  "%NPM_PREFIX%\wrangler.cmd" --version
) else (
  "%NPM_PREFIX%\wrangler.cmd" %*
)
