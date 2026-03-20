# Quick check for the Golden Stack bridge
function gcheck {
    Write-Host "--- Manifold Engine Status ---" -ForegroundColor Cyan
    # Check if Ollama is listening to the world
    $net = netstat -aon | findstr 11434
    if ($net -match "0.0.0.0") { 
        Write-Host "[OK] Engine: Shouting (Listening on 0.0.0.0)" -ForegroundColor Green 
    } else { 
        Write-Host "[!!] Engine: Whispering (Local Only)" -ForegroundColor Yellow 
    }

    # Check Tailscale IP
    $ts = tailscale ip -4
    Write-Host "[IP] Tailscale: $ts" -ForegroundColor Magenta

    # Check currently manifested models
    ollama ps
}

# Shorthand to manifest the coder model instantly
function manifest {
    ollama run qwen3-coder-next
}

# Shorthand to release VRAM (Clear the Manifold)
function mclear {
    curl http://localhost:11434/api/generate -d '{"model": "qwen3-coder-next", "keep_alive": 0}'
}