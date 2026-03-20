#!/usr/bin/env node
// Helix CLI - Talk to Butterfly Steward from the command line

const http = require("http");

const HELIX_HOST = "127.0.0.1";
const HELIX_PORT = 9000;

const args = process.argv.slice(2);
const command = args[0];

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HELIX_HOST,
      port: HELIX_PORT,
      path: path,
      method: method,
      headers: { "Content-Type": "application/json" }
    };
    
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body });
        }
      });
    });
    
    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  if (!command) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║               HELIX CLI - Butterfly Steward               ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  node helix-cli.js <command> [args]

Commands:
  ask <message>      Ask Helix a question
  files              List workspace files  
  read <path>        Read a file
  workspace          Show current workspace root
  setroot <path>     Change workspace root
  ping               Check if Helix is running

Examples:
  node helix-cli.js ask "What is the manifold?"
  node helix-cli.js files
  node helix-cli.js read butterfly_ide_lib/docs/Constitution.md
  node helix-cli.js setroot C:\\projects\\myapp
`);
    return;
  }

  try {
    switch (command) {
      case "ask":
      case "chat":
      case "say": {
        const message = args.slice(1).join(" ");
        if (!message) {
          console.log("Usage: helix ask <message>");
          return;
        }
        console.log("\n🦋 Asking Helix...\n");
        const result = await request("POST", "/model/invoke", { prompt: message });
        if (result.error) {
          console.log("❌ Error:", result.error);
        } else {
          console.log("═".repeat(60));
          console.log(result.output || result.raw || "No response");
          console.log("═".repeat(60));
        }
        break;
      }

      case "files":
      case "ls": {
        const result = await request("GET", "/files");
        console.log("\n📁 Workspace files:\n");
        (result.files || []).slice(0, 50).forEach(f => console.log("  " + f));
        if (result.files && result.files.length > 50) {
          console.log(`  ... and ${result.files.length - 50} more`);
        }
        break;
      }

      case "read":
      case "cat": {
        const filePath = args[1];
        if (!filePath) {
          console.log("Usage: helix read <filepath>");
          return;
        }
        const result = await request("GET", "/file/" + encodeURIComponent(filePath));
        if (result.error) {
          console.log("❌ Error:", result.error);
        } else {
          console.log(`\n📄 ${result.path}:\n`);
          console.log(result.content);
        }
        break;
      }

      case "workspace":
      case "pwd": {
        const result = await request("GET", "/workspace");
        console.log("\n📂 Workspace root:", result.root);
        break;
      }

      case "setroot":
      case "cd": {
        const newRoot = args[1];
        if (!newRoot) {
          console.log("Usage: helix setroot <path>");
          return;
        }
        const result = await request("POST", "/workspace", { root: newRoot });
        if (result.error) {
          console.log("❌ Error:", result.error);
        } else {
          console.log("✓ Workspace set to:", result.root);
        }
        break;
      }

      case "ping": {
        const result = await request("GET", "/workspace");
        if (result.root) {
          console.log("✓ Helix is running at http://" + HELIX_HOST + ":" + HELIX_PORT);
        }
        break;
      }

      default:
        // Treat unknown command as a message to Helix
        const message = args.join(" ");
        console.log("\n🦋 Asking Helix...\n");
        const result = await request("POST", "/model/invoke", { prompt: message });
        console.log("═".repeat(60));
        console.log(result.output || result.error || "No response");
        console.log("═".repeat(60));
    }
  } catch (e) {
    console.log("❌ Could not connect to Helix. Is the server running?");
    console.log("   Start it with: node vscode-helix/helix-server.js");
  }
}

main();

