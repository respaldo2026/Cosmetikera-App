const fs = require("fs/promises");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const DEV_PORTS = [3001, 5001, 5002];

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

function getListeningPidsWindows(port) {
  const result = run("netstat", ["-ano", "-p", "tcp"]);
  if (result.status !== 0) return [];

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes("LISTENING"))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] && parts[1].endsWith(`:${port}`))
    .map((parts) => Number(parts[parts.length - 1]))
    .filter(Number.isFinite);
}

function getListeningPidsUnix(port) {
  const result = run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
  if (result.status !== 0) return [];

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter(Number.isFinite);
}

function getListeningPids(port) {
  return process.platform === "win32"
    ? getListeningPidsWindows(port)
    : getListeningPidsUnix(port);
}

function getProcessName(pid) {
  if (process.platform === "win32") {
    const result = run("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
    if (result.status !== 0) return null;

    const line = result.stdout.trim();
    if (!line || line.startsWith("INFO:")) return null;
    return line.split(",")[0]?.replace(/^"|"$/g, "") ?? null;
  }

  const result = run("ps", ["-p", String(pid), "-o", "comm="]);
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function killPid(pid) {
  if (process.platform === "win32") {
    return run("taskkill", ["/PID", String(pid), "/F"]);
  }

  return run("kill", ["-9", String(pid)]);
}

async function removeNextDir() {
  const projectRoot = path.resolve(__dirname, "..");
  const dirsToRemove = [
    path.join(projectRoot, ".next-dev"),
    path.join(projectRoot, ".next-dev-3001"),
  ];

  for (const dirPath of dirsToRemove) {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`Eliminado: ${dirPath}`);
  }
}

async function main() {
  const found = new Map();

  for (const port of DEV_PORTS) {
    for (const pid of getListeningPids(port)) {
      if (!found.has(pid)) {
        found.set(pid, { pid, ports: [port] });
      } else {
        found.get(pid).ports.push(port);
      }
    }
  }

  for (const { pid, ports } of found.values()) {
    const processName = getProcessName(pid);
    if (!processName) continue;

    if (!processName.toLowerCase().includes("node")) {
      console.error(`El puerto ${ports.join(", ")} está ocupado por un proceso no-node (${processName}, PID ${pid}). Libéralo manualmente.`);
      process.exit(1);
    }

    killPid(pid);
    console.log(`Proceso detenido: ${processName} (PID ${pid}) en puerto(s) ${ports.join(", ")}`);
  }

  await removeNextDir();

  const npmCommand = process.platform === "win32" ? "npm run dev" : "npm";
  const npmArgs = process.platform === "win32" ? [] : ["run", "dev"];
  const child = spawn(npmCommand, npmArgs, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});