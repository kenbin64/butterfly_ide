#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LABEL = os.getenv("BUTTERFLY_REMOTE_LABEL", "runpod-executor")
HOST = os.getenv("BUTTERFLY_BIND_HOST", "127.0.0.1")
PORT = int(os.getenv("BUTTERFLY_BIND_PORT", "9000"))
WORKSPACE = os.getenv("BUTTERFLY_WORKSPACE", "/workspace")
MODEL_URL = os.getenv("BUTTERFLY_MODEL_BACKEND_URL", "").strip()
HEALTH_URL = os.getenv("BUTTERFLY_MODEL_BACKEND_HEALTH_URL", MODEL_URL).strip()
ROLES = ["DeploymentExecutor", "ValidationWorker"]


def available_memory_mb() -> int:
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    return 0


def config_digest() -> str:
    payload = json.dumps(
        {"label": LABEL, "host": HOST, "port": PORT, "workspace": WORKSPACE, "model_url": MODEL_URL},
        sort_keys=True,
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(payload).hexdigest()[:16]}"


def probe_backend() -> dict:
    if not HEALTH_URL:
        return {"configured": False, "reachable": False}
    request = urllib.request.Request(HEALTH_URL, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            return {
                "configured": True,
                "reachable": 200 <= response.status < 500,
                "status": response.status,
            }
    except Exception as exc:
        return {"configured": True, "reachable": False, "error": str(exc)}


def health_payload() -> dict:
    disk = shutil.disk_usage(WORKSPACE)
    backend = probe_backend()
    return {
        "label": LABEL,
        "status": "healthy",
        "roles": ROLES,
        "network_path": "ControlledPublicGateway",
        "workspace": WORKSPACE,
        "available_disk_gb": disk.free // 2**30,
        "available_memory_mb": available_memory_mb(),
        "model_backend": backend,
    }


def handshake_payload() -> dict:
    backend = probe_backend()
    return {
        "stage": "Health",
        "remote_label": LABEL,
        "accepted": True,
        "network_path": "ControlledPublicGateway",
        "config_digest": config_digest(),
        "health": {
            "reachable": True,
            "available_disk_gb": shutil.disk_usage(WORKSPACE).free // 2**30,
            "available_memory_mb": available_memory_mb(),
            "active_services": ["runpod-executor"] + (["model-backend"] if backend.get("reachable") else []),
        },
        "tests": [
            {"suite": "health", "success": True, "summary": "executor reachable on loopback"},
            {
                "suite": "model-backend",
                "success": backend.get("reachable", False) or not backend.get("configured", False),
                "summary": "backend reachable" if backend.get("reachable") else "backend optional or unavailable",
            },
        ],
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return

    def write_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.write_json(200, health_payload())
        elif self.path == "/handshake":
            self.write_json(200, handshake_payload())
        elif self.path == "/model/status":
            self.write_json(200, probe_backend())
        else:
            self.write_json(404, {"error": "unknown route"})

    def do_POST(self) -> None:
        if self.path != "/model/invoke":
            self.write_json(404, {"error": "unknown route"})
            return
        if not MODEL_URL:
            self.write_json(503, {"error": "BUTTERFLY_MODEL_BACKEND_URL is not configured"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length)
        request = urllib.request.Request(
            MODEL_URL,
            data=payload,
            headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as exc:
            body = exc.read()
            self.send_response(exc.code)
            self.send_header("Content-Type", exc.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            self.write_json(502, {"error": str(exc)})


if __name__ == "__main__":
    print(f"Butterfly Runpod executor listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()