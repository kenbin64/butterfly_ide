import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

type View = "landing" | "login" | "dashboard";
type Role = "superuser" | "admin" | "user";
type TransportKind = "DirectLoopback" | "SshTunnel";
type ProgramStatus = "design" | "prototype" | "live" | "refactor";

interface Account {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  allowedDomains: string[];
  capabilities: string[];
  createdBy: string;
  createdAt: string;
}

interface Session {
  username: string;
  role: Role;
  loginAt: string;
}

interface ProgramRecord {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: ProgramStatus;
  owner: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

interface AccountDraft {
  username: string;
  password: string;
  role: Role;
  allowedDomains: string[];
}

interface ProgramDraft {
  name: string;
  slug: string;
  domain: string;
  status: ProgramStatus;
  description: string;
}

interface EndpointFormState {
  transport: TransportKind;
  host: string;
  port: string;
  gatewayUser: string;
  gatewayHost: string;
  localPort: string;
  remotePort: string;
}

const STORAGE_KEYS = {
  accounts: "butterfly.operator.accounts",
  programs: "butterfly.operator.programs",
  session: "butterfly.operator.session",
};

const WORKSPACE_PATH = "C:/dev/butterfly-ide";
const GITHUB_BACKUP_REPOSITORY = "kenbin64/butterfly-ide";
const GITHUB_BACKUP_BRANCH = "main";
const RUNPOD_DEPLOYMENT_LABEL = "runpod-executor";
const RUNPOD_ARTIFACT = "butterfly-runtime";
const SEED_SUPERUSER_PASSWORD_HASH =
  "79e37514ca97f606d9048f930524b8d171cd29ebe5849196079efb0c12b5c3bb";

const DOMAIN_OPTIONS = [
  "butterflyfx.us",
  "app.butterflyfx.us",
  "helix.butterflyfx.us",
  "kensgames.com",
];

const CAPABILITIES_BY_ROLE: Record<Role, string[]> = {
  superuser: [
    "full architecture control",
    "deployment approval",
    "user and admin creation",
    "program creation",
    "domain access control",
    "VS Code bridge control",
  ],
  admin: [
    "user creation",
    "program creation",
    "domain assignment for managed users",
    "workspace operations",
  ],
  user: ["assigned domain access", "game and app use", "approved workspace features"],
};

const SEED_SUPERUSER: Account = {
  id: "seed-superuser",
  username: "kbingh64",
  passwordHash: SEED_SUPERUSER_PASSWORD_HASH,
  role: "superuser",
  allowedDomains: DOMAIN_OPTIONS,
  capabilities: CAPABILITIES_BY_ROLE.superuser,
  createdBy: "butterfly-seed",
  createdAt: "bootstrap",
};

const SEEDED_PROGRAMS: ProgramRecord[] = [
  {
    id: "program-butterfly-ide",
    name: "Butterfly IDE",
    slug: "butterfly-ide",
    domain: "butterflyfx.us",
    status: "prototype",
    owner: "kbingh64",
    description: "Private operator-first coding, deployment, validation, and Helix control surface.",
    createdBy: "butterfly-seed",
    createdAt: "bootstrap",
  },
  {
    id: "program-kensgames-suite",
    name: "KensGames Suite",
    slug: "kensgames-suite",
    domain: "kensgames.com",
    status: "prototype",
    owner: "kbingh64",
    description: "Game playing and creation suite that will host Fasttrack and BrickBreaker3D.",
    createdBy: "butterfly-seed",
    createdAt: "bootstrap",
  },
  {
    id: "program-fasttrack",
    name: "Fasttrack",
    slug: "fasttrack",
    domain: "kensgames.com",
    status: "refactor",
    owner: "kbingh64",
    description: "Dimensional refactor candidate for the KensGames suite.",
    createdBy: "butterfly-seed",
    createdAt: "bootstrap",
  },
  {
    id: "program-brickbreaker3d",
    name: "BrickBreaker3D",
    slug: "brickbreaker3d",
    domain: "kensgames.com",
    status: "refactor",
    owner: "kbingh64",
    description: "Arcade refactor candidate that will be brought into dimensional structure.",
    createdBy: "butterfly-seed",
    createdAt: "bootstrap",
  },
];

const DEFAULT_ACCOUNT_DRAFT: AccountDraft = {
  username: "",
  password: "",
  role: "user",
  allowedDomains: ["butterflyfx.us"],
};

const DEFAULT_PROGRAM_DRAFT: ProgramDraft = {
  name: "",
  slug: "",
  domain: "kensgames.com",
  status: "design",
  description: "",
};

const DEFAULT_ENDPOINT: EndpointFormState = {
  transport: "DirectLoopback",
  host: "127.0.0.1",
  port: "9000",
  gatewayUser: "uzpre49zt78f2l-64410eaf",
  gatewayHost: "ssh.runpod.io",
  localPort: "19000",
  remotePort: "9000",
};

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadAccounts(): Account[] {
  const stored = readStoredJson<Account[]>(STORAGE_KEYS.accounts, []);
  const withoutSeed = stored.filter((account) => account.username !== SEED_SUPERUSER.username);
  return [SEED_SUPERUSER, ...withoutSeed];
}

function loadPrograms(): ProgramRecord[] {
  const stored = readStoredJson<ProgramRecord[]>(STORAGE_KEYS.programs, []);
  const seededSlugs = new Set(SEEDED_PROGRAMS.map((program) => program.slug));
  const withoutSeedDuplicates = stored.filter((program) => !seededSlugs.has(program.slug));
  return [...SEEDED_PROGRAMS, ...withoutSeedDuplicates];
}

function loadSession(): Session | null {
  return readStoredJson<Session | null>(STORAGE_KEYS.session, null);
}

function roleLabel(role: Role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function statusLabel(status: ProgramStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function canManageUsers(role: Role) {
  return role === "superuser" || role === "admin";
}

function canCreatePrograms(role: Role) {
  return role === "superuser" || role === "admin";
}

function canChangeArchitecture(role: Role) {
  return role === "superuser";
}

function availableRoleOptions(role: Role): Role[] {
  return role === "superuser" ? ["admin", "user"] : ["user"];
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function hashPassword(password: string) {
  const encoded = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildEndpointPayload(endpoint: EndpointFormState) {
  if (endpoint.transport === "SshTunnel") {
    return {
      host: "127.0.0.1",
      port: Number(endpoint.localPort),
      transport: {
        kind: "SshTunnel",
        spec: {
          gateway_user: endpoint.gatewayUser,
          gateway_host: endpoint.gatewayHost,
          local_port: Number(endpoint.localPort),
          remote_port: Number(endpoint.remotePort),
        },
      },
    };
  }

  return {
    host: endpoint.host,
    port: Number(endpoint.port),
    transport: {
      kind: "DirectLoopback",
    },
  };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function hasBrowserWindow() {
  return typeof window !== "undefined";
}

function isTauriRuntime() {
  return hasBrowserWindow() && (typeof window.__TAURI_INTERNALS__ !== "undefined" || typeof window.__TAURI__ !== "undefined");
}

async function dispatchDesktopCommand<T>(command: string, payload: unknown) {
  if (!isTauriRuntime()) {
    throw new Error(
      "Butterfly AI commands are available in the Tauri desktop app. The web deployment is a browser-safe control surface.",
    );
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("dispatch", { command, payload });
}

function browserOpen(url: string) {
  if (!hasBrowserWindow()) {
    throw new Error(`No browser window is available to open ${url}.`);
  }

  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  if (/^https?:/i.test(url)) {
    anchor.target = "_blank";
  }
  anchor.style.display = "none";
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
}

async function openUrlInHost(url: string) {
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }

  browserOpen(url);
}

function buildVsCodeWorkspaceUrl() {
  return encodeURI(`vscode://file/${WORKSPACE_PATH.replace(/\\/g, "/")}`);
}

function buildDeploymentTargets(endpoint: EndpointFormState) {
  return [
    {
      kind: "RunpodPod",
      label: RUNPOD_DEPLOYMENT_LABEL,
      host: endpoint.transport === "SshTunnel" ? endpoint.gatewayHost : endpoint.host,
      artifact: RUNPOD_ARTIFACT,
      repository: null,
      branch: null,
    },
    {
      kind: "GitHubRepository",
      label: "origin",
      host: null,
      artifact: null,
      repository: GITHUB_BACKUP_REPOSITORY,
      branch: GITHUB_BACKUP_BRANCH,
    },
  ];
}

function buildAiWorkContext(endpoint: EndpointFormState) {
  return {
    manifold_focus: ["helix-manifold"],
    substrate_focus: ["text", "object", "binary"],
    objectives: [
      "local-workspace-coding",
      "vs-code-bridge",
      "github-backup-awareness",
      "deployment-awareness-on-request",
    ],
    workspace_roots: [WORKSPACE_PATH],
    source_of_truth: "LocalWorkspace",
    github_backup: {
      label: "origin",
      repository: GITHUB_BACKUP_REPOSITORY,
      branch: GITHUB_BACKUP_BRANCH,
      private: true,
    },
    deployment_targets: buildDeploymentTargets(endpoint),
    remote_node: endpoint.transport === "SshTunnel" ? RUNPOD_DEPLOYMENT_LABEL : null,
    remote_assist: {
      only_when_requested: true,
      allowed_scopes: ["Deployment", "Validation", "GitHubBackup"],
    },
  };
}

function App() {
  const desktopHost = isTauriRuntime();
  const [view, setView] = useState<View>(() => (loadSession() ? "dashboard" : "landing"));
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [programs, setPrograms] = useState<ProgramRecord[]>(() => loadPrograms());
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [loginUsername, setLoginUsername] = useState(SEED_SUPERUSER.username);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState(
    "Local bootstrap auth only. Replace with a real backend before any public exposure.",
  );
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(DEFAULT_ACCOUNT_DRAFT);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(DEFAULT_PROGRAM_DRAFT);
  const [accountMessage, setAccountMessage] = useState(
    "Superuser can create admins and users. Admins can create users.",
  );
  const [programMessage, setProgramMessage] = useState(
    "Admins and superusers can register program surfaces inside approved domains.",
  );
  const [endpoint, setEndpoint] = useState<EndpointFormState>(DEFAULT_ENDPOINT);
  const [prompt, setPrompt] = useState(
    "Summarize current Butterfly operator state and recommend the next verified step.",
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(() =>
    formatJson(
      desktopHost
        ? {
            status: "ready",
            note: "Use the control panel to run ai.health, ai.handshake, or ai.invoke.",
          }
        : {
            status: "web-preview",
            note: "The Vercel deployment is browser-safe. AI dispatch commands remain available in the Tauri desktop app.",
          },
    ),
  );
  const [bridgeMessage, setBridgeMessage] = useState(
    desktopHost
      ? "Command: code C:/dev/butterfly-ide"
      : "Browser mode: use the copied VS Code command on your workstation.",
  );

  const currentAccount = useMemo(
    () => accounts.find((account) => account.username === session?.username) ?? null,
    [accounts, session],
  );

  const manageableDomains = useMemo(() => {
    if (!currentAccount) {
      return ["butterflyfx.us"];
    }

    if (currentAccount.role === "superuser") {
      return DOMAIN_OPTIONS;
    }

    return currentAccount.allowedDomains.length > 0
      ? currentAccount.allowedDomains
      : ["butterflyfx.us"];
  }, [currentAccount]);

  const visiblePrograms = useMemo(() => {
    if (!currentAccount) {
      return programs.filter((program) => program.domain === "butterflyfx.us");
    }

    return programs.filter((program) => currentAccount.allowedDomains.includes(program.domain));
  }, [currentAccount, programs]);

  const roleOptions: Role[] = currentAccount ? availableRoleOptions(currentAccount.role) : ["user"];
  const activeView = view === "dashboard" && !currentAccount ? "landing" : view;

  useEffect(() => {
    persistJson(STORAGE_KEYS.accounts, accounts);
  }, [accounts]);

  useEffect(() => {
    persistJson(STORAGE_KEYS.programs, programs);
  }, [programs]);

  useEffect(() => {
    if (session) {
      persistJson(STORAGE_KEYS.session, session);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.session);
  }, [session]);

  useEffect(() => {
    if (currentAccount || !session) {
      return;
    }

    setSession(null);
    setView("login");
    setLoginMessage("Your session no longer matches a current account. Please sign in again.");
  }, [currentAccount, session]);

  useEffect(() => {
    if (!currentAccount) {
      setAccountDraft(DEFAULT_ACCOUNT_DRAFT);
      setProgramDraft(DEFAULT_PROGRAM_DRAFT);
      return;
    }

    setAccountDraft((draft) => {
      const nextRole = roleOptions.includes(draft.role) ? draft.role : roleOptions[0];
      const nextDomains = draft.allowedDomains.filter((domain) => manageableDomains.includes(domain));

      return {
        ...draft,
        role: nextRole,
        allowedDomains: nextDomains.length > 0 ? nextDomains : [manageableDomains[0]],
      };
    });

    setProgramDraft((draft) => ({
      ...draft,
      domain: manageableDomains.includes(draft.domain) ? draft.domain : manageableDomains[0],
    }));
  }, [currentAccount, manageableDomains, roleOptions]);

  async function handleAiCommand(command: "ai.health" | "ai.handshake" | "ai.invoke") {
    setAiBusy(true);

    try {
      const payload =
        command === "ai.invoke"
          ? {
              endpoint: buildEndpointPayload(endpoint),
              request: {
                prompt,
                system_prompt:
                  "You are Helix, the Butterfly Steward. Stay constitutional, operator-first, and continuity-aware.",
                max_tokens: 512,
                temperature: 0.2,
                work_context: buildAiWorkContext(endpoint),
                metadata: {
                  requested_by: session?.username ?? "unknown",
                  surface: "butterfly-control-panel",
                  workspace_authority: "local-first",
                  github_backup_repository: GITHUB_BACKUP_REPOSITORY,
                  remote_helper_mode: "deployment-only",
                },
              },
            }
          : {
              endpoint: buildEndpointPayload(endpoint),
            };

      const response = await dispatchDesktopCommand<unknown>(command, payload);

      setAiResult(formatJson(response));
    } catch (error) {
      setAiResult(
        formatJson({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function openWorkspaceInVsCode() {
    try {
      await openUrlInHost(buildVsCodeWorkspaceUrl());
      setBridgeMessage(
        desktopHost
          ? "Attempted to open the workspace in VS Code."
          : "Attempted to open VS Code from the browser. If nothing happened, run the copied command locally.",
      );
    } catch {
      setBridgeMessage("VS Code open failed. Use: code C:/dev/butterfly-ide");
    }
  }

  async function copyVsCodeCommand() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(`code ${WORKSPACE_PATH}`);
      setBridgeMessage("Copied VS Code workspace command.");
    } catch {
      setBridgeMessage("Clipboard copy failed. Use: code C:/dev/butterfly-ide");
    }
  }

  async function openExternal(url: string) {
    try {
      await openUrlInHost(url);
    } catch {
      setBridgeMessage(`Unable to open ${url}.`);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const matchedAccount = accounts.find((account) => account.username === loginUsername.trim());
    if (!matchedAccount) {
      setLoginMessage("Login failed. Check the local operator credentials and try again.");
      return;
    }

    const passwordHash = await hashPassword(loginPassword);
    if (passwordHash !== matchedAccount.passwordHash) {
      setLoginMessage("Login failed. Check the local operator credentials and try again.");
      return;
    }

    setSession({
      username: matchedAccount.username,
      role: matchedAccount.role,
      loginAt: new Date().toISOString(),
    });
    setView("dashboard");
    setLoginPassword("");
    setLoginMessage(`Signed in as ${matchedAccount.username} (${roleLabel(matchedAccount.role)}).`);
  }

  function handleLogout() {
    setSession(null);
    setView("landing");
    setLoginPassword("");
    setLoginMessage("Signed out. Butterfly returned to landing mode.");
  }

  async function handleDraftSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentAccount || !canManageUsers(currentAccount.role)) {
      setAccountMessage("Your role does not allow user management.");
      return;
    }

    if (!accountDraft.username.trim() || !accountDraft.password.trim()) {
      setAccountMessage("Username and password are required for every local account.");
      return;
    }

    if (accountDraft.allowedDomains.length === 0) {
      setAccountMessage("Assign at least one domain before creating an account.");
      return;
    }

    if (accounts.some((account) => account.username === accountDraft.username.trim())) {
      setAccountMessage("That username already exists.");
      return;
    }

    if (currentAccount.role === "admin" && accountDraft.role !== "user") {
      setAccountMessage("Admins can create users, but only the superuser can create admins.");
      return;
    }

    const passwordHash = await hashPassword(accountDraft.password);
    const newAccount: Account = {
      id: createId("acct"),
      username: accountDraft.username.trim(),
      passwordHash,
      role: accountDraft.role,
      allowedDomains: accountDraft.allowedDomains,
      capabilities: CAPABILITIES_BY_ROLE[accountDraft.role],
      createdBy: currentAccount.username,
      createdAt: new Date().toISOString(),
    };

    setAccounts((existing) => [...existing, newAccount]);
    setAccountDraft({
      username: "",
      password: "",
      role: roleOptions[0],
      allowedDomains: [manageableDomains[0]],
    });
    setAccountMessage(
      `Created ${roleLabel(newAccount.role)} account ${newAccount.username} with ${newAccount.allowedDomains.join(", ")} access.`,
    );
  }

  function handleProgramSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentAccount || !canCreatePrograms(currentAccount.role)) {
      setProgramMessage("Your role does not allow program creation.");
      return;
    }

    if (!programDraft.name.trim() || !programDraft.slug.trim()) {
      setProgramMessage("Program name and slug are required.");
      return;
    }

    if (programs.some((program) => program.slug === programDraft.slug.trim().toLowerCase())) {
      setProgramMessage("That program slug already exists.");
      return;
    }

    if (!manageableDomains.includes(programDraft.domain)) {
      setProgramMessage("You can only create programs inside your approved domains.");
      return;
    }

    const newProgram: ProgramRecord = {
      id: createId("program"),
      name: programDraft.name.trim(),
      slug: programDraft.slug.trim().toLowerCase(),
      domain: programDraft.domain,
      status: programDraft.status,
      owner: currentAccount.username,
      description: programDraft.description.trim() || "Program surface created from the Butterfly dashboard.",
      createdBy: currentAccount.username,
      createdAt: new Date().toISOString(),
    };

    setPrograms((existing) => [...existing, newProgram]);
    setProgramDraft({
      ...DEFAULT_PROGRAM_DRAFT,
      domain: manageableDomains[0],
    });
    setProgramMessage(`Created program ${newProgram.name} on ${newProgram.domain}.`);
  }

  function toggleDraftDomain(domain: string) {
    if (!manageableDomains.includes(domain)) {
      return;
    }

    setAccountDraft((draft) => ({
      ...draft,
      allowedDomains: draft.allowedDomains.includes(domain)
        ? draft.allowedDomains.filter((entry) => entry !== domain)
        : [...draft.allowedDomains, domain],
    }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Butterfly IDE · Helix Control Surface</p>
          <h1>Private operator-first coding, deployment, and system stewardship.</h1>
        </div>

        <nav className="topbar-actions">
          <button type="button" className="ghost-button" onClick={() => setView("landing")}>
            Landing
          </button>
          <button type="button" className="ghost-button" onClick={() => setView("login")}>
            Login
          </button>
          {session ? (
            <button type="button" className="primary-button" onClick={() => setView("dashboard")}>
              Dashboard
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={() => openExternal("https://kensgames.com")}>
              KensGames
            </button>
          )}
        </nav>
      </header>

      {activeView === "landing" && (
        <main className="page-grid">
          <section className="hero-card feature-span">
            <div>
              <p className="eyebrow">butterflyfx.us</p>
              <h2>Butterfly is the control plane. VS Code is the main editor.</h2>
              <p className="lead">
                Helix manages coding context, deployments, health, versioning, and operator approvals while VS Code
                remains the primary editing surface for the system itself.
              </p>
            </div>

            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => setView("login")}>
                Enter operator login
              </button>
              <button type="button" className="ghost-button" onClick={openWorkspaceInVsCode}>
                Open workspace in VS Code
              </button>
            </div>
          </section>

          <section className="panel">
            <h3>What Butterfly does</h3>
            <ul className="bullet-list">
              <li>Runs Helix as the operator AI and system steward.</li>
              <li>Keeps your coding workflow local while VS Code stays the primary editor.</li>
              <li>Uses GitHub as private backup and uses the remote node only for deployment help.</li>
            </ul>
          </section>

          <section className="panel">
            <h3>Why VS Code stays primary</h3>
            <ul className="bullet-list">
              <li>Best day-to-day editing surface for the codebase itself.</li>
              <li>Butterfly can center memory, orchestration, testing, and approvals around it.</li>
              <li>The bridge can later grow into file, patch, selection, and diagnostic sync.</li>
            </ul>
          </section>

          <section className="panel feature-span">
            <h3>Domain suite</h3>
            <div className="domain-grid">
              <button type="button" className="domain-card left-align" onClick={() => openExternal("https://butterflyfx.us")}>
                <strong>butterflyfx.us</strong>
                <span>Main private home for Butterfly IDE and Helix.</span>
              </button>
              <button type="button" className="domain-card left-align" onClick={() => openExternal("https://kensgames.com")}>
                <strong>kensgames.com</strong>
                <span>Complete game playing and game creation suite for Fasttrack and BrickBreaker3D.</span>
              </button>
            </div>
          </section>
        </main>
      )}

      {activeView === "login" && (
        <main className="page-grid login-grid">
          <section className="panel">
            <p className="eyebrow">Private operator login</p>
            <h2>Enter Butterfly control.</h2>
            <p className="muted">
              This is a local bootstrap authentication stub for private testing. It is not a production auth backend.
            </p>

            <form className="stack-form" onSubmit={handleLogin}>
              <label>
                Username
                <input value={loginUsername} onChange={(event) => setLoginUsername(event.currentTarget.value)} />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.currentTarget.value)}
                />
              </label>

              <button type="submit" className="primary-button">
                Login to Butterfly
              </button>
            </form>

            <p className="status-text">{loginMessage}</p>
          </section>

          <section className="panel">
            <h3>Bootstrap operator account</h3>
            <ul className="bullet-list">
              <li>
                Username: <code>kbingh64</code>
              </li>
              <li>
                Password: <code>Rusheib64!</code>
              </li>
              <li>
                Role: <code>superuser</code>
              </li>
            </ul>

            <h3>Role law</h3>
            <ul className="bullet-list">
              <li>
                <strong>Superuser</strong>: can do anything, including architecture control and admin creation.
              </li>
              <li>
                <strong>Admin</strong>: can create users and programs, but cannot change overall architecture.
              </li>
              <li>
                <strong>User</strong>: gets access only to assigned domains, games, and approved surfaces.
              </li>
            </ul>
          </section>
        </main>
      )}

      {activeView === "dashboard" && currentAccount && (
        <main className="dashboard-grid">
          <section className="panel feature-span">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Operator session</p>
                <h2>{currentAccount.username}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Sign out
              </button>
            </div>

            <div className="chip-row">
              <span className="chip">Role: {roleLabel(currentAccount.role)}</span>
              <span className="chip">Workspace: {WORKSPACE_PATH}</span>
              <span className="chip">Domains: {currentAccount.allowedDomains.length}</span>
              <span className="chip">Surface: {desktopHost ? "Desktop operator" : "Web preview"}</span>
            </div>

            <p className="muted">
              Butterfly is the control plane while VS Code remains the main editor. Helix manages context,
              deployments, approvals, and continuity around that editor.
            </p>

            <div className="chip-row">
              <span className="chip">Source of truth: Local workspace</span>
              <span className="chip">Backup: {GITHUB_BACKUP_REPOSITORY}</span>
              <span className="chip">Remote helper: Runpod deployment/validation</span>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">VS Code bridge</p>
            <h3>Main editor surface</h3>
            <p className="muted">
              Use VS Code for editing. Use Butterfly for operator memory, AI actions, health checks, deployment, and
              validated system control.
            </p>

            <div className="action-row">
              <button type="button" className="primary-button" onClick={openWorkspaceInVsCode}>
                Open workspace in VS Code
              </button>
              <button type="button" className="ghost-button" onClick={copyVsCodeCommand}>
                Copy code command
              </button>
            </div>

            <p className="status-text">{bridgeMessage}</p>
          </section>

          <section className="panel">
            <p className="eyebrow">Domain access</p>
            <h3>Assigned surfaces</h3>
            <div className="chip-row">
              {currentAccount.allowedDomains.map((domain) => (
                <span key={domain} className="chip">
                  {domain}
                </span>
              ))}
            </div>

            <div className="domain-grid compact-grid">
              <button type="button" className="domain-card left-align" onClick={() => openExternal("https://butterflyfx.us")}>
                <strong>butterflyfx.us</strong>
                <span>Private Butterfly and Helix home.</span>
              </button>
              <button type="button" className="domain-card left-align" onClick={() => openExternal("https://kensgames.com")}>
                <strong>kensgames.com</strong>
                <span>Game playing and creation suite for Fasttrack and BrickBreaker3D.</span>
              </button>
            </div>
          </section>

          <section className="panel feature-span">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Helix AI control</p>
                <h3>Executor operations</h3>
              </div>
              <span className="chip">{endpoint.transport}</span>
            </div>

            <div className="form-grid">
              <label>
                Transport
                <select
                  value={endpoint.transport}
                  onChange={(event) =>
                    setEndpoint((existing) => ({
                      ...existing,
                      transport: event.currentTarget.value as TransportKind,
                    }))
                  }
                >
                  <option value="DirectLoopback">Direct loopback</option>
                  <option value="SshTunnel">SSH tunnel</option>
                </select>
              </label>

              {endpoint.transport === "DirectLoopback" ? (
                <>
                  <label>
                    Host
                    <input
                      value={endpoint.host}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, host: event.currentTarget.value }))
                      }
                    />
                  </label>
                  <label>
                    Port
                    <input
                      value={endpoint.port}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, port: event.currentTarget.value }))
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Gateway user
                    <input
                      value={endpoint.gatewayUser}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, gatewayUser: event.currentTarget.value }))
                      }
                    />
                  </label>
                  <label>
                    Gateway host
                    <input
                      value={endpoint.gatewayHost}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, gatewayHost: event.currentTarget.value }))
                      }
                    />
                  </label>
                  <label>
                    Local port
                    <input
                      value={endpoint.localPort}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, localPort: event.currentTarget.value }))
                      }
                    />
                  </label>
                  <label>
                    Remote port
                    <input
                      value={endpoint.remotePort}
                      onChange={(event) =>
                        setEndpoint((existing) => ({ ...existing, remotePort: event.currentTarget.value }))
                      }
                    />
                  </label>
                </>
              )}
            </div>

            <label>
              Invoke prompt
              <textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} rows={5} />
            </label>

            <p className="muted">
              {desktopHost
                ? "These commands run through the local Tauri dispatch boundary."
                : "AI command dispatch is disabled on the public web deployment and remains available in the desktop operator app."}
            </p>

            <div className="action-row">
              <button
                type="button"
                className="primary-button"
                disabled={aiBusy || !desktopHost}
                onClick={() => handleAiCommand("ai.health")}
              >
                Run ai.health
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={aiBusy || !desktopHost}
                onClick={() => handleAiCommand("ai.handshake")}
              >
                Run ai.handshake
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={aiBusy || !desktopHost}
                onClick={() => handleAiCommand("ai.invoke")}
              >
                Run ai.invoke
              </button>
            </div>

            <pre className="result-panel">{aiBusy ? "Running Butterfly AI command..." : aiResult}</pre>
          </section>

          <section className="panel">
            <p className="eyebrow">Role capabilities</p>
            <h3>Authority model</h3>
            <ul className="bullet-list">
              {currentAccount.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <p className="eyebrow">Architecture control</p>
            <h3>Governance boundary</h3>
            <p className="muted">
              {canChangeArchitecture(currentAccount.role)
                ? "Superuser access confirmed. You can govern overall Butterfly architecture."
                : "Architecture control is locked. Admins and users may operate within the system but cannot change overall architecture."}
            </p>
          </section>

          <section className="panel feature-span">
            <p className="eyebrow">Program suites</p>
            <h3>Accessible programs</h3>
            <div className="account-table">
              {visiblePrograms.map((program) => (
                <article key={program.id} className="account-card">
                  <div className="panel-header">
                    <strong>{program.name}</strong>
                    <span className="chip">{statusLabel(program.status)}</span>
                  </div>
                  <p className="muted">Domain: {program.domain}</p>
                  <p className="muted">Slug: {program.slug}</p>
                  <p className="muted">{program.description}</p>
                </article>
              ))}
            </div>
          </section>

          {canCreatePrograms(currentAccount.role) && (
            <section className="panel feature-span">
              <p className="eyebrow">Program registry</p>
              <h3>Create program surfaces</h3>

              <form className="stack-form" onSubmit={handleProgramSubmit}>
                <div className="form-grid">
                  <label>
                    Program name
                    <input
                      value={programDraft.name}
                      onChange={(event) =>
                        setProgramDraft((draft) => ({ ...draft, name: event.currentTarget.value }))
                      }
                    />
                  </label>

                  <label>
                    Slug
                    <input
                      value={programDraft.slug}
                      onChange={(event) =>
                        setProgramDraft((draft) => ({ ...draft, slug: event.currentTarget.value }))
                      }
                    />
                  </label>

                  <label>
                    Domain
                    <select
                      value={programDraft.domain}
                      onChange={(event) =>
                        setProgramDraft((draft) => ({ ...draft, domain: event.currentTarget.value }))
                      }
                    >
                      {manageableDomains.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={programDraft.status}
                      onChange={(event) =>
                        setProgramDraft((draft) => ({
                          ...draft,
                          status: event.currentTarget.value as ProgramStatus,
                        }))
                      }
                    >
                      <option value="design">Design</option>
                      <option value="prototype">Prototype</option>
                      <option value="live">Live</option>
                      <option value="refactor">Refactor</option>
                    </select>
                  </label>
                </div>

                <label>
                  Description
                  <textarea
                    value={programDraft.description}
                    rows={4}
                    onChange={(event) =>
                      setProgramDraft((draft) => ({ ...draft, description: event.currentTarget.value }))
                    }
                  />
                </label>

                <button type="submit" className="primary-button">
                  Create program
                </button>
              </form>

              <p className="status-text">{programMessage}</p>
            </section>
          )}

          {canManageUsers(currentAccount.role) && (
            <section className="panel feature-span">
              <p className="eyebrow">User management</p>
              <h3>Create accounts and assign domains</h3>

              <form className="stack-form" onSubmit={handleDraftSubmit}>
                <div className="form-grid">
                  <label>
                    Username
                    <input
                      value={accountDraft.username}
                      onChange={(event) =>
                        setAccountDraft((draft) => ({ ...draft, username: event.currentTarget.value }))
                      }
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={accountDraft.password}
                      onChange={(event) =>
                        setAccountDraft((draft) => ({ ...draft, password: event.currentTarget.value }))
                      }
                    />
                  </label>

                  <label>
                    Role
                    <select
                      value={accountDraft.role}
                      onChange={(event) =>
                        setAccountDraft((draft) => ({ ...draft, role: event.currentTarget.value as Role }))
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="checkbox-grid">
                  <legend>Allowed domains</legend>
                  {manageableDomains.map((domain) => (
                    <label key={domain} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={accountDraft.allowedDomains.includes(domain)}
                        onChange={() => toggleDraftDomain(domain)}
                      />
                      <span>{domain}</span>
                    </label>
                  ))}
                </fieldset>

                <button type="submit" className="primary-button">
                  Create account
                </button>
              </form>

              <p className="status-text">{accountMessage}</p>

              <div className="account-table">
                {accounts.map((account) => (
                  <article key={account.id} className="account-card">
                    <div className="panel-header">
                      <strong>{account.username}</strong>
                      <span className="chip">{roleLabel(account.role)}</span>
                    </div>
                    <p className="muted">Created by {account.createdBy}</p>
                    <p className="muted">Domains: {account.allowedDomains.join(", ")}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
