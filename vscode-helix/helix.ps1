# Helix PowerShell wrapper
# Add to your profile: . C:\dev\butterfly-ide\vscode-helix\helix.ps1

function helix {
    param([Parameter(ValueFromRemainingArguments=$true)]$args)
    node "C:\dev\butterfly-ide\vscode-helix\helix-cli.js" @args
}

# Shortcut aliases
Set-Alias -Name hx -Value helix

Write-Host "Helix CLI loaded. Commands: helix ask, helix files, helix read, helix ping" -ForegroundColor Cyan

