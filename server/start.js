import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const serverProcess = spawn(npmCmd, ["run", "dev:server"], {
  stdio: "inherit",
  shell: true
});

const clientProcess = spawn(npmCmd, ["run", "dev:client"], {
  stdio: "inherit",
  shell: true
});

function cleanup() {
  if (isWindows) {
    if (serverProcess.pid) {
      spawn("taskkill", ["/pid", serverProcess.pid.toString(), "/f", "/t"]);
    }
    if (clientProcess.pid) {
      spawn("taskkill", ["/pid", clientProcess.pid.toString(), "/f", "/t"]);
    }
  } else {
    serverProcess.kill("SIGTERM");
    clientProcess.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});
