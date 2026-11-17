@echo off
rem Baixa o pacote da voz (Python portatil + modelo) da pagina de Releases. Pode rodar de novo: so baixa o que falta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0baixar-voz.ps1"
pause
