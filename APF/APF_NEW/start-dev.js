const { spawn } = require("child_process");
const path = require("path");

const ROOT_DIR = __dirname;
const CERTIFICATE_PORTAL_DIR = path.join(ROOT_DIR, "..", "CERTIFICATE_NEW");
const children = [];
let shuttingDown = false;

function startProcess(commandArgs, options = {}) {
  const child = spawn(process.execPath, commandArgs, {
    cwd: options.cwd || ROOT_DIR,
    env: {
      ...process.env,
      ...(options.extraEnv || {})
    },
    stdio: "inherit"
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });

  setTimeout(() => process.exit(exitCode), 300);
}

const apiServer = startProcess(["directory-data-server.js"]);
const clientServer = startProcess(
  [path.join("node_modules", "react-scripts", "bin", "react-scripts.js"), "start"],
  {
    extraEnv: {
      BROWSER: "none",
      DISABLE_ESLINT_PLUGIN: "true"
    }
  }
);
const certificateServer = startProcess(["server.js"], {
  cwd: CERTIFICATE_PORTAL_DIR,
  extraEnv: {
    PORT: process.env.CERTIFICATE_APP_PORT || "3003"
  }
});

apiServer.on("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code || 0);
  }
});

clientServer.on("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code || 0);
  }
});

certificateServer.on("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code || 0);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
