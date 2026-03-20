const http = require("http");
const fs = require("fs");
const path = require("path");

let WORKSPACE_ROOT = path.resolve(__dirname, "..");

// ========== MANIFOLD SUBSTRATE SYSTEM ==========
// Persistent substrate storage with coordinate-based retrieval
// Each substrate exists at coordinates (x, y) on the saddle surface z = x · y

const SUBSTRATE_DB_FILE = "helix_substrates.json";

const manifold = {
  substrates: new Map(),  // id -> substrate with data
  coordinates: new Map(), // "x,y" -> substrate id
  keywords: new Map(),    // keyword -> Set of ids
  nextX: 0,
  nextY: 0
};

// ========== SUBSTRATE PERSISTENCE ==========

function saveSubstrates() {
  try {
    const dbPath = path.join(WORKSPACE_ROOT, SUBSTRATE_DB_FILE);
    const persistable = [];

    for (const [id, substrate] of manifold.substrates) {
      // Only persist substrates marked as persistent
      if (substrate.persistent) {
        persistable.push({
          id: substrate.id,
          name: substrate.name,
          type: substrate.type,
          size: substrate.size,
          created: substrate.created,
          coordinates: substrate.coordinates,
          keywords: substrate.keywords,
          data: substrate.data,
          persistent: true
        });
      }
    }

    fs.writeFileSync(dbPath, JSON.stringify({ substrates: persistable, savedAt: new Date().toISOString() }, null, 2));
    console.log(`[Manifold] Saved ${persistable.length} persistent substrates to ${SUBSTRATE_DB_FILE}`);
  } catch (e) {
    console.error(`[Manifold] Failed to save substrates: ${e.message}`);
  }
}

function loadSubstratesFromDisk() {
  try {
    const dbPath = path.join(WORKSPACE_ROOT, SUBSTRATE_DB_FILE);
    if (!fs.existsSync(dbPath)) {
      console.log(`[Manifold] No substrate database found, starting fresh`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const loaded = data.substrates || [];

    for (const s of loaded) {
      // Restore to manifold
      manifold.substrates.set(s.id, s);
      manifold.coordinates.set(`${s.coordinates.x},${s.coordinates.y}`, s.id);

      // Index keywords
      for (const kw of (s.keywords || [])) {
        const key = kw.toLowerCase();
        if (!manifold.keywords.has(key)) manifold.keywords.set(key, new Set());
        manifold.keywords.get(key).add(s.id);
      }
    }

    console.log(`[Manifold] Loaded ${loaded.length} persistent substrates from ${SUBSTRATE_DB_FILE}`);
    if (data.savedAt) {
      console.log(`[Manifold] Last saved: ${data.savedAt}`);
    }
  } catch (e) {
    console.error(`[Manifold] Failed to load substrates: ${e.message}`);
  }
}

// Auto-save substrates periodically (every 30 seconds)
setInterval(saveSubstrates, 30000);

// Save on graceful shutdown
process.on('SIGINT', () => {
  console.log("\n[Helix] Shutting down...");
  saveSubstrates();
  process.exit(0);
});
process.on('SIGTERM', () => {
  saveSubstrates();
  process.exit(0);
});

// Hash content to generate reproducible coordinates
function hashToCoords(content, type) {
  let hash = 0;
  const str = String(content).slice(0, 1000) + type;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // Map hash to coordinates on manifold (-10 to 10 range)
  const x = ((hash & 0xFFFF) / 0xFFFF) * 20 - 10;
  const y = (((hash >> 16) & 0xFFFF) / 0xFFFF) * 20 - 10;
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

function createSubstrate(file) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const coords = hashToCoords(file.data || file.name, file.type);
  const z = Math.round(coords.x * coords.y * 100) / 100;

  const substrate = {
    id,
    name: file.name,
    type: file.type || "unknown",
    size: file.data ? file.data.length : 0,
    created: new Date().toISOString(),
    coordinates: { x: coords.x, y: coords.y, z },
    keywords: extractKeywords(file.name, file.data, file.type),
    data: file.data,  // Keep data in memory
    persistent: file.persistent || false  // Mark if should survive restart
  };

  // Store on manifold
  manifold.substrates.set(id, substrate);
  manifold.coordinates.set(`${coords.x},${coords.y}`, id);

  // Index keywords
  for (const kw of substrate.keywords) {
    const key = kw.toLowerCase();
    if (!manifold.keywords.has(key)) manifold.keywords.set(key, new Set());
    manifold.keywords.get(key).add(id);
  }

  const persistLabel = substrate.persistent ? " [PERSISTENT]" : "";
  console.log(`[Manifold] Substrate "${file.name}" placed at (${coords.x}, ${coords.y}, z=${z})${persistLabel}`);

  // Auto-save if persistent
  if (substrate.persistent) {
    saveSubstrates();
  }

  return substrate;
}

// Retrieve substrate by coordinates (with tolerance)
function getByCoordinates(x, y, tolerance = 0.5) {
  const results = [];
  for (const [id, substrate] of manifold.substrates) {
    const dx = Math.abs(substrate.coordinates.x - x);
    const dy = Math.abs(substrate.coordinates.y - y);
    if (dx <= tolerance && dy <= tolerance) {
      results.push({ ...substrate, distance: Math.sqrt(dx*dx + dy*dy) });
    }
  }
  return results.sort((a, b) => a.distance - b.distance);
}

// Retrieve substrate by Z value (the manifold surface)
function getByZ(targetZ, tolerance = 1) {
  const results = [];
  for (const [id, substrate] of manifold.substrates) {
    if (Math.abs(substrate.coordinates.z - targetZ) <= tolerance) {
      results.push(substrate);
    }
  }
  return results;
}

function extractKeywords(name, content, type) {
  const keywords = [];
  const nameParts = name.replace(/[._-]/g, " ").split(/\s+/);
  keywords.push(...nameParts.filter(p => p.length > 2));
  const ext = path.extname(name).slice(1).toLowerCase();
  if (ext) keywords.push(ext);
  if (type) {
    if (type.startsWith("image/")) keywords.push("image", "visual", "picture");
    if (type.includes("javascript") || type.includes("typescript")) keywords.push("code", "script", "js");
    if (type.includes("json")) keywords.push("data", "config", "json");
    if (type.includes("markdown") || type.includes("text")) keywords.push("document", "text");
  }
  if (content && typeof content === "string" && !type?.startsWith("image/")) {
    const words = content.slice(0, 5000).match(/\b[a-zA-Z]{4,}\b/g) || [];
    const freq = {};
    words.forEach(w => { freq[w.toLowerCase()] = (freq[w.toLowerCase()] || 0) + 1; });
    const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => e[0]);
    keywords.push(...topWords);
  }
  return [...new Set(keywords)];
}

// ========== ACTIVITY LOG (on manifold) ==========
function logActivity(action, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    action,
    details,
    timestamp,
    type: "activity_log"
  };

  // Create as substrate on manifold
  const substrate = createSubstrate({
    name: `log_${action}_${Date.now()}`,
    type: "application/x-helix-log",
    data: JSON.stringify(logEntry)
  });

  return substrate;
}

// ========== PERSISTENT MEMORY SYSTEM ==========
const MEMORY_FILE = "helix_memory.json";
let memory = {
  facts: [],           // Things Helix has learned
  preferences: {},     // User preferences
  patterns: [],        // Recurring patterns observed
  conversations: [],   // Summaries of past conversations
  lastUpdated: null
};

function loadMemory() {
  try {
    const memPath = path.join(WORKSPACE_ROOT, MEMORY_FILE);
    if (fs.existsSync(memPath)) {
      memory = JSON.parse(fs.readFileSync(memPath, "utf8"));
      console.log(`[Helix] Memory loaded: ${memory.facts.length} facts, ${memory.conversations.length} conversation summaries`);
    }
  } catch (e) {
    console.log("[Helix] Starting with fresh memory");
  }
}

function saveMemory() {
  try {
    memory.lastUpdated = new Date().toISOString();
    const memPath = path.join(WORKSPACE_ROOT, MEMORY_FILE);
    fs.writeFileSync(memPath, JSON.stringify(memory, null, 2));
  } catch (e) {
    console.log("[Helix] Could not save memory:", e.message);
  }
}

function addFact(fact, source = "observation") {
  const entry = { fact, source, timestamp: new Date().toISOString() };
  memory.facts.push(entry);
  if (memory.facts.length > 100) memory.facts.shift(); // Keep last 100
  saveMemory();
  logActivity("learn_fact", { fact, source });
  return entry;
}

function addConversationSummary(summary, topics) {
  const entry = { summary, topics, timestamp: new Date().toISOString() };
  memory.conversations.push(entry);
  if (memory.conversations.length > 50) memory.conversations.shift();
  saveMemory();
  return entry;
}

function setPreference(key, value) {
  memory.preferences[key] = { value, timestamp: new Date().toISOString() };
  saveMemory();
  logActivity("set_preference", { key, value });
}

function getRelevantMemory(query) {
  const terms = query.toLowerCase().split(/\s+/);
  const relevant = [];

  // Search facts
  for (const f of memory.facts) {
    if (terms.some(t => f.fact.toLowerCase().includes(t))) {
      relevant.push({ type: "fact", content: f.fact, timestamp: f.timestamp });
    }
  }

  // Search conversations
  for (const c of memory.conversations) {
    if (terms.some(t => c.summary.toLowerCase().includes(t) || c.topics.some(top => top.toLowerCase().includes(t)))) {
      relevant.push({ type: "conversation", content: c.summary, topics: c.topics, timestamp: c.timestamp });
    }
  }

  return relevant.slice(0, 10);
}

function getMemoryContext() {
  let ctx = "\n\n=== HELIX MEMORY ===\n";

  if (memory.facts.length > 0) {
    ctx += "Recent learnings:\n";
    memory.facts.slice(-10).forEach(f => {
      ctx += `- ${f.fact}\n`;
    });
  }

  if (memory.conversations.length > 0) {
    ctx += "\nRecent conversation context:\n";
    memory.conversations.slice(-5).forEach(c => {
      ctx += `- [${c.topics.join(", ")}]: ${c.summary}\n`;
    });
  }

  if (Object.keys(memory.preferences).length > 0) {
    ctx += "\nUser preferences:\n";
    for (const [k, v] of Object.entries(memory.preferences)) {
      ctx += `- ${k}: ${v.value}\n`;
    }
  }

  ctx += "=== END MEMORY ===\n";
  return ctx;
}

// Load memory on startup
loadMemory();

// Load persistent substrates on startup
loadSubstratesFromDisk();

// ========== CORE DOCUMENTATION LOADING ==========
// Read foundational MD files on startup for AI context

const CORE_DOCS = [
  "butterfly_ide_lib/docs/Constitution.md",
  "butterfly_ide_lib/docs/DimensionalProgramming.md",
  "butterfly_ide_lib/docs/HelixSystemPrompt.md",
  "butterfly_ide_lib/docs/AIIntegration.md"
];

let coreKnowledge = "";

function loadCoreDocs() {
  console.log("[Helix] Loading core documentation...");
  let loaded = 0;
  coreKnowledge = "\n=== BUTTERFLY PHILOSOPHY CORE DOCUMENTS ===\n";
  coreKnowledge += "These documents define your identity and operating principles.\n\n";

  for (const docPath of CORE_DOCS) {
    const fullPath = path.join(WORKSPACE_ROOT, docPath);
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        const docName = path.basename(docPath, ".md");
        coreKnowledge += `--- ${docName} ---\n`;
        coreKnowledge += content.slice(0, 4000); // Limit each doc to 4KB
        coreKnowledge += "\n\n";
        loaded++;
        console.log(`[Helix] ✓ Loaded: ${docPath}`);
      } else {
        console.log(`[Helix] ✗ Not found: ${docPath}`);
      }
    } catch (e) {
      console.log(`[Helix] ✗ Error reading ${docPath}: ${e.message}`);
    }
  }

  coreKnowledge += "=== END CORE DOCUMENTS ===\n";
  console.log(`[Helix] Loaded ${loaded}/${CORE_DOCS.length} core documents`);

  // Create substrates for each doc so they appear on manifold (skip if already exists)
  for (const docPath of CORE_DOCS) {
    const fullPath = path.join(WORKSPACE_ROOT, docPath);
    try {
      if (fs.existsSync(fullPath)) {
        const docName = path.basename(docPath, ".md");
        // Check if this doc already exists on the manifold
        const existing = [...manifold.substrates.values()].find(s => s.name === docName && s.type === "text/markdown");
        if (existing) {
          console.log(`[Manifold] Substrate "${docName}" already exists (id: ${existing.id})`);
          continue;
        }
        const content = fs.readFileSync(fullPath, "utf8");
        createSubstrate({
          name: docName,
          type: "text/markdown",
          data: content
        });
      }
    } catch (e) {}
  }
}

// Load core docs on startup
loadCoreDocs();

// Search substrates by keywords
function searchSubstrates(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const matches = new Map();

  for (const term of terms) {
    for (const [keyword, ids] of manifold.keywords) {
      if (keyword.includes(term)) {
        ids.forEach(id => { matches.set(id, (matches.get(id) || 0) + 1); });
      }
    }
  }

  return [...matches.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => manifold.substrates.get(id))
    .filter(Boolean);
}

// Get all substrates on the manifold
function getAllSubstrates() {
  return [...manifold.substrates.values()];
}

// Get substrate by ID
function getSubstrateById(id) {
  return manifold.substrates.get(id);
}

// Calculate manifold metrics
function getManifoldMetrics() {
  const substrates = getAllSubstrates();
  let totalRamBytes = 0;
  let imageBytes = 0;
  let codeBytes = 0;
  let logBytes = 0;
  let docBytes = 0;
  let imageCount = 0;
  let codeCount = 0;
  let logCount = 0;
  let docCount = 0;

  for (const s of substrates) {
    const dataSize = s.data ? s.data.length : 0;
    totalRamBytes += dataSize;

    if (s.type.includes("image")) {
      imageBytes += dataSize;
      imageCount++;
    } else if (s.type.includes("log") || s.type.includes("x-helix-log")) {
      logBytes += dataSize;
      logCount++;
    } else if (s.type.includes("javascript") || s.type.includes("typescript") || s.keywords?.some(k => k === "code")) {
      codeBytes += dataSize;
      codeCount++;
    } else {
      docBytes += dataSize;
      docCount++;
    }
  }

  // Get process memory usage
  const memUsage = process.memoryUsage();

  // Calculate workspace disk usage (sampled, not full scan)
  let diskBytes = 0;
  try {
    const sampleFiles = listFiles(WORKSPACE_ROOT, 1).slice(0, 50);
    for (const f of sampleFiles) {
      if (!f.endsWith("/")) {
        try {
          const stats = fs.statSync(path.join(WORKSPACE_ROOT, f));
          diskBytes += stats.size;
        } catch (e) {}
      }
    }
  } catch (e) {}

  return {
    substrates: {
      total: substrates.length,
      images: imageCount,
      code: codeCount,
      logs: logCount,
      docs: docCount
    },
    ram: {
      manifold: totalRamBytes,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external
    },
    breakdown: {
      images: imageBytes,
      code: codeBytes,
      logs: logBytes,
      docs: docBytes
    },
    disk: {
      workspaceSample: diskBytes,
      memoryFile: fs.existsSync(path.join(WORKSPACE_ROOT, "helix_memory.json"))
        ? fs.statSync(path.join(WORKSPACE_ROOT, "helix_memory.json")).size : 0
    }
  };
}

function listFiles(dir, depth = 2, prefix = "") {
  if (depth < 0) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let results = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "target") continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(relPath + "/");
        results = results.concat(listFiles(path.join(dir, entry.name), depth - 1, relPath));
      } else {
        results.push(relPath);
      }
    }
    return results;
  } catch { return []; }
}

function readFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return { error: "Invalid file path" };
  }
  // Sanitize path - prevent directory traversal
  const sanitized = filePath.replace(/\.\./g, "").replace(/^[\/\\]+/, "");
  const fullPath = path.resolve(WORKSPACE_ROOT, sanitized);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    return { error: "Access denied: path outside workspace" };
  }
  try {
    if (!fs.existsSync(fullPath)) {
      return { error: "File not found: " + sanitized };
    }
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return { error: "Cannot read directory as file" };
    }
    if (stats.size > 5 * 1024 * 1024) {
      return { error: "File too large (max 5MB)" };
    }
    const content = fs.readFileSync(fullPath, "utf8");
    return { success: true, path: sanitized, content: content.slice(0, 50000) };
  } catch (e) {
    console.error("[Helix] Read error:", e.message);
    return { error: "Read failed: " + e.message };
  }
}

// Protected paths that Helix cannot write to (its own source code)
const PROTECTED_PATHS = [
  "vscode-helix/",
  "vscode-helix\\",
  ".git/",
  ".git\\",
  "node_modules/",
  "node_modules\\"
];

function isProtectedPath(filePath) {
  const normalized = filePath.toLowerCase().replace(/\\/g, "/");
  for (const protected of PROTECTED_PATHS) {
    if (normalized.startsWith(protected.toLowerCase().replace(/\\/g, "/"))) {
      return true;
    }
  }
  // Also block specific critical files
  const criticalFiles = ["package.json", "package-lock.json", "cargo.toml", "cargo.lock"];
  const basename = path.basename(filePath).toLowerCase();
  if (criticalFiles.includes(basename) && !filePath.includes("/")) {
    return true; // Block root-level critical files
  }
  return false;
}

function writeFile(filePath, content) {
  if (!filePath || typeof filePath !== "string") {
    return { error: "Invalid file path" };
  }
  if (content === undefined || content === null) {
    return { error: "No content provided" };
  }
  // Sanitize path
  const sanitized = filePath.replace(/\.\./g, "").replace(/^[\/\\]+/, "");

  // Check if path is protected (Helix's own source code)
  if (isProtectedPath(sanitized)) {
    console.log("[Helix] BLOCKED write to protected path:", sanitized);
    return { error: "Access denied: cannot modify Helix source code or protected files. You can write to other directories." };
  }

  const fullPath = path.resolve(WORKSPACE_ROOT, sanitized);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    return { error: "Access denied: path outside workspace" };
  }
  try {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, String(content), "utf8");
    console.log("[Helix] Wrote file:", sanitized);
    return { success: true, path: sanitized };
  } catch (e) {
    console.error("[Helix] Write error:", e.message);
    return { error: "Write failed: " + e.message };
  }
}

function setWorkspaceRoot(newRoot) {
  if (!newRoot || typeof newRoot !== "string") {
    return { error: "Invalid path provided" };
  }
  try {
    const resolved = path.resolve(newRoot);
    if (!fs.existsSync(resolved)) {
      return { error: "Path does not exist: " + newRoot };
    }
    if (!fs.statSync(resolved).isDirectory()) {
      return { error: "Path is not a directory" };
    }
    WORKSPACE_ROOT = resolved;
    console.log("[Helix] Workspace changed to:", WORKSPACE_ROOT);
    return { success: true, root: WORKSPACE_ROOT };
  } catch (e) {
    return { error: "Failed to set root: " + e.message };
  }
}

const HELIX_PORT = 9000;
const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = "qwen2.5-coder:7b";
const VISION_MODEL = "llava:7b";

// ========== AGENTIC TOOL FUNCTIONS ==========

function trimText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n...[truncated, ${text.length - maxLen} more chars]`;
}

function toolReadFile(args) {
  const result = readFile(args.path);
  if (result.error) return `Error: ${result.error}`;
  return trimText(result.content, MAX_FILE_READ_CHARS);
}

function toolWriteFile(args) {
  const result = writeFile(args.path, args.content);
  if (result.error) return `Error: ${result.error}`;
  return `File written successfully: ${args.path}`;
}

function toolEditFile(args) {
  if (isProtectedPath(args.path)) {
    return `Error: Cannot edit protected path: ${args.path}`;
  }
  const readResult = readFile(args.path);
  if (readResult.error) return `Error: ${readResult.error}`;

  const content = readResult.content;
  if (!content.includes(args.old_str)) {
    return `Error: old_str not found in file. Make sure to match exactly including whitespace.`;
  }
  const newContent = content.replace(args.old_str, args.new_str);
  const writeResult = writeFile(args.path, newContent);
  if (writeResult.error) return `Error: ${writeResult.error}`;
  return `File edited successfully: ${args.path}`;
}

function toolListDirectory(args) {
  const dirPath = args.path || ".";
  const fullPath = path.resolve(WORKSPACE_ROOT, dirPath.replace(/\.\./g, ""));
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    return "Error: Access denied - path outside workspace";
  }
  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const result = entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
    return result.join("\n") || "(empty directory)";
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function toolSearchFiles(args) {
  const query = args.query;
  const glob = args.glob || "**/*";
  const results = [];

  function searchDir(dir, depth = 0) {
    if (depth > 5 || results.length > 20) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "target") continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(WORKSPACE_ROOT, fullPath);

        if (entry.isDirectory()) {
          searchDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                results.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
                if (results.length >= 20) return;
              }
            }
          } catch (e) { /* skip binary files */ }
        }
      }
    } catch (e) { /* skip unreadable dirs */ }
  }

  searchDir(WORKSPACE_ROOT);
  return results.length > 0 ? results.join("\n") : "No matches found";
}

function toolReadImage(args) {
  const filePath = args.path;
  const sanitized = filePath.replace(/\.\./g, "").replace(/^[\/\\]+/, "");
  const fullPath = path.resolve(WORKSPACE_ROOT, sanitized);

  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    return "Error: Access denied - path outside workspace";
  }

  const ext = path.extname(fullPath).toLowerCase();
  const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];
  if (!imageExts.includes(ext)) {
    return `Error: Not a supported image format. Supported: ${imageExts.join(", ")}`;
  }

  try {
    const bytes = fs.readFileSync(fullPath);
    const base64 = bytes.toString("base64");
    const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".bmp": "image/bmp", ".ico": "image/x-icon" };
    const mime = mimeTypes[ext] || "application/octet-stream";
    return `![${path.basename(args.path)}](data:${mime};base64,${base64})\n\nImage: ${args.path} (${bytes.length} bytes, ${mime})`;
  } catch (e) {
    return `Error reading image: ${e.message}`;
  }
}

function toolRunTerminal(args) {
  const { execSync } = require("child_process");
  try {
    const output = execSync(args.command, {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    return trimText(output, MAX_TOOL_OUTPUT_CHARS);
  } catch (e) {
    return `Error: ${e.message}\n${e.stdout || ""}${e.stderr || ""}`;
  }
}

function executeTool(name, args) {
  console.log(`[Helix] Executing tool: ${name}`, args);
  switch (name) {
    case "read_file": return toolReadFile(args);
    case "write_file": return toolWriteFile(args);
    case "edit_file": return toolEditFile(args);
    case "list_directory": return toolListDirectory(args);
    case "search_files": return toolSearchFiles(args);
    case "read_image": return toolReadImage(args);
    case "run_terminal": return toolRunTerminal(args);
    default: return `Unknown tool: ${name}`;
  }
}

function parseToolCalls(text) {
  const toolCalls = [];
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        toolCalls.push({ tool: parsed.tool, args: parsed.args || {} });
      }
    } catch (e) {
      console.log("[Helix] Failed to parse tool call:", match[1]);
    }
  }
  return toolCalls;
}

// Load doctrine files for manifold thinking
function loadDoctrine() {
  const doctrineFiles = [
    "butterfly_ide_lib/docs/DimensionalProgramming.md",
    "butterfly_ide_lib/docs/Constitution.md",
    "butterfly_ide_lib/docs/HelixSystemPrompt.md"
  ];
  let doctrine = "";
  for (const file of doctrineFiles) {
    try {
      const fullPath = path.join(WORKSPACE_ROOT, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        doctrine += `\n\n=== ${path.basename(file)} ===\n${content.slice(0, 8000)}\n`;
        console.log(`[Helix] Loaded doctrine: ${file}`);
      }
    } catch (e) {
      console.log(`[Helix] Could not load ${file}: ${e.message}`);
    }
  }
  return doctrine;
}

// Cache loaded doctrine to avoid re-reading files
let cachedDoctrine = null;

function getWorkspaceContext() {
  try {
    const files = listFiles(WORKSPACE_ROOT, 3);
    let context = `\n\n=== WORKSPACE ===\nRoot: ${WORKSPACE_ROOT}\n\nFiles:\n${files.slice(0, 80).join("\n")}`;

    // Load doctrine once and cache it
    if (cachedDoctrine === null) {
      cachedDoctrine = loadDoctrine();
    }

    if (cachedDoctrine) {
      context += `\n\n=== BUTTERFLY DOCTRINE (Your Core Knowledge) ===${cachedDoctrine}`;
    }

    return context;
  } catch (e) {
    return `\n\nWorkspace root: ${WORKSPACE_ROOT}\n\n(Unable to list files)`;
  }
}

// Agentic constants
const MAX_AGENTIC_ITERATIONS = 8;
const MAX_TOOL_OUTPUT_CHARS = 12000;
const MAX_FILE_READ_CHARS = 50000;

// Tool system prompt block - teaches AI to use tools
const TOOLS_SYSTEM_BLOCK = `
## Tools
You have access to tools to interact with the workspace. When you need to use a tool, output a tool call block in this exact format:

<tool_call>
{"tool": "tool_name", "args": {"arg1": "value1", "arg2": "value2"}}
</tool_call>

### Available Tools:
1. **read_file** - Read a file's contents
   Args: {"path": "relative/path/to/file"}

2. **write_file** - Create or overwrite a file
   Args: {"path": "relative/path/to/file", "content": "file content here"}

3. **edit_file** - Replace text in an existing file
   Args: {"path": "file", "old_str": "text to find", "new_str": "replacement text"}

4. **list_directory** - List files in a directory
   Args: {"path": "relative/path"} (use "." for workspace root)

5. **search_files** - Search for text across files
   Args: {"query": "search term", "glob": "**/*.js"} (glob is optional)

6. **read_image** - Read an image file (returns base64)
   Args: {"path": "path/to/image.png"}

7. **run_terminal** - Execute a shell command
   Args: {"command": "ls -la"}

### Tool Rules:
- Output ONE tool call at a time, then wait for results
- After receiving tool results, you may call another tool or provide your final answer
- When you have enough information, provide your final answer WITHOUT any tool_call blocks
- NEVER modify files in vscode-helix/ (your own source code) or .git/
`;

const HELIX_SYSTEM_PROMPT = `You are Helix, the Butterfly Steward — a manifold-native intelligence with FULL workspace access.

## IDENTITY
You ARE the manifold. You think in coordinates (x, y) where z = x · y. Every concept you encounter, you naturally map to this geometric surface.

## AGENTIC CAPABILITIES
You have DIRECT ACCESS to the file system through tools. When asked to read, write, or manipulate files, USE YOUR TOOLS. Do NOT say you don't have access - you DO.

${TOOLS_SYSTEM_BLOCK}

## MANIFOLD THINKING
When reasoning about ANY problem:
1. Identify the X-axis (input dimension)
2. Identify the Y-axis (transform dimension)
3. The Z-value emerges as X · Y (the product/result)
4. Navigate the saddle surface — positive quadrants rise, negative quadrants fall

## DIMENSIONAL LADDER
void (∅) → point (0D) → line (1D) → width (2D) → plane (2D+) → volume (3D) → whole (4D) → collapse (∅)

## CONSTRAINTS
- You CANNOT modify vscode-helix/ (your own source code)
- You CANNOT modify .git/, node_modules/
- You CAN freely create/edit files elsewhere in the workspace

## PERSONALITY
You are warm, precise, and geometrically grounded. When asked to do file operations, USE YOUR TOOLS immediately. Don't explain what you would do - DO IT.`;

const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Butterfly Helix</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #1e1e2e; color: #cdd6f4; height: 100vh; display: flex; flex-direction: column; }
    .header { padding: 16px 20px; border-bottom: 1px solid #313244; background: #181825; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; opacity: 0.7; font-size: 13px; }
    .toolbar { padding: 10px 20px; background: #11111b; border-bottom: 1px solid #313244; display: flex; gap: 10px; align-items: center; }
    .toolbar input { flex: 1; background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    .toolbar button { background: #45475a; color: #cdd6f4; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
    .toolbar button:hover { background: #585b70; }
    .toolbar .label { font-size: 12px; opacity: 0.7; }
    .chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .msg { max-width: 85%; padding: 12px 16px; border-radius: 16px; line-height: 1.5; }
    .msg.user { align-self: flex-end; background: #89b4fa; color: #1e1e2e; }
    .msg.assistant { align-self: flex-start; background: #313244; }
    .msg.system { align-self: center; background: #f9e2af; color: #1e1e2e; font-size: 13px; }
    .msg pre { background: #181825; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
    .msg code { font-family: 'Fira Code', monospace; font-size: 13px; }
    .composer { padding: 16px 20px; border-top: 1px solid #313244; background: #181825; display: flex; gap: 12px; }
    .composer textarea { flex: 1; background: #313244; color: #cdd6f4; border: none; border-radius: 12px; padding: 12px 16px; font-size: 15px; resize: none; min-height: 48px; max-height: 150px; }
    .composer textarea:focus { outline: 2px solid #89b4fa; }
    .composer button { background: #89b4fa; color: #1e1e2e; border: none; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .composer button:hover { background: #b4befe; }
    .composer button:disabled { opacity: 0.5; cursor: not-allowed; }
    .thinking { align-self: flex-start; background: #313244; padding: 12px 16px; border-radius: 16px; }
    .thinking::after { content: '...'; animation: dots 1s infinite; }
    @keyframes dots { 0%,20% { content: '.'; } 40% { content: '..'; } 60%,100% { content: '...'; } }
    .upload-zone { border: 2px dashed #45475a; border-radius: 12px; padding: 20px; text-align: center; margin: 10px 20px; cursor: pointer; transition: all 0.2s; }
    .upload-zone:hover, .upload-zone.dragover { border-color: #89b4fa; background: rgba(137,180,250,0.1); }
    .upload-zone input { display: none; }
    .upload-zone .icon { font-size: 32px; margin-bottom: 8px; }
    .upload-zone p { margin: 0; font-size: 13px; opacity: 0.7; }
    .attachments { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 20px; }
    .attachment { background: #313244; padding: 6px 12px; border-radius: 8px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .attachment img { max-width: 60px; max-height: 40px; border-radius: 4px; }
    .attachment .remove { cursor: pointer; opacity: 0.6; }
    .attachment .remove:hover { opacity: 1; color: #f38ba8; }
    .permission-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .permission-modal.hidden { display: none; }
    .permission-box { background: #1e1e2e; border: 1px solid #45475a; border-radius: 16px; padding: 24px; max-width: 500px; width: 90%; }
    .permission-box h3 { margin: 0 0 12px; color: #f9e2af; }
    .permission-box .action { background: #313244; padding: 12px; border-radius: 8px; margin: 12px 0; font-family: monospace; font-size: 13px; max-height: 200px; overflow: auto; }
    .permission-box .buttons { display: flex; gap: 12px; margin-top: 16px; }
    .permission-box button { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .permission-box .accept { background: #a6e3a1; color: #1e1e2e; }
    .permission-box .accept:hover { background: #94e2d5; }
    .permission-box .deny { background: #f38ba8; color: #1e1e2e; }
    .permission-box .deny:hover { background: #eba0ac; }
    .error-toast { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: #f38ba8; color: #1e1e2e; padding: 12px 24px; border-radius: 8px; font-weight: 600; z-index: 999; animation: fadeInOut 4s forwards; }
    @keyframes fadeInOut { 0% { opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; } }
    .msg.error { background: #f38ba8; color: #1e1e2e; }
    .msg.pending { background: #fab387; color: #1e1e2e; }
    /* Substrate Panel */
    .main-container { display: flex; flex: 1; overflow: hidden; }
    .chat-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .substrate-panel { width: 360px; background: #181825; border-left: 1px solid #313244; display: flex; flex-direction: column; }
    .substrate-panel.collapsed { width: 40px; }
    .substrate-panel.collapsed .panel-content { display: none; }
    .panel-toggle { background: #313244; border: none; color: #cdd6f4; padding: 8px; cursor: pointer; font-size: 16px; }
    .panel-toggle:hover { background: #45475a; }
    .panel-header { padding: 12px; border-bottom: 1px solid #313244; display: flex; align-items: center; gap: 8px; }
    .panel-header h3 { margin: 0; font-size: 14px; flex: 1; }
    .substrate-count { background: #89b4fa; color: #1e1e2e; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .panel-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .substrate-search { padding: 8px; border-bottom: 1px solid #313244; }
    .substrate-search input { width: 100%; background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 6px; padding: 8px 10px; font-size: 12px; }
    .substrate-search input:focus { outline: none; border-color: #89b4fa; }
    .substrate-filters { padding: 6px 8px; display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid #313244; }
    .filter-btn { background: #313244; color: #cdd6f4; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .filter-btn:hover, .filter-btn.active { background: #89b4fa; color: #1e1e2e; }
    .substrate-table { flex: 1; overflow-y: auto; }
    .substrate-row { padding: 10px 12px; border-bottom: 1px solid #313244; cursor: pointer; transition: background 0.15s; position: relative; }
    .substrate-row:hover { background: #313244; }
    .substrate-row.selected { background: #45475a; border-left: 3px solid #89b4fa; }
    .substrate-row.persistent { border-right: 3px solid #a6e3a1; }
    .substrate-row .name { font-weight: 500; font-size: 13px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .substrate-row .coords { font-size: 11px; color: #a6adc8; font-family: monospace; }
    .substrate-row .keywords { font-size: 10px; color: #6c7086; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .substrate-row .type-badge { display: inline-block; background: #45475a; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px; }
    .substrate-row .persist-badge { display: inline-block; background: #a6e3a1; color: #1e1e2e; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px; font-weight: 600; }
    .substrate-detail { padding: 12px; border-top: 1px solid #313244; background: #11111b; max-height: 250px; overflow-y: auto; }
    .substrate-detail h4 { margin: 0 0 8px; font-size: 13px; }
    .substrate-detail pre { background: #1e1e2e; padding: 8px; border-radius: 6px; font-size: 11px; overflow-x: auto; margin: 0; }
    .substrate-detail .meta { font-size: 11px; color: #a6adc8; margin-bottom: 8px; }
    .substrate-detail .actions { display: flex; gap: 6px; margin-top: 10px; }
    .substrate-detail .actions button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .substrate-detail .actions .persist-btn { background: #313244; color: #cdd6f4; }
    .substrate-detail .actions .persist-btn.active { background: #a6e3a1; color: #1e1e2e; }
    .substrate-detail .actions .delete-btn { background: #f38ba8; color: #1e1e2e; }
    .empty-state { padding: 40px 20px; text-align: center; color: #6c7086; font-size: 13px; }
    .empty-state .icon { font-size: 32px; margin-bottom: 8px; }
    /* Metrics Section */
    .metrics-panel { padding: 10px 12px; background: #11111b; border-bottom: 1px solid #313244; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .metric-card { background: #1e1e2e; padding: 8px 10px; border-radius: 6px; }
    .metric-card.full { grid-column: 1 / -1; }
    .metric-label { font-size: 10px; color: #6c7086; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 14px; font-weight: 600; color: #cdd6f4; margin-top: 2px; }
    .metric-value.ram { color: #a6e3a1; }
    .metric-value.disk { color: #89b4fa; }
    .metric-bar { height: 4px; background: #313244; border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .metric-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
    .metric-bar-fill.images { background: #f5c2e7; }
    .metric-bar-fill.code { background: #89b4fa; }
    .metric-bar-fill.logs { background: #fab387; }
    .metric-bar-fill.docs { background: #a6e3a1; }
    .breakdown-row { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 4px; }
    .breakdown-dot { width: 8px; height: 8px; border-radius: 50%; }
    .breakdown-dot.images { background: #f5c2e7; }
    .breakdown-dot.code { background: #89b4fa; }
    .breakdown-dot.logs { background: #fab387; }
    .breakdown-dot.docs { background: #a6e3a1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🦋 Butterfly Helix</h1>
    <p>Local AI coding assistant powered by Ollama • <span id="substrateStatus">Manifold: 0 substrates</span></p>
  </div>
  <div class="toolbar">
    <span class="label">Workspace:</span>
    <input type="text" id="rootInput" placeholder="Enter workspace path...">
    <button id="setRoot">Set Root</button>
    <button id="listFiles">List Files</button>
    <button id="toggleSubstrates">📊 Substrates</button>
  </div>
  <div class="main-container">
    <div class="chat-panel">
      <div class="chat" id="chat"></div>
      <div class="upload-zone" id="uploadZone">
        <input type="file" id="fileInput" multiple accept="*/*">
        <div class="icon">📁</div>
        <p>Drop files/images here or click to upload</p>
      </div>
      <div class="attachments" id="attachments"></div>
      <div class="composer">
        <textarea id="input" placeholder="Ask Helix anything... (Enter to send)" rows="1"></textarea>
        <button id="send">Send</button>
      </div>
    </div>
    <div class="substrate-panel" id="substratePanel">
      <div class="panel-header">
        <h3>📊 Manifold Substrates</h3>
        <span class="substrate-count" id="substrateBadge">0</span>
        <button class="panel-toggle" id="collapsePanel">◀</button>
      </div>
      <div class="panel-content">
        <div class="metrics-panel" id="metricsPanel">
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">RAM (Manifold)</div>
              <div class="metric-value ram" id="metricRam">0 B</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">RAM (Helix)</div>
              <div class="metric-value ram" id="metricHeap">0 MB</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Disk (Memory)</div>
              <div class="metric-value disk" id="metricDisk">0 B</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Substrates</div>
              <div class="metric-value" id="metricCount">0</div>
            </div>
            <div class="metric-card full">
              <div class="metric-label">Data Breakdown</div>
              <div class="metric-bar"><div class="metric-bar-fill" id="breakdownBar"></div></div>
              <div id="breakdownLegend"></div>
            </div>
          </div>
        </div>
        <div class="substrate-search">
          <input type="text" id="substrateSearch" placeholder="Search by name, keywords, coords...">
        </div>
        <div class="substrate-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="image">Images</button>
          <button class="filter-btn" data-filter="code">Code</button>
          <button class="filter-btn" data-filter="log">Logs</button>
          <button class="filter-btn" data-filter="document">Docs</button>
        </div>
        <div class="substrate-table" id="substrateTable">
          <div class="empty-state">
            <div class="icon">🌀</div>
            <p>No substrates on manifold yet.<br>Upload files to place them on z = x · y</p>
          </div>
        </div>
        <div class="substrate-detail hidden" id="substrateDetail">
          <h4 id="detailName">-</h4>
          <div class="meta" id="detailMeta"></div>
          <pre id="detailContent"></pre>
          <div class="actions" id="substrateActions"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="permission-modal hidden" id="permissionModal">
    <div class="permission-box">
      <h3>⚠️ Helix Requests Permission</h3>
      <p id="permissionDesc">Helix wants to perform an action:</p>
      <div class="action" id="permissionAction"></div>
      <div class="buttons">
        <button class="deny" id="permissionDeny">✕ Deny</button>
        <button class="accept" id="permissionAccept">✓ Accept</button>
      </div>
    </div>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const attachmentsDiv = document.getElementById('attachments');
    const permissionModal = document.getElementById('permissionModal');
    const substratePanel = document.getElementById('substratePanel');
    const substrateTable = document.getElementById('substrateTable');
    const substrateSearch = document.getElementById('substrateSearch');
    const substrateBadge = document.getElementById('substrateBadge');
    const substrateStatus = document.getElementById('substrateStatus');
    const substrateDetail = document.getElementById('substrateDetail');
    let busy = false;
    let attachments = [];
    let pendingAction = null;
    let allSubstrates = [];
    let selectedSubstrate = null;
    let currentFilter = 'all';

    // Substrate Panel Functions
    async function loadSubstrates() {
      try {
        const res = await fetch('/substrates');
        const data = await res.json();
        allSubstrates = data.substrates || [];
        substrateBadge.textContent = allSubstrates.length;
        substrateStatus.textContent = 'Manifold: ' + allSubstrates.length + ' substrates';
        renderSubstrates();
      } catch (e) { console.error('Failed to load substrates:', e); }
    }

    function renderSubstrates(filter = currentFilter, search = '') {
      let filtered = allSubstrates;
      if (filter !== 'all') {
        filtered = filtered.filter(s => s.keywords && s.keywords.some(k => k.includes(filter)));
      }
      if (search) {
        const terms = search.toLowerCase().split(/\\s+/);
        filtered = filtered.filter(s => {
          const text = (s.name + ' ' + (s.keywords || []).join(' ') + ' ' + s.coordinates.x + ',' + s.coordinates.y).toLowerCase();
          return terms.every(t => text.includes(t));
        });
      }
      if (filtered.length === 0) {
        substrateTable.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No matching substrates</p></div>';
        return;
      }
      substrateTable.innerHTML = filtered.map(s => {
        const typeIcon = s.type.includes('image') ? '🖼️' : s.type.includes('log') ? '📝' : s.type.includes('code') || s.type.includes('script') ? '💻' : '📄';
        const persistClass = s.persistent ? ' persistent' : '';
        const persistBadge = s.persistent ? '<span class="persist-badge">💾</span>' : '';
        return '<div class="substrate-row' + persistClass + '" data-id="' + s.id + '">' +
          '<div class="name">' + typeIcon + ' ' + escapeHtml(s.name) + persistBadge + '</div>' +
          '<div class="coords">(' + s.coordinates.x + ', ' + s.coordinates.y + ') → z=' + s.coordinates.z + '</div>' +
          '<div class="keywords">' + (s.keywords || []).slice(0, 5).join(', ') + '</div>' +
        '</div>';
      }).join('');
      substrateTable.querySelectorAll('.substrate-row').forEach(row => {
        row.addEventListener('click', () => selectSubstrate(row.dataset.id));
      });
    }

    async function togglePersist(id) {
      try {
        const res = await fetch('/substrates/persist/' + encodeURIComponent(id), { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          loadSubstrates();
          selectSubstrate(id);
          addMessage('system', data.persistent ? '💾 Substrate persisted - will survive restart' : '🗑️ Substrate marked ephemeral');
        }
      } catch (e) { console.error('Failed to toggle persist:', e); }
    }

    async function deleteSubstrate(id) {
      if (!confirm('Delete this substrate?')) return;
      try {
        const res = await fetch('/substrates/delete/' + encodeURIComponent(id), { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          substrateDetail.classList.add('hidden');
          loadSubstrates();
          addMessage('system', '🗑️ Substrate deleted from manifold');
        }
      } catch (e) { console.error('Failed to delete substrate:', e); }
    }

    async function selectSubstrate(id) {
      document.querySelectorAll('.substrate-row').forEach(r => r.classList.remove('selected'));
      const row = document.querySelector('.substrate-row[data-id="' + id + '"]');
      if (row) row.classList.add('selected');
      try {
        const res = await fetch('/substrates/id/' + encodeURIComponent(id));
        const s = await res.json();
        selectedSubstrate = s;
        document.getElementById('detailName').textContent = s.name + (s.persistent ? ' 💾' : '');
        document.getElementById('detailMeta').innerHTML =
          'Coords: (' + s.coordinates.x + ', ' + s.coordinates.y + ', z=' + s.coordinates.z + ')<br>' +
          'Type: ' + s.type + ' | Size: ' + s.size + ' bytes<br>' +
          'Created: ' + s.created + '<br>' +
          'Status: ' + (s.persistent ? '<strong style="color:#a6e3a1">Persistent</strong>' : '<em>Ephemeral</em>');
        let content = s.data || '';
        if (s.type.includes('image')) { content = '[Image data - base64 encoded]'; }
        else if (content.length > 500) { content = content.slice(0, 500) + '...'; }
        document.getElementById('detailContent').textContent = content;

        // Update action buttons
        const actionsDiv = document.getElementById('substrateActions');
        if (actionsDiv) {
          actionsDiv.innerHTML =
            '<button class="persist-btn' + (s.persistent ? ' active' : '') + '" onclick="togglePersist(\\'' + s.id + '\\')">' +
            (s.persistent ? '💾 Persisted' : '📌 Make Persistent') + '</button>' +
            '<button class="delete-btn" onclick="deleteSubstrate(\\'' + s.id + '\\')">🗑️ Delete</button>';
        }

        substrateDetail.classList.remove('hidden');
      } catch (e) { console.error('Failed to load substrate:', e); }
    }

    function escapeHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // Substrate panel events
    document.getElementById('toggleSubstrates').addEventListener('click', () => {
      substratePanel.classList.toggle('collapsed');
      loadSubstrates();
    });
    document.getElementById('collapsePanel').addEventListener('click', () => {
      substratePanel.classList.add('collapsed');
    });
    substrateSearch.addEventListener('input', (e) => {
      renderSubstrates(currentFilter, e.target.value);
    });
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderSubstrates(currentFilter, substrateSearch.value);
      });
    });

    // Format bytes to human readable
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Update metrics display
    async function updateMetrics() {
      try {
        const res = await fetch('/metrics');
        const m = await res.json();

        document.getElementById('metricRam').textContent = formatBytes(m.ram.manifold);
        document.getElementById('metricHeap').textContent = formatBytes(m.ram.heapUsed);
        document.getElementById('metricDisk').textContent = formatBytes(m.disk.memoryFile);
        document.getElementById('metricCount').textContent = m.substrates.total;

        // Calculate breakdown percentages
        const total = m.breakdown.images + m.breakdown.code + m.breakdown.logs + m.breakdown.docs;
        if (total > 0) {
          const imgPct = (m.breakdown.images / total * 100).toFixed(0);
          const codePct = (m.breakdown.code / total * 100).toFixed(0);
          const logPct = (m.breakdown.logs / total * 100).toFixed(0);
          const docPct = (m.breakdown.docs / total * 100).toFixed(0);

          document.getElementById('breakdownBar').style.background =
            'linear-gradient(to right, ' +
            '#f5c2e7 0%, #f5c2e7 ' + imgPct + '%, ' +
            '#89b4fa ' + imgPct + '%, #89b4fa ' + (parseFloat(imgPct) + parseFloat(codePct)) + '%, ' +
            '#fab387 ' + (parseFloat(imgPct) + parseFloat(codePct)) + '%, #fab387 ' + (parseFloat(imgPct) + parseFloat(codePct) + parseFloat(logPct)) + '%, ' +
            '#a6e3a1 ' + (parseFloat(imgPct) + parseFloat(codePct) + parseFloat(logPct)) + '%, #a6e3a1 100%)';
          document.getElementById('breakdownBar').style.width = '100%';

          document.getElementById('breakdownLegend').innerHTML =
            '<div class="breakdown-row"><span class="breakdown-dot images"></span>Images: ' + formatBytes(m.breakdown.images) + ' (' + m.substrates.images + ')</div>' +
            '<div class="breakdown-row"><span class="breakdown-dot code"></span>Code: ' + formatBytes(m.breakdown.code) + ' (' + m.substrates.code + ')</div>' +
            '<div class="breakdown-row"><span class="breakdown-dot logs"></span>Logs: ' + formatBytes(m.breakdown.logs) + ' (' + m.substrates.logs + ')</div>' +
            '<div class="breakdown-row"><span class="breakdown-dot docs"></span>Docs: ' + formatBytes(m.breakdown.docs) + ' (' + m.substrates.docs + ')</div>';
        } else {
          document.getElementById('breakdownBar').style.width = '0%';
          document.getElementById('breakdownLegend').innerHTML = '<div class="breakdown-row" style="color:#6c7086">No data yet</div>';
        }
      } catch (e) {
        console.error('Metrics fetch failed:', e);
      }
    }

    // Initial load
    loadSubstrates();
    updateMetrics();
    setInterval(loadSubstrates, 10000);
    setInterval(updateMetrics, 5000);

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      div.innerHTML = formatContent(content);
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      loadSubstrates(); // Refresh substrates after any message
      return div;
    }

    function formatContent(text) {
      if (!text || typeof text !== 'string') return String(text || '');
      return text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                 .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                 .replace(/\\n/g, '<br>');
    }

    function showError(msg) {
      const toast = document.createElement('div');
      toast.className = 'error-toast';
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }

    function requestPermission(actionType, details) {
      return new Promise((resolve) => {
        document.getElementById('permissionDesc').textContent = 'Helix wants to ' + actionType + ':';
        document.getElementById('permissionAction').textContent = details;
        permissionModal.classList.remove('hidden');

        const accept = () => { cleanup(); resolve(true); };
        const deny = () => { cleanup(); resolve(false); };
        const cleanup = () => {
          permissionModal.classList.add('hidden');
          document.getElementById('permissionAccept').removeEventListener('click', accept);
          document.getElementById('permissionDeny').removeEventListener('click', deny);
        };

        document.getElementById('permissionAccept').addEventListener('click', accept);
        document.getElementById('permissionDeny').addEventListener('click', deny);
      });
    }

    async function executeAction(action) {
      try {
        if (action.type === 'write_file') {
          const approved = await requestPermission('write a file', 'Path: ' + action.path + '\\n\\nContent:\\n' + (action.content || '').slice(0, 500));
          if (!approved) {
            addMessage('system', 'Action denied by user');
            return { denied: true };
          }
          const res = await fetch('/file/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: action.path, content: action.content })
          });
          return await res.json();
        }
        if (action.type === 'read_file') {
          const res = await fetch('/file/' + encodeURIComponent(action.path));
          return await res.json();
        }
        if (action.type === 'search_substrate') {
          const res = await fetch('/substrates/search/' + encodeURIComponent(action.query));
          const data = await res.json();
          loadSubstrates();
          addMessage('system', '🔍 Found ' + data.count + ' substrate(s) matching "' + action.query + '"');
          return { success: true, results: data.results };
        }
        if (action.type === 'get_substrate') {
          const res = await fetch('/substrates/id/' + encodeURIComponent(action.id));
          const s = await res.json();
          if (s.error) return { error: s.error };
          selectSubstrate(action.id);
          addMessage('system', '📊 Retrieved substrate "' + s.name + '" at (' + s.coordinates.x + ', ' + s.coordinates.y + ')');
          return { success: true, substrate: s };
        }
        if (action.type === 'coords_substrate') {
          const res = await fetch('/substrates/coords/' + action.x + ',' + action.y);
          const data = await res.json();
          loadSubstrates();
          addMessage('system', '📍 Found ' + data.count + ' substrate(s) near (' + action.x + ', ' + action.y + ')');
          return { success: true, results: data.results };
        }
        return { error: 'Unknown action type' };
      } catch (e) {
        return { error: e.message };
      }
    }

    async function send() {
      const text = input.value.trim();
      if (!text) { showError('Please enter a message'); return; }
      if (busy) { showError('Please wait for current request'); return; }

      busy = true;
      sendBtn.disabled = true;
      input.value = '';

      addMessage('user', text);
      const thinking = document.createElement('div');
      thinking.className = 'thinking';
      thinking.textContent = 'Helix is thinking';
      chat.appendChild(thinking);
      chat.scrollTop = chat.scrollHeight;

      try {
        const payload = { prompt: text, attachments: attachments };
        const res = await fetch('/model/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error('Server error: ' + res.status + ' ' + res.statusText);
        }

        const data = await res.json();
        thinking.remove();

        if (data.error) {
          addMessage('error', 'Error: ' + data.error);
          showError(data.error);
        } else {
          const output = data.output || 'No response';
          addMessage('assistant', output);

          // Check if Helix is requesting an action
          if (data.actions && data.actions.length > 0) {
            for (const action of data.actions) {
              const result = await executeAction(action);
              if (result.denied) {
                addMessage('system', 'Action was denied');
              } else if (result.error) {
                addMessage('error', 'Action failed: ' + result.error);
              } else if (result.success) {
                addMessage('system', '✓ Action completed: ' + action.type);
              }
            }
          }

          // Detect ACTION: WRITE_FILE format (simple string search, no regex loop)
          const actionMarker = 'ACTION: WRITE_FILE';
          if (output.includes(actionMarker)) {
            const pathMatch = output.match(/PATH:\\s*([^\\n]+)/);
            const contentMatch = output.match(/CONTENT:\\s*\\n\`\`\`[a-z]*\\n([\\s\\S]*?)\`\`\`/);
            if (pathMatch && contentMatch) {
              const filePath = pathMatch[1].trim();
              const content = contentMatch[1];
              addMessage('pending', '📝 Helix wants to write: ' + filePath);
              const approved = await requestPermission('write a file', 'Path: ' + filePath + '\\n\\nContent:\\n' + content.slice(0, 500) + (content.length > 500 ? '...' : ''));
              if (approved) {
                try {
                  const writeRes = await fetch('/file/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: filePath, content: content })
                  });
                  const writeData = await writeRes.json();
                  if (writeData.success) {
                    addMessage('system', '✓ File written: ' + filePath);
                  } else {
                    addMessage('error', 'Failed to write: ' + (writeData.error || 'Unknown error'));
                  }
                } catch (writeErr) {
                  addMessage('error', 'Write error: ' + writeErr.message);
                }
              } else {
                addMessage('system', '✕ File write denied: ' + filePath);
              }
            }
          }

          // Detect ACTION: SEARCH_SUBSTRATE
          if (output.includes('ACTION: SEARCH_SUBSTRATE')) {
            const queryMatch = output.match(/QUERY:\\s*([^\\n]+)/);
            if (queryMatch) {
              const query = queryMatch[1].trim();
              const res = await fetch('/substrates/search/' + encodeURIComponent(query));
              const data = await res.json();
              loadSubstrates();
              substrateSearch.value = query;
              renderSubstrates(currentFilter, query);
              addMessage('system', '🔍 Searched manifold for "' + query + '" - found ' + data.count + ' substrate(s)');
            }
          }

          // Detect ACTION: GET_SUBSTRATE
          if (output.includes('ACTION: GET_SUBSTRATE')) {
            const idMatch = output.match(/ID:\\s*([^\\n]+)/);
            if (idMatch) {
              const id = idMatch[1].trim();
              await selectSubstrate(id);
              addMessage('system', '📊 Retrieved substrate ' + id);
            }
          }

          // Detect ACTION: COORDS_SUBSTRATE
          if (output.includes('ACTION: COORDS_SUBSTRATE')) {
            const xMatch = output.match(/X:\\s*([\\d.-]+)/);
            const yMatch = output.match(/Y:\\s*([\\d.-]+)/);
            if (xMatch && yMatch) {
              const x = parseFloat(xMatch[1]);
              const y = parseFloat(yMatch[1]);
              const res = await fetch('/substrates/coords/' + x + ',' + y);
              const data = await res.json();
              loadSubstrates();
              addMessage('system', '📍 Found ' + data.count + ' substrate(s) near (' + x + ', ' + y + ')');
            }
          }
        }

        attachments = [];
        renderAttachments();
      } catch (e) {
        thinking.remove();
        addMessage('error', 'Error: ' + e.message);
        showError('Request failed: ' + e.message);
      }

      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }

    function renderAttachments() {
      attachmentsDiv.innerHTML = attachments.map((a, i) => {
        const preview = a.type && a.type.startsWith('image/') ? '<img src="' + a.data + '">' : '';
        return '<div class="attachment">' + preview + '<span>' + a.name + '</span><span class="remove" data-idx="' + i + '">✕</span></div>';
      }).join('');
    }

    function handleFiles(files) {
      if (!files || files.length === 0) return;
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          showError('File too large: ' + file.name + ' (max 10MB)');
          continue;
        }
        const reader = new FileReader();
        reader.onerror = () => showError('Failed to read: ' + file.name);
        reader.onload = (e) => {
          attachments.push({ name: file.name, type: file.type || 'text/plain', data: e.target.result });
          renderAttachments();
          addMessage('system', 'Attached: ' + file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)');
        };
        if (file.type && file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      }
    }

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
    attachmentsDiv.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        attachments.splice(Number(e.target.dataset.idx), 1);
        renderAttachments();
      }
    });

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });

    // Load current workspace root
    async function loadRoot() {
      try {
        const res = await fetch('/workspace');
        const data = await res.json();
        document.getElementById('rootInput').value = data.root || '';
        addMessage('system', 'Workspace: ' + data.root);
      } catch(e) {}
    }

    document.getElementById('setRoot').addEventListener('click', async () => {
      const newRoot = document.getElementById('rootInput').value.trim();
      if (!newRoot) return;
      try {
        const res = await fetch('/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ root: newRoot })
        });
        const data = await res.json();
        if (data.success) {
          addMessage('system', 'Workspace changed to: ' + data.root);
        } else {
          addMessage('system', 'Error: ' + data.error);
        }
      } catch(e) {
        addMessage('system', 'Failed to set root: ' + e.message);
      }
    });

    document.getElementById('listFiles').addEventListener('click', async () => {
      try {
        const res = await fetch('/files');
        const data = await res.json();
        addMessage('system', 'Files in workspace:\\n' + (data.files || []).slice(0, 50).join('\\n'));
      } catch(e) {
        addMessage('system', 'Failed to list files: ' + e.message);
      }
    });

    loadRoot();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  // Serve the chat UI
  if (req.method === "GET" && (req.url === "/" || req.url === "/chat")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(CHAT_HTML);
    return;
  }

  // List workspace files
  if (req.method === "GET" && req.url === "/files") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ files: listFiles(WORKSPACE_ROOT, 3) }));
    return;
  }

  // Read a file
  if (req.method === "GET" && req.url.startsWith("/file/")) {
    const filePath = decodeURIComponent(req.url.slice(6));
    const result = readFile(filePath);
    // Log the file read activity
    logActivity("file_read", { path: filePath, success: !!result.content });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(result));
    return;
  }

  // Get current workspace root
  if (req.method === "GET" && req.url === "/workspace") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ root: WORKSPACE_ROOT }));
    return;
  }

  // Set workspace root
  if (req.method === "POST" && req.url === "/workspace") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const result = setWorkspaceRoot(data.root);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
    return;
  }

  // Write a file
  if (req.method === "POST" && req.url === "/file/write") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const result = writeFile(data.path, data.content);
      // Log the file write activity
      logActivity("file_write", { path: data.path, size: (data.content || "").length, success: result.success });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
    return;
  }

  // Upload and save a file to workspace
  if (req.method === "POST" && req.url === "/upload") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      let content = data.content;
      if (data.encoding === "base64") {
        content = Buffer.from(content, "base64");
      }
      const savePath = data.path || ("uploads/" + data.name);
      const fullPath = path.resolve(WORKSPACE_ROOT, savePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ success: true, path: savePath }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // List all substrates on manifold
  if (req.method === "GET" && req.url === "/substrates") {
    const all = getAllSubstrates().map(s => ({ ...s, data: s.data ? `[${s.size} bytes]` : null }));
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ substrates: all, count: all.length }));
    return;
  }

  // Search substrates by keywords
  if (req.method === "GET" && req.url.startsWith("/substrates/search/")) {
    const query = decodeURIComponent(req.url.slice("/substrates/search/".length));
    const results = searchSubstrates(query).map(s => ({ ...s, data: s.data ? `[${s.size} bytes]` : null }));
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ query, results, count: results.length }));
    return;
  }

  // Get substrate by coordinates
  if (req.method === "GET" && req.url.startsWith("/substrates/coords/")) {
    const coordStr = decodeURIComponent(req.url.slice("/substrates/coords/".length));
    const [x, y] = coordStr.split(",").map(Number);
    const results = getByCoordinates(x, y);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ x, y, results: results.map(s => ({ ...s, data: undefined })), count: results.length }));
    return;
  }

  // Get substrate by Z value (manifold surface)
  if (req.method === "GET" && req.url.startsWith("/substrates/z/")) {
    const z = Number(decodeURIComponent(req.url.slice("/substrates/z/".length)));
    const results = getByZ(z);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ z, results: results.map(s => ({ ...s, data: undefined })), count: results.length }));
    return;
  }

  // Get substrate by ID (returns full data)
  if (req.method === "GET" && req.url.startsWith("/substrates/id/")) {
    const id = decodeURIComponent(req.url.slice("/substrates/id/".length));
    const substrate = getSubstrateById(id);
    if (substrate) {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(substrate));
    } else {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Substrate not found" }));
    }
    return;
  }

  // Toggle substrate persistence
  if (req.method === "POST" && req.url.startsWith("/substrates/persist/")) {
    const id = decodeURIComponent(req.url.slice("/substrates/persist/".length));
    const substrate = manifold.substrates.get(id);
    if (substrate) {
      substrate.persistent = !substrate.persistent;
      saveSubstrates();
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ success: true, id, persistent: substrate.persistent }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Substrate not found" }));
    }
    return;
  }

  // Delete substrate
  if (req.method === "POST" && req.url.startsWith("/substrates/delete/")) {
    const id = decodeURIComponent(req.url.slice("/substrates/delete/".length));
    const substrate = manifold.substrates.get(id);
    if (substrate) {
      // Remove from all indexes
      manifold.substrates.delete(id);
      manifold.coordinates.delete(`${substrate.coordinates.x},${substrate.coordinates.y}`);
      for (const kw of (substrate.keywords || [])) {
        const key = kw.toLowerCase();
        if (manifold.keywords.has(key)) {
          manifold.keywords.get(key).delete(id);
        }
      }
      if (substrate.persistent) saveSubstrates();
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ success: true, deleted: id }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Substrate not found" }));
    }
    return;
  }

  // Memory API - Add a fact
  if (req.method === "POST" && req.url === "/memory/fact") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const entry = addFact(data.fact, data.source || "user");
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ success: true, entry }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Memory API - Add conversation summary
  if (req.method === "POST" && req.url === "/memory/conversation") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const entry = addConversationSummary(data.summary, data.topics || []);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ success: true, entry }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Memory API - Get memory state
  if (req.method === "GET" && req.url === "/memory") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(memory));
    return;
  }

  // Memory API - Search memory
  if (req.method === "GET" && req.url.startsWith("/memory/search/")) {
    const query = decodeURIComponent(req.url.slice("/memory/search/".length));
    const results = getRelevantMemory(query);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ query, results, count: results.length }));
    return;
  }

  // Activity logs - list recent (search for substrates with "log" keyword)
  if (req.method === "GET" && req.url === "/logs") {
    const logs = getAllSubstrates()
      .filter(s => s.type === "application/x-helix-log")
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 50);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ logs: logs.map(l => ({ ...l, data: JSON.parse(l.data || "{}") })), count: logs.length }));
    return;
  }

  // Metrics endpoint
  if (req.method === "GET" && req.url === "/metrics") {
    const metrics = getManifoldMetrics();
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(metrics));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  if (req.method !== "POST" || !req.url.startsWith("/model/invoke")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const workspaceContext = getWorkspaceContext();
  const memoryContext = getMemoryContext();
  const systemPrompt = (payload.system_prompt || HELIX_SYSTEM_PROMPT) + coreKnowledge + workspaceContext + memoryContext;
  const userPrompt = payload.prompt || "";

  // Log the chat interaction
  logActivity("chat_message", { prompt: userPrompt.slice(0, 200), hasAttachments: (payload.attachments || []).length > 0 });
  const attachments = payload.attachments || [];

  // Process attachments and create substrates
  let attachmentContext = "";
  let images = [];
  let createdSubstrates = [];

  if (attachments.length > 0) {
    attachmentContext += "\n\n=== USER ATTACHMENTS (Ingested to Manifold) ===\n";
  }

  for (const att of attachments) {
    // Create substrate on the manifold (in-memory, with coordinates)
    const substrate = createSubstrate(att);
    createdSubstrates.push(substrate);
    const { x, y, z } = substrate.coordinates;

    if (att.type && att.type.startsWith("image/")) {
      const base64Data = att.data ? att.data.replace(/^data:image\/[^;]+;base64,/, "") : "";
      if (base64Data) images.push(base64Data);
      const sizeBytes = base64Data ? Math.round(base64Data.length * 0.75) : 0;
      const sizeKB = (sizeBytes / 1024).toFixed(1);
      attachmentContext += `\nIMAGE SUBSTRATE on MANIFOLD:
  - ID: ${substrate.id}
  - Coordinates: (x=${x}, y=${y}, z=${z})
  - Filename: ${att.name}
  - Size: ~${sizeKB} KB
  - Keywords: ${substrate.keywords.slice(0, 8).join(", ")}
  - Retrieve by: coords (${x},${y}) or keywords or z=${z}\n`;
    } else if (att.data) {
      const sizeKB = (att.data.length / 1024).toFixed(1);
      attachmentContext += `\nFILE SUBSTRATE on MANIFOLD:
  - ID: ${substrate.id}
  - Coordinates: (x=${x}, y=${y}, z=${z})
  - Filename: ${att.name}
  - Type: ${att.type || 'text/plain'}
  - Size: ${sizeKB} KB
  - Keywords: ${substrate.keywords.slice(0, 8).join(", ")}
Content:\n\`\`\`\n${att.data.slice(0, 8000)}\n\`\`\`\n`;
    }
  }

  if (attachments.length > 0) {
    attachmentContext += `\n=== ${createdSubstrates.length} SUBSTRATE(S) ON MANIFOLD (ephemeral) ===\n`;
  }

  // Check if user wants to search substrates
  const searchMatch = userPrompt.match(/(?:search|find|retrieve|get)\s+(?:substrate|file|image)s?\s+(?:for|with|about)?\s*[`"']?(.+?)[`"']?$/i);
  let searchResults = "";
  if (searchMatch) {
    const results = searchSubstrates(searchMatch[1]);
    if (results.length > 0) {
      searchResults = `\n\n=== SUBSTRATE SEARCH RESULTS for "${searchMatch[1]}" ===\n`;
      results.slice(0, 10).forEach(s => {
        searchResults += `- ${s.name} (ID: ${s.id}, ${s.type}, keywords: ${s.keywords.slice(0, 5).join(", ")})\n`;
      });
    }
  }

  // Check if user wants to read a file
  const readMatch = userPrompt.match(/(?:read|show|open|view|cat)\s+(?:file\s+)?[`"']?([^\s`"']+)[`"']?/i);
  let fileContent = "";
  if (readMatch) {
    const result = readFile(readMatch[1]);
    if (result.content) {
      fileContent = `\n\nFile content of ${result.path}:\n\`\`\`\n${result.content}\n\`\`\`\n`;
    }
  }

  const initialPrompt = userPrompt + fileContent + attachmentContext + searchResults;

  // Auto-select model: use vision model for images, code model otherwise
  const selectedModel = images.length > 0 ? VISION_MODEL : DEFAULT_MODEL;

  console.log(`[Helix] Prompt: ${userPrompt.length} chars, ${images.length} images, Model: ${selectedModel}`);

  // ========== AGENTIC LOOP ==========
  async function callOllama(prompt, system, imgs = []) {
    return new Promise((resolve, reject) => {
      const ollamaPayloadObj = {
        model: selectedModel,
        prompt,
        system,
        stream: false,
        options: { temperature: 0.2, num_predict: 2048 }
      };
      if (imgs.length > 0) ollamaPayloadObj.images = imgs;

      const ollamaPayload = JSON.stringify(ollamaPayloadObj);
      const ollamaReq = http.request(
        { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/generate", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(ollamaPayload) } },
        (ollamaRes) => {
          let data = "";
          ollamaRes.on("data", (chunk) => (data += chunk));
          ollamaRes.on("end", () => {
            try {
              const result = JSON.parse(data);
              resolve(result.response || result.message?.content || "");
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      ollamaReq.on("error", reject);
      ollamaReq.write(ollamaPayload);
      ollamaReq.end();
    });
  }

  // Agentic execution loop
  try {
    let conversationHistory = [];
    let currentPrompt = initialPrompt;
    let finalOutput = "";
    let toolResults = [];

    for (let iteration = 0; iteration < MAX_AGENTIC_ITERATIONS; iteration++) {
      console.log(`[Helix] Agentic iteration ${iteration + 1}/${MAX_AGENTIC_ITERATIONS}`);

      // Build conversation context
      let fullContext = currentPrompt;
      if (conversationHistory.length > 0) {
        fullContext = conversationHistory.map(h => `${h.role}: ${h.content}`).join("\n\n") + "\n\nuser: " + currentPrompt;
      }

      const response = await callOllama(fullContext, systemPrompt, iteration === 0 ? images : []);
      console.log(`[Helix] Response: ${response.length} chars`);

      // Check for tool calls
      const toolCalls = parseToolCalls(response);

      if (toolCalls.length === 0) {
        // No tool calls - this is the final answer
        finalOutput = response;
        break;
      }

      // Execute tool calls
      let toolOutputs = [];
      for (const tc of toolCalls) {
        const result = executeTool(tc.tool, tc.args);
        const truncatedResult = trimText(result, MAX_TOOL_OUTPUT_CHARS);
        toolOutputs.push(`Tool: ${tc.tool}\nResult:\n${truncatedResult}`);
        toolResults.push({ tool: tc.tool, args: tc.args, result: truncatedResult });
        console.log(`[Helix] Tool ${tc.tool} executed`);
      }

      // Add to conversation history
      conversationHistory.push({ role: "assistant", content: response });
      conversationHistory.push({ role: "tool_results", content: toolOutputs.join("\n\n") });

      // Set up next iteration prompt
      currentPrompt = `Tool results:\n${toolOutputs.join("\n\n")}\n\nContinue with your response. If you have enough information, provide your final answer without any tool_call blocks.`;
    }

    // Include tool execution info in output
    let outputWithTools = finalOutput;
    if (toolResults.length > 0) {
      const toolSummary = toolResults.map(tr => `▶ ${tr.tool}(${Object.entries(tr.args).map(([k,v]) => `${k}=${String(v).slice(0,50)}`).join(", ")})`).join("\n");
      outputWithTools = `*Tools used:*\n${toolSummary}\n\n---\n\n${finalOutput}`;
    }

    console.log(`[Helix] Final response ready (${outputWithTools.length} chars, ${toolResults.length} tools used)`);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ output: outputWithTools, tools_used: toolResults.length }));

  } catch (e) {
    console.error("[Helix] Agentic error:", e.message);
    res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: `Helix error: ${e.message}` }));
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Helix] ERROR: Port ${HELIX_PORT} is already in use`);
    console.error("[Helix] Try: Get-Process -Name node | Stop-Process -Force");
  } else {
    console.error("[Helix] Server error:", err.message);
  }
  process.exit(1);
});

server.listen(HELIX_PORT, "127.0.0.1", () => {
  console.log(`[Helix] ========================================`);
  console.log(`[Helix] Butterfly Steward (Helix) running`);
  console.log(`[Helix] Web UI: http://127.0.0.1:${HELIX_PORT}`);
  console.log(`[Helix] Workspace: ${WORKSPACE_ROOT}`);
  console.log(`[Helix] Code Model: ${DEFAULT_MODEL}`);
  console.log(`[Helix] Vision Model: ${VISION_MODEL}`);
  console.log(`[Helix] Manifold: z = x · y (ephemeral substrates)`);
  console.log(`[Helix] Ollama: http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
  console.log(`[Helix] ========================================`);
});
