const fs = require("fs/promises");
const path = require("path");

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

  await removeIfExists(nextDir);

  if (!process.exitCode) {
    console.log("Cache local de Next reiniciado.");
  }
}

main();