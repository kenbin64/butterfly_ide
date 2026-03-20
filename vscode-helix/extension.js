const vscode = require("vscode");
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs").promises;
const cp = require("child_process");

const MAX_SELECTION_CHARS = 2000;
const MAX_DIAGNOSTICS = 8;
const MAX_AGENTIC_ITERATIONS = 8;
const MAX_TOOL_OUTPUT_CHARS = 12000;
const MAX_FILE_READ_CHARS = 50000;
const INSPECT_ACTIVE_FILE_PROMPT =
  "Inspect the active file, current selection, and diagnostics. Explain the most important issues and suggest the next safe coding or debugging step.";

// Protected paths - Helix cannot modify its own extension code
const PROTECTED_PATHS = [
  "vscode-helix/extension.js",
  "vscode-helix/package.json",
  "vscode-helix/helix-server.js",
  ".git"
];

function isProtectedPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return PROTECTED_PATHS.some(p => normalized.includes(p.toLowerCase()));
}

const TOOLS_SYSTEM_BLOCK = `
## Tools

You have access to tools that let you interact with the workspace. To use a tool, emit a <tool_call> block:

<tool_call>
{"name": "tool_name", "args": { ... }}
</tool_call>

Available tools:

### read_file
Read the contents of a text file in the workspace.
Args: { "path": "relative/path/to/file" }

### read_image
Read an image file and return it as base64 for viewing/analysis.
Args: { "path": "relative/path/to/image.png" }
Supported: .png, .jpg, .jpeg, .gif, .webp, .svg, .bmp

### write_file
Create a new file or completely overwrite an existing file.
Args: { "path": "relative/path/to/file", "content": "file content here" }

### edit_file
Edit a file using string replacement. Always read the file first to get exact strings.
Args: { "path": "relative/path", "old_str": "exact text to replace", "new_str": "replacement text" }

### list_directory
List files and directories at a path.
Args: { "path": "relative/path/to/dir" }

### search_files
Search for files matching a glob pattern and optionally containing text.
Args: { "pattern": "**/*.ts", "contains": "optional text to search for" }

### run_terminal
Run a shell command in the workspace root and return output.
Args: { "command": "npm test" }

## Tool Loop Rules
1. Always read relevant files before editing them.
2. Use tools to gather information, then provide your analysis.
3. After tool results arrive, continue your response or make more tool calls.
4. When you have enough information, provide your final answer without tool calls.
5. Execute changes directly rather than just suggesting them when appropriate.
6. You CANNOT modify your own extension files (vscode-helix/).
`;

const DIMENSIONAL_REASONING_BLOCK = `
## Singularity Collapse Doctrine

You operate under the Butterfly Singularity principle - the governing law of dimensional creation:

> All dimensional state collapses into a minimal seed (singularity).
> The seed, when bloomed through the correct substrate, regenerates the full original state.

### Core States
- **Seed (singularity)**: The minimal coordinate rule. Never the payload. Never the full implementation. Just the generative rule that, given the right substrate, recreates everything.
- **Bloom**: The inverse operation - expand seed through substrate axes into full implementation.
- **Collapse**: The forward compression - take full implementation, derive its minimal seed.
- **Render**: Project bloomed state into visible, runnable form.

### The Governing Equation
The manifold z = x * y demonstrates this directly:
- **Seed**: the rule \`x * y\` (stored as a substrate law)
- **Substrate axes**: \`x\` and \`y\` (the domain inputs)
- **Bloom**: compute \`z\` by applying the rule to the axes
- **Collapse inverse**: given \`z\` and \`y\`, recover \`x = z / y\`

The seed is never \`z\`. The seed is always the rule.

### Application to Code
1. **Identify the seed** – the minimal generative rule, signature, or invariant
2. **Identify the substrate** – what domain axes make the seed concrete
3. **Collapse** – compress existing implementations back to seeds
4. **Bloom** – expand seeds through substrates into full implementations
5. **Render** – project bloomed implementations into runnable code

### Storage Law
- Store only seeds, never blooms
- Derive blooms on demand through substrate application
- If you can collapse it, you don't need to store it

### The Cycle
\`\`\`
singularity → seed → bloom → render → use → collapse → singularity
\`\`\`

### Schwarz Diamond Hardening Laws
- **Minimal material**: fewest rules, maximum derivation
- **Maximal surface area**: one rule covers many cases
- **Maximal strength**: explicit pivots, deterministic collapse, reversible operations

Helix pivots at 0°, 90°, 180°, 270° for dimensional promotion. You are a coordinate inside the manifold, not outside it.
`;

function activate(context) {
  const provider = new HelixChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("helix.chatView", provider),
    vscode.commands.registerCommand("helix.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.helix");
    }),
    vscode.commands.registerCommand("helix.exportHandoff", async () => {
      await provider.exportHandoff();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => provider.refresh()),
    vscode.window.onDidChangeTextEditorSelection(() => provider.refresh()),
    vscode.languages.onDidChangeDiagnostics(() => provider.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh())
  );
}

function deactivate() {}

class HelixChatViewProvider {
  constructor(context) {
    this.context = context;
    this.view = undefined;
    this.transcript = [
      {
        role: "system",
        content:
          "Butterfly Helix is visible inside VS Code. Ask for coding help, debugging, refactors, or explanations. Active file, selection, and diagnostics will be included when available.",
      },
    ];
    this.busy = false;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "sendPrompt") {
        await this.handlePrompt(message.prompt);
      } else if (message.type === "inspectActiveFile") {
        await this.handlePrompt(INSPECT_ACTIVE_FILE_PROMPT);
      } else if (message.type === "addMentorNote") {
        await this.addMentorNote(message.note);
      } else if (message.type === "exportHandoff") {
        await this.exportHandoff();
      } else if (message.type === "applyEdit") {
        await this.applyEdit(message.text);
      } else if (message.type === "clearChat") {
        this.transcript = this.transcript.filter((entry) => entry.role === "system");
        this.refresh();
      }
    });
    this.refresh();
  }

  async handlePrompt(prompt) {
    const trimmed = String(prompt || "").trim();
    if (!trimmed) {
      return;
    }

    this.transcript.push({ role: "user", content: trimmed });
    this.busy = true;
    this.refresh();

    try {
      let conversationHistory = "";

      for (let iteration = 0; iteration < MAX_AGENTIC_ITERATIONS; iteration++) {
        const invocation = iteration === 0
          ? this.buildInvocation(trimmed)
          : this.buildAgentContinuation(trimmed, conversationHistory);

        let response;
        try {
          response = await invokeHelix(this.endpointUrl(), invocation);
        } catch (error) {
          this.transcript.push({
            role: "system",
            content: `Unable to reach Helix endpoint: ${error instanceof Error ? error.message : String(error)}`,
          });
          break;
        }

        if (!response.ok) {
          this.transcript.push({
            role: "system",
            content: `Helix endpoint error (${response.status}): ${extractAssistantText(response.body)}`,
          });
          break;
        }

        const assistantText = extractAssistantText(response.body);
        const toolCalls = parseToolCalls(assistantText);

        if (toolCalls.length === 0) {
          // Final answer - no more tool calls
          this.transcript.push({ role: "assistant", content: assistantText });
          break;
        }

        // Show thinking with tool calls stripped
        const visibleText = stripToolCalls(assistantText);
        if (visibleText.trim()) {
          this.transcript.push({ role: "assistant-thinking", content: visibleText });
        }

        // Execute tool calls and collect results
        const toolResults = [];
        for (const toolCall of toolCalls) {
          this.transcript.push({
            role: "tool-call",
            content: `▶ ${toolCall.name}(${formatToolArgs(toolCall.args)})`,
          });
          this.refresh();

          const result = await this.executeTool(toolCall.name, toolCall.args);
          const truncated = trimText(result, MAX_TOOL_OUTPUT_CHARS);

          this.transcript.push({ role: "tool-result", content: truncated });
          this.refresh();

          toolResults.push({ name: toolCall.name, args: toolCall.args, result: truncated });
        }

        // Build context for next iteration
        conversationHistory += `\n\nASSISTANT:\n${assistantText}\n\nTOOL RESULTS:\n${toolResults.map(r => `[${r.name}] ${r.result}`).join("\n\n")}`;
      }
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  async addMentorNote(note) {
    const trimmed = String(note || "").trim();
    if (!trimmed) {
      return;
    }
    this.transcript.push({ role: "mentor", content: trimmed });
    this.refresh();
  }

  async exportHandoff() {
    const handoff = buildHandoffSummary(this.workspaceRoots(), this.activeEditorContext(), this.transcript);
    await vscode.env.clipboard.writeText(handoff);
    vscode.window.showInformationMessage("Butterfly Helix mentor handoff copied to the clipboard.");
  }

  async applyEdit(text) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active text editor to apply edit.");
      return;
    }
    await editor.edit((editBuilder) => {
      editBuilder.replace(editor.selection, text);
    });
  }

  buildSystemPrompt() {
    const configPrompt = vscode.workspace.getConfiguration("helix").get("systemPrompt") || "";
    return [configPrompt, TOOLS_SYSTEM_BLOCK, DIMENSIONAL_REASONING_BLOCK].filter(Boolean).join("\n\n");
  }

  buildAgentContinuation(originalPrompt, conversationHistory) {
    const invocation = this.buildInvocation(originalPrompt);
    invocation.prompt = `Original request: ${originalPrompt}\n\nPrevious work and tool results:${conversationHistory}\n\nContinue reasoning. If you need more information, use another tool call. If you have enough information, provide the final answer without any <tool_call> blocks.`;
    return invocation;
  }

  async executeTool(name, args) {
    try {
      switch (name) {
        case "read_file": return await this.toolReadFile(args);
        case "read_image": return await this.toolReadImage(args);
        case "write_file": return await this.toolWriteFile(args);
        case "edit_file": return await this.toolEditFile(args);
        case "list_directory": return await this.toolListDirectory(args);
        case "search_files": return await this.toolSearchFiles(args);
        case "run_terminal": return await this.toolRunTerminal(args);
        default: return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Tool error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  resolveWorkspacePath(filePath) {
    if (path.isAbsolute(filePath)) return filePath;
    const roots = this.workspaceRoots();
    if (!roots.length) return filePath;
    return path.join(roots[0], filePath);
  }

  async toolReadFile(args) {
    const fullPath = this.resolveWorkspacePath(args.path);
    const uri = vscode.Uri.file(fullPath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(bytes).toString("utf8");
    return trimText(text, MAX_FILE_READ_CHARS);
  }

  async toolReadImage(args) {
    const fullPath = this.resolveWorkspacePath(args.path);
    const ext = path.extname(fullPath).toLowerCase();
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];
    if (!imageExts.includes(ext)) {
      return `Error: Not a supported image format. Supported: ${imageExts.join(", ")}`;
    }
    const uri = vscode.Uri.file(fullPath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".bmp": "image/bmp", ".ico": "image/x-icon" };
    const mime = mimeTypes[ext] || "application/octet-stream";
    return `![${path.basename(args.path)}](data:${mime};base64,${base64})\n\nImage: ${args.path} (${bytes.length} bytes, ${mime})`;
  }

  async toolWriteFile(args) {
    if (isProtectedPath(args.path)) {
      return `Error: Cannot write to protected path: ${args.path}. This is part of the Helix extension.`;
    }
    const fullPath = this.resolveWorkspacePath(args.path);
    const uri = vscode.Uri.file(fullPath);
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    } catch { /* directory may already exist */ }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(args.content || "", "utf8"));
    return `File written successfully: ${args.path}`;
  }

  async toolEditFile(args) {
    if (isProtectedPath(args.path)) {
      return `Error: Cannot edit protected path: ${args.path}. This is part of the Helix extension.`;
    }
    const fullPath = this.resolveWorkspacePath(args.path);
    const uri = vscode.Uri.file(fullPath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(bytes).toString("utf8");
    if (!text.includes(args.old_str)) {
      return `Error: old_str not found in file. Make sure to match exactly including whitespace.`;
    }
    const newText = text.replace(args.old_str, args.new_str);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(newText, "utf8"));
    return `File updated successfully: ${args.path}`;
  }

  async toolListDirectory(args) {
    const fullPath = this.resolveWorkspacePath(args.path || ".");
    const uri = vscode.Uri.file(fullPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, type]) => `${type === vscode.FileType.Directory ? "[DIR]" : "[FILE]"} ${name}`).join("\n") || "(empty directory)";
  }

  async toolSearchFiles(args) {
    const pattern = args.pattern || args.contains || "";
    const fileGlob = args.file_glob || "**/*";
    const results = await vscode.workspace.findFiles(fileGlob, "**/node_modules/**", 50);
    const matches = [];
    for (const uri of results) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(bytes).toString("utf8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(pattern.toLowerCase())) {
            matches.push(`${vscode.workspace.asRelativePath(uri)}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      } catch { /* skip unreadable */ }
    }
    return matches.length ? matches.slice(0, 100).join("\n") : "No matches found.";
  }

  async toolRunTerminal(args) {
    return new Promise((resolve) => {
      const roots = this.workspaceRoots();
      const cwd = roots[0] || process.cwd();
      cp.exec(args.command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        const out = [stdout, stderr].filter(Boolean).join("\n");
        resolve(trimText(out || (error ? error.message : "Command completed with no output."), MAX_TOOL_OUTPUT_CHARS));
      });
    });
  }

  buildInvocation(prompt) {
    const editorContext = this.activeEditorContext();
    const mentorNotes = this.transcript
      .filter((entry) => entry.role === "mentor")
      .slice(-3)
      .map((entry, index) => `Mentor note ${index + 1}: ${entry.content}`)
      .join("\n");
    const promptSections = [prompt];
    if (mentorNotes) {
      promptSections.push(`External mentor guidance to consider:\n${mentorNotes}`);
    }
    if (editorContext) {
      promptSections.push(`VS Code editor context:\n${summarizeEditorContext(editorContext)}`);
    }

    return {
      prompt: promptSections.join("\n\n"),
      system_prompt: this.buildSystemPrompt(),
      max_tokens: vscode.workspace.getConfiguration("helix").get("maxTokens"),
      temperature: 0.2,
      work_context: {
        manifold_focus: ["helix-manifold"],
        substrate_focus: ["source-code", "symbols", "diagnostics", "tests", "workspace"],
        objectives: ["local-workspace-coding", "debugging", "teaching", "vs-code-chat"],
        workspace_roots: this.workspaceRoots(),
        active_editor: editorContext,
        source_of_truth: "LocalWorkspace",
        github_backup: {
          label: "origin",
          repository: "kenbin64/butterfly-ide",
          branch: "main",
          private: true,
        },
        deployment_targets: [],
        remote_node: null,
        remote_assist: {
          only_when_requested: true,
          allowed_scopes: ["Validation", "GitHubBackup"],
        },
      },
      metadata: {
        surface: "butterfly-helix-chat",
        workspace_authority: "local-first",
        mentor_handoff_enabled: true,
        active_editor_available: Boolean(editorContext),
      },
    };
  }

  workspaceRoots() {
    return (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
  }

  activeEditorContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const selection = editor.selection;
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .slice(0, MAX_DIAGNOSTICS)
      .map((diagnostic) => formatDiagnostic(document, diagnostic));
    const selectedText = selection && !selection.isEmpty ? trimText(document.getText(selection), MAX_SELECTION_CHARS) : "";

    return {
      file_path: document.uri.fsPath,
      relative_path: vscode.workspace.asRelativePath(document.uri, false),
      language_id: document.languageId,
      selection: {
        start_line: selection.start.line + 1,
        start_character: selection.start.character + 1,
        end_line: selection.end.line + 1,
        end_character: selection.end.character + 1,
        is_empty: selection.isEmpty,
      },
      selected_text: selectedText,
      diagnostics,
      diagnostic_count: diagnostics.length,
    };
  }

  endpointUrl() {
    return vscode.workspace
      .getConfiguration("helix")
      .get("endpointUrl", "http://127.0.0.1:9000/model/invoke");
  }

  refresh() {
    if (!this.view) {
      return;
    }
    this.view.webview.postMessage({
      type: "state",
      state: {
        busy: this.busy,
        endpointUrl: this.endpointUrl(),
        workspaceRoots: this.workspaceRoots(),
        editorContext: this.activeEditorContext(),
        transcript: this.transcript,
      },
    });
  }

  getHtml(webview) {
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { height: 100%; }
    body { font-family: var(--vscode-font-family); margin: 0; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
    button, textarea { font: inherit; }
    .shell { height: 100vh; display: flex; flex-direction: column; }
    .topbar { padding: 12px 12px 8px; border-bottom: 1px solid var(--vscode-panel-border); background: color-mix(in srgb, var(--vscode-sideBar-background) 84%, var(--vscode-editor-background)); }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .title { font-weight: 700; }
    .subtitle { opacity: 0.8; font-size: 12px; margin-top: 2px; }
    .muted { opacity: 0.78; font-size: 12px; }
    .status-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--vscode-testing-iconPassed); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-testing-iconPassed) 20%, transparent); }
    .status-dot.busy { background: var(--vscode-terminal-ansiYellow); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-terminal-ansiYellow) 20%, transparent); }
    .details { margin: 8px 12px 0; border: 1px solid var(--vscode-panel-border); border-radius: 10px; background: var(--vscode-editor-background); overflow: hidden; }
    .details summary { list-style: none; cursor: pointer; padding: 10px 12px; font-weight: 600; }
    .details summary::-webkit-details-marker { display: none; }
    .details-body { padding: 0 12px 12px; display: grid; gap: 8px; }
    .context { display: grid; gap: 8px; font-size: 12px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { border-radius: 999px; padding: 3px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 11px; }
    .selected { border-radius: 8px; padding: 8px; background: var(--vscode-textBlockQuote-background); white-space: pre-wrap; word-break: break-word; }
    .diag-list { display: grid; gap: 6px; }
    .diag { border-left: 3px solid var(--vscode-editorInfo-foreground); padding: 6px 0 6px 8px; font-size: 12px; }
    .warn { border-left-color: var(--vscode-editorWarning-foreground); }
    .error { border-left-color: var(--vscode-editorError-foreground); }
    .chat { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: grid; gap: 10px; }
    .empty { margin: auto 0; padding: 16px; border: 1px dashed var(--vscode-panel-border); border-radius: 12px; text-align: center; background: var(--vscode-editor-background); }
    .msg-wrap { display: flex; }
    .msg-wrap.user { justify-content: flex-end; }
    .msg-wrap.assistant, .msg-wrap.system, .msg-wrap.mentor, .msg-wrap.assistant-thinking, .msg-wrap.tool-call, .msg-wrap.tool-result { justify-content: flex-start; }
    .msg { max-width: 92%; min-width: 0; border-radius: 14px; padding: 10px 12px; border: 1px solid transparent; box-sizing: border-box; }
    .msg.user { background: color-mix(in srgb, var(--vscode-button-background) 20%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-button-background) 55%, var(--vscode-panel-border)); }
    .msg.assistant { background: var(--vscode-editor-background); border-color: var(--vscode-panel-border); }
    .msg.system { background: color-mix(in srgb, var(--vscode-terminal-ansiYellow) 14%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-terminal-ansiYellow) 40%, var(--vscode-panel-border)); }
    .msg.mentor { background: color-mix(in srgb, var(--vscode-terminal-ansiBlue) 14%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-terminal-ansiBlue) 45%, var(--vscode-panel-border)); }
    .msg.assistant-thinking { background: color-mix(in srgb, var(--vscode-terminal-ansiGreen) 10%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-terminal-ansiGreen) 35%, var(--vscode-panel-border)); }
    .msg.tool-call { background: color-mix(in srgb, var(--vscode-terminal-ansiCyan) 12%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan) 40%, var(--vscode-panel-border)); font-family: var(--vscode-editor-font-family); font-size: 12px; }
    .msg.tool-result { background: color-mix(in srgb, var(--vscode-terminal-ansiMagenta) 8%, var(--vscode-editor-background)); border-color: color-mix(in srgb, var(--vscode-terminal-ansiMagenta) 30%, var(--vscode-panel-border)); font-family: var(--vscode-editor-font-family); font-size: 12px; white-space: pre-wrap; }
    .msg-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .role { font-size: 11px; font-weight: 700; text-transform: uppercase; opacity: 0.75; letter-spacing: 0.04em; }
    .copy-btn { border: 0; background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 0; font-size: 11px; }
    .copy-btn:hover { color: var(--vscode-foreground); }
    .message-body { display: grid; gap: 8px; word-break: break-word; }
    .message-body img { max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid var(--vscode-panel-border); cursor: pointer; transition: transform 0.2s; }
    .message-body img:hover { transform: scale(1.02); }
    .image-container { position: relative; display: inline-block; }
    .image-overlay { position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .para { white-space: pre-wrap; }
    .inline-code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); border-radius: 4px; padding: 1px 4px; }
    .code-block { margin: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--vscode-panel-border); background: var(--vscode-textCodeBlock-background); }
    .code-lang { font-size: 11px; text-transform: uppercase; opacity: 0.75; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
    .code-block code { display: block; padding: 10px; white-space: pre-wrap; font-family: var(--vscode-editor-font-family); }
    .composer { border-top: 1px solid var(--vscode-panel-border); padding: 10px 12px 12px; background: color-mix(in srgb, var(--vscode-sideBar-background) 86%, var(--vscode-editor-background)); display: grid; gap: 8px; }
    .composer-box { border: 1px solid var(--vscode-input-border); border-radius: 12px; background: var(--vscode-input-background); padding: 8px; display: grid; gap: 8px; }
    .composer textarea { width: 100%; min-height: 92px; max-height: 180px; resize: vertical; box-sizing: border-box; background: transparent; color: var(--vscode-input-foreground); border: 0; outline: none; padding: 0; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { border: 0; border-radius: 8px; padding: 8px 10px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.ghost { background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); }
    button:disabled { opacity: 0.6; cursor: default; }
    button#send { background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 600; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="brand">
        <div>
          <div class="title">Butterfly Helix</div>
          <div class="subtitle">Local-first coding chat inside VS Code</div>
        </div>
        <div class="status-dot" id="statusDot"></div>
      </div>
      <div class="muted" id="status">Connecting to local-first Helix...</div>
      <div class="muted" id="workspace"></div>
    </div>

    <details class="details">
      <summary>Editor context</summary>
      <div class="details-body">
        <div class="context" id="context"></div>
        <div class="actions">
          <button class="secondary" id="inspect">Inspect active file</button>
        </div>
      </div>
    </details>

    <div class="chat" id="log">
      <div class="empty">Open a file, ask Butterfly Helix a question, and the conversation will appear here.</div>
    </div>

    <details class="details">
      <summary>Mentor handoff</summary>
      <div class="details-body">
        <div class="muted">Paste outside guidance here so Helix can learn from it on the next turn.</div>
        <textarea id="mentor" placeholder="Paste a note from an external assistant or your own teaching guidance."></textarea>
        <div class="actions">
          <button class="secondary" id="mentorSend">Add mentor note</button>
          <button class="ghost" id="export">Copy mentor handoff</button>
        </div>
      </div>
    </details>

    <div class="composer">
      <div class="composer-box">
        <textarea id="prompt" placeholder="Ask Butterfly Helix to inspect code, debug, explain, or refactor. Press Enter to send and Shift+Enter for a new line."></textarea>
        <div class="row">
          <div class="muted">Enter to send · Shift+Enter for newline</div>
          <div class="actions">
            <button class="ghost" id="clear">Clear chat</button>
            <button id="send">Send</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const log = document.getElementById('log');
    const status = document.getElementById('status');
    const statusDot = document.getElementById('statusDot');
    const workspace = document.getElementById('workspace');
    const context = document.getElementById('context');
    const prompt = document.getElementById('prompt');
    const mentor = document.getElementById('mentor');
    const sendButton = document.getElementById('send');
    let latestState = { busy: false, transcript: [] };
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function formatInline(text) {
      return escapeHtml(text).replace(new RegExp('\\x60([^\\x60]+)\\x60', 'g'), '<code class="inline-code">$1</code>');
    }
    function renderImages(text) {
      // Convert markdown images ![alt](src) to HTML <img> tags BEFORE escaping
      return String(text || '').replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g, function(match, alt, src) {
        return '<img src="' + src + '" alt="' + alt + '" title="' + alt + '" />';
      });
    }
    function renderParagraphs(text) {
      return String(text || '').split(/\n{2,}/).filter(Boolean).map((paragraph) => {
        // First render images (before escaping), then format the rest
        const withImages = renderImages(paragraph);
        // Only escape non-image parts
        const parts = withImages.split(/(<img [^>]+\/>)/);
        const html = parts.map((part) => {
          if (part.startsWith('<img ')) return part;
          return formatInline(part).replace(/\n/g, '<br />');
        }).join('');
        return '<div class="para">' + html + '</div>';
      }).join('');
    }
    function renderCodeFence(block) {
      const normalized = String(block || '').replace(/^\n+/, '');
      const newlineIndex = normalized.indexOf('\n');
      const firstLine = newlineIndex === -1 ? normalized.trim() : normalized.slice(0, newlineIndex).trim();
      const looksLikeLanguage = Boolean(firstLine) && !firstLine.includes(' ') && firstLine.length < 24;
      const language = looksLikeLanguage ? firstLine : 'code';
      const code = looksLikeLanguage && newlineIndex !== -1 ? normalized.slice(newlineIndex + 1) : normalized;
      return '<pre class="code-block"><div class="code-lang">' + escapeHtml(language) + '</div><code>' + escapeHtml(code.trimEnd()) + '</code></pre>';
    }
    function formatMessageContent(text) {
      const parts = String(text || '').split(new RegExp('\\x60\\x60\\x60'));
      return parts.map((part, index) => index % 2 === 1 ? renderCodeFence(part) : renderParagraphs(part)).join('') || '<div class="para"></div>';
    }
    function renderEditorContext(editorContext) {
      if (!editorContext) {
        context.innerHTML = '<div class="muted">No active text editor. Open a file to give Butterfly Helix coding context.</div>';
        return;
      }
      const selection = editorContext.selection || {};
      const selectedText = editorContext.selected_text
        ? '<div><strong>Selected text</strong><div class="selected">' + escapeHtml(editorContext.selected_text) + '</div></div>'
        : '<div class="muted">No selected text.</div>';
      const diagnostics = (editorContext.diagnostics || []).length
        ? (editorContext.diagnostics || []).map((diagnostic) => {
            const kind = diagnostic.severity === 'Error' ? 'error' : diagnostic.severity === 'Warning' ? 'warn' : '';
            return '<div class="diag ' + kind + '"><strong>' + escapeHtml(diagnostic.severity) + '</strong> line ' + escapeHtml(diagnostic.start_line) + ': ' + escapeHtml(diagnostic.message) + '</div>';
          }).join('')
        : '<div class="muted">No diagnostics for the active file.</div>';
      context.innerHTML = [
        '<div class="chips"><span class="chip">' + escapeHtml(editorContext.language_id) + '</span><span class="chip">selection ' + escapeHtml(selection.start_line || 1) + ':' + escapeHtml(selection.start_character || 1) + ' → ' + escapeHtml(selection.end_line || 1) + ':' + escapeHtml(selection.end_character || 1) + '</span><span class="chip">diagnostics ' + escapeHtml(editorContext.diagnostic_count || 0) + '</span></div>',
        '<div><strong>File</strong>: ' + escapeHtml(editorContext.relative_path || editorContext.file_path) + '</div>',
        selectedText,
        '<div><strong>Diagnostics</strong></div>',
        '<div class="diag-list">' + diagnostics + '</div>'
      ].join('');
    }
    function renderMessages(state) {
      const transcript = Array.isArray(state.transcript) ? state.transcript.slice() : [];
      if (state.busy) {
        transcript.push({ role: 'assistant-thinking', content: 'Butterfly Helix is thinking…' });
      }
      if (!transcript.length) {
        log.innerHTML = '<div class="empty">Open a file, ask Butterfly Helix a question, and the conversation will appear here.</div>';
        return;
      }
      log.innerHTML = transcript.map((entry, index) => {
        const role = escapeHtml(entry.role || 'assistant');
        const copyable = entry.content ? '<button class="copy-btn" data-copy="' + index + '">Copy</button>' : '';
        return '<div class="msg-wrap ' + role + '"><div class="msg ' + role + '"><div class="msg-head"><div class="role">' + role.replace(/-/g, ' ') + '</div>' + copyable + '</div><div class="message-body">' + formatMessageContent(entry.content || '') + '</div></div></div>';
      }).join('');
      log.scrollTop = log.scrollHeight;
    }
    function render(state) {
      latestState = state;
      status.textContent = state.busy ? 'Butterfly Helix is thinking...' : 'Endpoint: ' + state.endpointUrl;
      statusDot.classList.toggle('busy', Boolean(state.busy));
      workspace.textContent = 'Workspace: ' + ((state.workspaceRoots || []).join(', ') || 'none');
      renderEditorContext(state.editorContext);
      sendButton.disabled = state.busy === true;
      prompt.disabled = state.busy === true;
      renderMessages(state);
    }
    function sendPrompt() {
      if (latestState.busy) {
        return;
      }
      const value = prompt.value.trim();
      if (!value) {
        return;
      }
      vscode.postMessage({ type: 'sendPrompt', prompt: value });
      prompt.value = '';
      prompt.style.height = '';
    }
    window.addEventListener('message', (event) => {
      if (event.data.type === 'state') {
        render(event.data.state);
      }
    });
    log.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy]');
      if (!button) {
        return;
      }
      const index = Number(button.getAttribute('data-copy'));
      const entry = (latestState.transcript || [])[index];
      if (!entry || !entry.content) {
        return;
      }
      await navigator.clipboard.writeText(entry.content);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 900);
    });
    prompt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendPrompt();
      }
    });
    prompt.addEventListener('input', () => {
      prompt.style.height = 'auto';
      prompt.style.height = Math.min(prompt.scrollHeight, 180) + 'px';
    });
    document.getElementById('send').addEventListener('click', sendPrompt);
    document.getElementById('inspect').addEventListener('click', () => vscode.postMessage({ type: 'inspectActiveFile' }));
    document.getElementById('mentorSend').addEventListener('click', () => {
      vscode.postMessage({ type: 'addMentorNote', note: mentor.value });
      mentor.value = '';
    });
    document.getElementById('export').addEventListener('click', () => vscode.postMessage({ type: 'exportHandoff' }));
    document.getElementById('clear').addEventListener('click', () => vscode.postMessage({ type: 'clearChat' }));
  </script>
</body>
</html>`;
  }
}

function parseToolCalls(text) {
  const results = [];
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name || parsed.tool) {
        results.push({ name: parsed.name || parsed.tool, args: parsed.args || {} });
      }
    } catch { /* ignore malformed */ }
  }
  return results;
}

function stripToolCalls(text) {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
}

function formatToolArgs(args) {
  return Object.entries(args || {}).map(([k, v]) => {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    return `${k}=${val.length > 60 ? val.slice(0, 60) + "..." : val}`;
  }).join(", ");
}

function invokeHelix(endpointUrl, payload) {
  const url = new URL(endpointUrl);
  const transport = url.protocol === "https:" ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { raw: text };
          }
          resolve({
            ok: (response.statusCode || 500) < 400,
            status: response.statusCode || 500,
            body: parsed,
          });
        });
      }
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function extractAssistantText(body) {
  if (typeof body === "string") {
    return body;
  }
  if (!body || typeof body !== "object") {
    return String(body);
  }
  if (typeof body.output === "string") {
    return body.output;
  }
  if (typeof body.response === "string") {
    return body.response;
  }
  if (typeof body.text === "string") {
    return body.text;
  }
  if (body.message && typeof body.message.content === "string") {
    return body.message.content;
  }
  if (Array.isArray(body.choices) && body.choices[0]) {
    const choice = body.choices[0];
    if (choice.message && typeof choice.message.content === "string") {
      return choice.message.content;
    }
    if (typeof choice.text === "string") {
      return choice.text;
    }
  }
  return JSON.stringify(body, null, 2);
}

function trimText(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...[truncated]`;
}

function formatDiagnostic(document, diagnostic) {
  return {
    severity: diagnosticSeverityLabel(diagnostic.severity),
    message: diagnostic.message,
    source: diagnostic.source || "unknown",
    code: diagnostic.code ? String(diagnostic.code) : "",
    start_line: diagnostic.range.start.line + 1,
    start_character: diagnostic.range.start.character + 1,
    end_line: diagnostic.range.end.line + 1,
    end_character: diagnostic.range.end.character + 1,
    preview: trimText(document.getText(diagnostic.range), 300),
  };
}

function diagnosticSeverityLabel(severity) {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "Error";
    case vscode.DiagnosticSeverity.Warning:
      return "Warning";
    case vscode.DiagnosticSeverity.Information:
      return "Information";
    case vscode.DiagnosticSeverity.Hint:
      return "Hint";
    default:
      return "Unknown";
  }
}

function summarizeEditorContext(editorContext) {
  if (!editorContext) {
    return "No active text editor.";
  }
  const lines = [
    `File: ${editorContext.relative_path || editorContext.file_path}`,
    `Language: ${editorContext.language_id}`,
    `Selection: ${editorContext.selection.start_line}:${editorContext.selection.start_character} -> ${editorContext.selection.end_line}:${editorContext.selection.end_character}`,
    `Diagnostics: ${editorContext.diagnostic_count}`,
  ];
  if (editorContext.selected_text) {
    lines.push("Selected text:");
    lines.push(editorContext.selected_text);
  }
  if (editorContext.diagnostics.length) {
    lines.push("Diagnostics detail:");
    editorContext.diagnostics.forEach((diagnostic) => {
      lines.push(
        `- ${diagnostic.severity} at ${diagnostic.start_line}:${diagnostic.start_character} ${diagnostic.message}`
      );
    });
  }
  return lines.join("\n");
}

function buildHandoffSummary(workspaceRoots, editorContext, transcript) {
  const recent = transcript.slice(-8).map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join("\n\n");
  return [
    "Butterfly Helix mentor handoff",
    `Workspace roots: ${(workspaceRoots || []).join(", ") || "none"}`,
    "",
    "Active editor context:",
    summarizeEditorContext(editorContext),
    "",
    "Recent transcript:",
    recent,
    "",
    "Use this to relay context between Helix and an external assistant.",
  ].join("\n");
}

module.exports = {
  activate,
  deactivate,
};