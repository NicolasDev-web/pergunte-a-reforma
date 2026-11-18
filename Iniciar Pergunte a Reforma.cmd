@echo off
rem ============================================================================
rem  Pergunte a Reforma - liga o motor oficial da Receita e o site no Windows.
rem  Dois cliques neste arquivo. Na primeira vez ele baixa o projeto e o que faltar
rem  (Git, Node 22 e Java 21 via winget, se voce autorizar). Depois abre
rem  http://localhost:3000 no navegador. Feche esta janela para desligar.
rem
rem  Pode ficar em qualquer pasta: se nao estiver dentro do projeto, ele usa
rem  %USERPROFILE%\pergunte-a-reforma (clona na primeira vez, atualiza nas outras).
rem
rem  --auto: modo do inicio automatico (nao abre o navegador e nao espera tecla).
rem ============================================================================
setlocal EnableExtensions
chcp 65001 >nul
title Pergunte a Reforma
set "REPO=https://github.com/luiiiznetoo/pergunte-a-reforma.git"

rem Roda de uma copia em %TEMP%: o "git pull" pode atualizar este proprio arquivo.
rem (Chamar outro .cmd sem "call" passa o controle para ele; este nao continua.)
if not defined PERGUNTE_COPIA (
  set "PERGUNTE_COPIA=1"
  set "PERGUNTE_ORIGEM=%~dp0"
  copy /y "%~f0" "%TEMP%\pergunte-a-reforma-iniciar.cmd" >nul
  "%TEMP%\pergunte-a-reforma-iniciar.cmd" %*
)
set "ABRIR=--abrir"
set "AUTO="
if /i "%~1"=="--auto" (
  set "ABRIR="
  set "AUTO=1"
)

if exist "%PERGUNTE_ORIGEM%scripts\local.mjs" (
  set "PASTA=%PERGUNTE_ORIGEM:~0,-1%"
) else (
  set "PASTA=%USERPROFILE%\pergunte-a-reforma"
)

rem --- Programas necessarios (o Java 21 e conferido pelo local.mjs) -----------
call :precisa git   Git.Git                         || goto :fim
call :precisa node  OpenJS.NodeJS.LTS               || goto :fim

rem --- Projeto -----------------------------------------------------------------
if exist "%PASTA%\scripts\local.mjs" goto :atualizar
echo Baixando o projeto em "%PASTA%" ...
git clone --depth 1 "%REPO%" "%PASTA%" || goto :erro
goto :versao

:atualizar
if not exist "%PASTA%\.git" goto :versao
echo Procurando atualizacoes...
git -C "%PASTA%" pull --ff-only --quiet
if errorlevel 1 echo Aviso: nao consegui atualizar o projeto (sem internet ou alteracoes locais). Seguindo com a versao atual.

:versao
rem Recompila quando o commit atual for diferente do ultimo que compilou com sucesso
rem (o local.mjs grava .motor\versao-site.txt depois do build).
set "NOVO="
set "HEAD="
for /f %%h in ('git -C "%PASTA%" rev-parse HEAD 2^>nul') do set "HEAD=%%h"
if not defined HEAD goto :inicio
if not exist "%PASTA%\.motor\versao-site.txt" (
  set "NOVO=1"
) else (
  findstr /x /c:"%HEAD%" "%PASTA%\.motor\versao-site.txt" >nul || set "NOVO=1"
)

rem --- Ligar inicio automatico (pergunta uma vez) ------------------------------
:inicio
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Pergunte a Reforma.lnk"
if defined AUTO goto :ligar
if exist "%PASTA%\.motor\inicio-perguntado.txt" goto :ligar
if not exist "%PASTA%\.motor" mkdir "%PASTA%\.motor"
echo.> "%PASTA%\.motor\inicio-perguntado.txt"
choice /c SN /m "Quer que o Pergunte a Reforma ligue sozinho quando voce entrar no Windows"
if errorlevel 2 goto :ligar
rem Os caminhos vao por variavel de ambiente: assim apostrofos e espacos nao quebram o comando.
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:ATALHO); $s.TargetPath=(Join-Path $env:PASTA 'Iniciar Pergunte a Reforma.cmd'); $s.Arguments='--auto'; $s.WorkingDirectory=$env:PASTA; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo Nao consegui criar o atalho de inicio automatico.
) else (
  echo Pronto: ele vai ligar sozinho ao entrar no Windows. Para desligar isso, apague o atalho em shell:startup
)

rem --- Ligar ---------------------------------------------------------------------
:ligar
cd /d "%PASTA%"
set "EXTRA="
if defined NOVO set "EXTRA=--reconstruir"
node scripts\local.mjs --producao %ABRIR% %EXTRA%
if %errorlevel%==0 goto :fim
if %errorlevel%==3 (
  call :instalar EclipseAdoptium.Temurin.21.JDK "Java 21"
  goto :fim
)
goto :erro

rem --- Funcoes ----------------------------------------------------------------
:precisa
where %1 >nul 2>&1 && exit /b 0
call :instalar %2 %1
exit /b %errorlevel%

:instalar
if defined AUTO (
  echo Falta instalar %~2. Abra o "Iniciar Pergunte a Reforma.cmd" com dois cliques para instalar.
  exit /b 1
)
where winget >nul 2>&1 || (
  echo Falta instalar %~2. Instale e abra este arquivo de novo.
  exit /b 1
)
choice /c SN /m "Falta %~2. Posso instalar agora com o winget"
if errorlevel 2 exit /b 1
winget install --id %1 -e --accept-package-agreements --accept-source-agreements || exit /b 1
echo.
echo %~2 instalado. Feche esta janela e abra o arquivo de novo para continuar.
exit /b 1

:erro
echo.
echo Algo deu errado. Veja as mensagens acima (e .motor\motor.log, se for o motor).
:fim
if not defined AUTO pause
