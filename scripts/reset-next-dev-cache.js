const fs = require("fs/promises");
const net = require("net");
const path = require("path");

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };

    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", (error) => {
      if (error && error.code === "ECONNREFUSED") {
        finish(false);
        return;
      }

      finish(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

async function removeIfExists(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    console.log(`Eliminado: ${targetPath}`);
  } catch (error) {
    console.error(`No se pudo eliminar ${targetPath}:`, error.message);
    process.exitCode = 1;
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const nextDir = path.join(projectRoot, ".next");

  const devServerBusy = await isPortBusy(3001);
  if (devServerBusy) {
    console.error("El puerto 3001 está en uso. Detén el servidor antes de ejecutar dev:reset o usa npm run dev:restart.");
    process.exit(1);
  }

  await removeIfExists(nextDir);

  if (!process.exitCode) {
    console.log("Cache local de Next reiniciado.");
  }
}

main();