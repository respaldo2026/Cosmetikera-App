const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rootTsconfigPath = path.join(rootDir, "tsconfig.build.json");
const nodeModulesTsconfigPath = path.join(rootDir, "node_modules", "tsconfig.build.json");

const ensureFile = (filePath, content) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
    }
  } catch (error) {
    console.warn(`[ensure-tsconfig-build] No se pudo crear ${filePath}:`, error);
  }
};

const rootContent = JSON.stringify({ extends: "./tsconfig.json" }, null, 2) + "\n";
const nodeModulesContent = JSON.stringify({ extends: "../tsconfig.build.json" }, null, 2) + "\n";

ensureFile(rootTsconfigPath, rootContent);

if (fs.existsSync(path.join(rootDir, "node_modules"))) {
  ensureFile(nodeModulesTsconfigPath, nodeModulesContent);
}
