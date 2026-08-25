import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.claude-queue-agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AgentConfig {
  backendUrl: string;
  deviceId: string;
  deviceToken: string;
  baseDir: string;
}

export function loadConfig(): AgentConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

export function saveConfig(config: AgentConfig) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function configPath() {
  return CONFIG_FILE;
}
