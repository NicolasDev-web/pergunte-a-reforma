@echo off
rem ============================================================================
rem  Pergunte a Reforma - liga o motor oficial da Receita e o site no Windows.
rem  Dois cliques neste arquivo. Na primeira vez ele baixa o projeto e o que faltar
rem  (Git, Node 22 e Java 21 via winget, se voce autorizar). Depois abre
rem  http://localhost:3000 no navegador. Feche esta janela para desligar.
rem
rem  Pode ficar em qualquer pasta: se nao estiver dentro do projeto, ele usa
rem  %USERPROFILE%\pergunte-a-reforma (clona na primeira vez, atualiza nas outras).
rem ============================================================================
setlocal EnableExtensions
chcp 65001 >nul
title Pergunte a Reforma
set "REPO=https://github.com/NicolasDev-web/pergunte-a-reforma.git"

rem Roda de uma copia em %TEMP%: o "git pull" pode atualizar este proprio arquivo.
if not defined PERGUNTE_COPIA (
  set "PERGUNTE_COPIA=1"
  set "PERGUNTE_ORIGEM=%~dp0"
  copy /y "%~f0" "%TEMP%\pergunte-a-reforma-iniciar.cmd" >nul
  "%TEMP%\pergunte-a-reforma-iniciar.cmd" %*
)
set "ABRIR=--abrir"
if /i "%~1"=="--auto" set "ABRIR="

if exist "%PERGUNTE_ORIGEM%scripts\local.mjs" (
  set "PASTA=%PERGUNTE_ORIGEM:~0,-1%"
) else (
  set "PASTA=%USERPROFILE%\pergunte-a-reforma"
)

rem --- Programas necessarios ---------------------------------------------------
call :precisa git   Git.Git                         || goto :fim
call :precisa node  OpenJS.NodeJS.LTS               || goto :fim
where java >nul 2>&1 || (
  if not exist "%USERPROFILE%\.jdks" (
    call :instalar EclipseAdoptium.Temurin.21.JDK "Java 21" || goto :fim
  )
)

rem --- Projeto -----------------------------------------------------------------
if not exist "%PASTA%\scripts\local.mjs" (
  echo Baixando o projeto em %PASTA% ...
  git clone --depth 1 "%REPO%" "%PASTA%" || goto :erro
) else (
  if exist "%PASTA%\.git" (
    echo Procurando atualizacoes...
    git -C "%PASTA%" pull --ff-only --quiet && (
      for /f %%h in ('git -C "%PASTA%" rev-parse HEAD') do (
        if not exist "%PASTA%\.motor\versao-site.txt" ( set "NOVO=1" ) else (
          findstr /x "%%h" "%PASTA%\.motor\versao-site.txt" >nul || set "NOVO=1"
        )
        set "HEAD=%%h"
      )
    )
  )
)

rem --- Ligar inicio automatico (pergunta uma vez) ------------------------------
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Pergunte a Reforma.lnk"
if not exist "%PASTA%\.motor\inicio-perguntado.txt" if defined ABRIR (
  if not exist "%PASTA%\.motor" mkdir "%PASTA%\.motor"
  echo.> "%PASTA%\.motor\inicio-perguntado.txt"
  choice /c SN /m "Quer que o Pergunte a Reforma ligue sozinho quando voce entrar no Windows"
  if not errorlevel 2 (
    powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%ATALHO%'); $s.TargetPath='%PASTA%\Iniciar Pergunte a Reforma.cmd'; $s.Arguments='--auto'; $s.WorkingDirectory='%PASTA%'; $s.WindowStyle=7; $s.Save()" ^
      && echo Pronto: ele vai ligar sozinho ao entrar no Windows. Para desligar isso, apague o atalho em shell:startup
  )
)

rem --- Ligar ---------------------------------------------------------------------
cd /d "%PASTA%"
set "EXTRA="
if defined NOVO set "EXTRA=--reconstruir"
if defined HEAD (> "%PASTA%\.motor\versao-site.txt" echo %HEAD%)
node scripts\local.mjs --producao %ABRIR% %EXTRA%
if errorlevel 1 goto :erro
goto :fim

rem --- Funcoes ----------------------------------------------------------------
:precisa
where %1 >nul 2>&1 && exit /b 0
call :instalar %2 %1
exit /b %errorlevel%

:instalar
where winget >nul 2>&1 || (
  echo Falta instalar %~2. Instale e abra este arquivo de novo.
  exit /b 1
)
choice /c SN /m "Falta %~2. Posso instalar agora com o winget"
if errorlevel 2 exit /b 1
winget install --id %1 -e --accept-package-agreements --accept-source-agreements || exit /b 1
echo.
echo %~2 instalado. Feche esta janela e abra o arquivo de novo para continuar.
pause
exit /b 1

:erro
echo.
echo Algo deu errado. Veja as mensagens acima (e .motor\motor.log, se for o motor).
:fim
pause
