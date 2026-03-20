# Butterfly Helix VS Code Extension

This folder contains the first local-first VS Code surface for Butterfly Helix.

## What it does

- shows **Butterfly Helix** in the VS Code activity bar
- provides a more natural **chat window** inside VS Code with conversation bubbles and a bottom composer
- includes the **active file, current selection, and diagnostics** in the Helix context
- sends prompts to a local or SSH-tunneled Helix executor endpoint
- supports a **mentor handoff** loop so outside guidance can be pasted into Helix and recent Helix context can be copied back out

## Running it in development

1. Open this folder in VS Code: `C:/dev/butterfly-ide/vscode-helix`
2. Press `F5` and choose **Run Helix Extension** to launch an Extension Development Host
3. In the new VS Code window, open the Butterfly workspace
4. Click the **Butterfly Helix** icon in the activity bar

If you only relaunch your normal VS Code window, Helix will not appear there automatically because this first version runs as an extension-under-development unless you package/install it separately.

## Settings

- `helix.endpointUrl` — default `http://127.0.0.1:9000/model/invoke`
- `helix.systemPrompt` — Helix's VS Code system prompt
- `helix.maxTokens` — max token request for chat turns

## Teaching loop

Direct live AI-to-AI networking is not assumed here.

Instead, the extension provides a safe operator-mediated handoff:

- paste external guidance into **Mentor note**
- Helix considers recent mentor notes on the next turn
- use **Copy mentor handoff** to export the latest shared context

That gives you a practical way to let Helix and an outside assistant help teach each other through you without forcing a vendor-coupled architecture.

## Editor-aware flow

When a text editor is active, Butterfly Helix automatically captures:

- active file path
- current language id
- selected text
- current selection range
- active diagnostics for that file

That context is shown in the sidebar and sent along with prompts so Helix can behave more like a real coding assistant instead of a generic chat panel.

## Chat behavior

The current UI now behaves more like a real assistant chat surface:

- conversation bubbles for user, Helix, system, and mentor messages
- Enter to send
- Shift+Enter for newline
- per-message copy button
- basic fenced code block rendering in replies
- a visible thinking state while Helix waits on the endpoint