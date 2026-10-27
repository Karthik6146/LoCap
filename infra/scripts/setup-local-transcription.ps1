param([string]$Model = 'dropbox-dash/faster-whisper-large-v3-turbo', [switch]$WithAlignment)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    if (!(Test-Path '.venv-whisper/Scripts/python.exe')) {
        py -3.11 -m venv .venv-whisper
        if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11, then rerun this script.' }
    }
    & '.venv-whisper/Scripts/python.exe' -m pip install -r packages/ai/scripts/requirements-local.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install the local transcription dependencies.' }
    $env:HF_HUB_DISABLE_XET = '1'
    & '.venv-whisper/Scripts/python.exe' packages/ai/scripts/transcribe-local.py --download --model $Model
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the speech model. Check your connection and retry.' }
    if ($WithAlignment) {
        & '.venv-whisper/Scripts/python.exe' -m pip install torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cpu
        if ($LASTEXITCODE -ne 0) { throw 'Could not install CPU alignment runtime.' }
        & '.venv-whisper/Scripts/python.exe' -m pip install -r packages/ai/scripts/requirements-alignment.txt
        if ($LASTEXITCODE -ne 0) { throw 'Could not install alignment dependencies.' }
        & '.venv-whisper/Scripts/python.exe' packages/ai/scripts/transcribe-local.py --download-alignment
        if ($LASTEXITCODE -ne 0) { throw 'Could not download English/Hindi alignment models.' }
        Write-Host 'Alignment ready. Set LOCAL_TRANSCRIPTION_ALIGNMENT=whisperx in .env.'
    }
    Write-Host "Ready. Set TRANSCRIPTION_PROVIDER=local and LOCAL_TRANSCRIPTION_MODEL=$Model in .env, then restart the worker."
} finally {
    Pop-Location
}
