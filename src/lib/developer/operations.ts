import { execFile } from "child_process";
import { createGzip } from "zlib";
import { createWriteStream } from "fs";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { connectToDatabase } from "@/lib/mongodb";
import { createRedisConnection } from "@/lib/redis-connection";

const execFileAsync = promisify(execFile);

const BACKUP_DIR = process.env.DEVELOPER_BACKUP_DIR || path.join(process.cwd(), "backups", "mongo");
const RESTART_ENABLED = process.env.DEVELOPER_PANEL_ALLOW_RESTART === "true";
const ALLOWED_PM2_TARGETS = {
  web: ["chatzi-web"],
  workers: [
    "worker-ingress",
    "worker-core-routing",
    "worker-ai",
    "worker-egress",
    "worker-outbound"
  ],
  all: ["all"]
} as const;

export type RestartTarget = keyof typeof ALLOWED_PM2_TARGETS;

export type DeveloperBackupSummary = {
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
};

export type DeveloperMetrics = {
  generatedAt: string;
  node: {
    version: string;
    env: string;
    pid: number;
    uptimeSeconds: number;
    memory: NodeJS.MemoryUsage;
  };
  host: {
    platform: string;
    arch: string;
    hostname: string;
    uptimeSeconds: number;
    cpuCount: number;
    loadAverage: number[];
    memoryTotalBytes: number;
    memoryFreeBytes: number;
    memoryUsedPercent: number;
  };
  disk: {
    ok: boolean;
    filesystem?: string;
    sizeBytes?: number;
    usedBytes?: number;
    availableBytes?: number;
    usedPercent?: number;
    mount?: string;
    error?: string;
  };
  mongo: {
    ok: boolean;
    database?: string;
    collections?: number;
    objects?: number;
    dataSizeBytes?: number;
    storageSizeBytes?: number;
    indexSizeBytes?: number;
    error?: string;
  };
  redis: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
  pm2: {
    ok: boolean;
    processes: Array<{
      name: string;
      status: string;
      cpu?: number;
      memoryBytes?: number;
      restarts?: number;
      uptime?: number;
    }>;
    error?: string;
  };
  backups: DeveloperBackupSummary[];
  controls: {
    restartEnabled: boolean;
    backupDir: string;
  };
};

function bytesFromDfKilobytes(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1024 : undefined;
}

async function getDiskUsage() {
  try {
    const { stdout } = await execFileAsync("df", ["-kP", process.cwd()], { timeout: 5000 });
    const [, line] = stdout.trim().split(/\r?\n/);
    if (!line) throw new Error("df returned no disk row");

    const columns = line.split(/\s+/);
    const usedPercent = Number(String(columns[4] || "").replace("%", ""));

    return {
      ok: true,
      filesystem: columns[0],
      sizeBytes: bytesFromDfKilobytes(columns[1]),
      usedBytes: bytesFromDfKilobytes(columns[2]),
      availableBytes: bytesFromDfKilobytes(columns[3]),
      usedPercent: Number.isFinite(usedPercent) ? usedPercent : undefined,
      mount: columns[5]
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read disk usage."
    };
  }
}

async function getMongoStats() {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB database handle is unavailable.");

    const stats = await db.stats();
    return {
      ok: true,
      database: db.databaseName,
      collections: stats.collections,
      objects: stats.objects,
      dataSizeBytes: stats.dataSize,
      storageSizeBytes: stats.storageSize,
      indexSizeBytes: stats.indexSize
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read MongoDB stats."
    };
  }
}

async function getRedisStatus() {
  const startedAt = Date.now();
  const redis = createRedisConnection("developer-panel-health", { failFast: true });

  try {
    await redis.connect();
    await redis.ping();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to ping Redis."
    };
  } finally {
    redis.disconnect();
  }
}

async function getPm2Status() {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 5000, maxBuffer: 1024 * 1024 });
    const apps = JSON.parse(stdout) as Array<any>;

    return {
      ok: true,
      processes: apps.map((app) => ({
        name: String(app.name || "unknown"),
        status: String(app.pm2_env?.status || "unknown"),
        cpu: typeof app.monit?.cpu === "number" ? app.monit.cpu : undefined,
        memoryBytes: typeof app.monit?.memory === "number" ? app.monit.memory : undefined,
        restarts: typeof app.pm2_env?.restart_time === "number" ? app.pm2_env.restart_time : undefined,
        uptime: typeof app.pm2_env?.pm_uptime === "number" ? Math.max(0, Date.now() - app.pm2_env.pm_uptime) : undefined
      }))
    };
  } catch (error) {
    return {
      ok: false,
      processes: [],
      error: error instanceof Error ? error.message : "Unable to read PM2 status."
    };
  }
}

function safeBackupName(name: string) {
  return /^[a-zA-Z0-9._-]+\.json\.gz$/.test(name) ? name : null;
}

export function resolveBackupPath(name: string) {
  const safeName = safeBackupName(name);
  if (!safeName) return null;

  const resolved = path.resolve(BACKUP_DIR, safeName);
  const root = path.resolve(BACKUP_DIR);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

export async function listDatabaseBackups(): Promise<DeveloperBackupSummary[]> {
  await mkdir(BACKUP_DIR, { recursive: true });

  const names = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const backups = await Promise.all(
    names
      .filter((name) => safeBackupName(name))
      .map(async (name) => {
        const filePath = path.join(BACKUP_DIR, name);
        const fileStat = await stat(filePath);
        return {
          name,
          path: filePath,
          sizeBytes: fileStat.size,
          createdAt: fileStat.birthtime.toISOString()
        };
      })
  );

  return backups.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20);
}

function writeChunk(stream: NodeJS.WritableStream, chunk: string) {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      stream.off("drain", onDrain);
      reject(error);
    };
    const onDrain = () => {
      stream.off("error", onError);
      resolve();
    };

    stream.once("error", onError);
    if (stream.write(chunk)) {
      stream.off("error", onError);
      resolve();
    } else {
      stream.once("drain", onDrain);
    }
  });
}

export async function createDatabaseBackup() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB database handle is unavailable.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `chatzi-${db.databaseName}-${timestamp}.json.gz`;
  const filePath = path.join(BACKUP_DIR, name);
  const gzip = createGzip({ level: 6 });
  const output = createWriteStream(filePath, { flags: "wx" });
  gzip.pipe(output);

  const startedAt = Date.now();
  const collections = (await db.listCollections().toArray()).filter((collection) => !collection.name.startsWith("system."));
  const counts: Record<string, number> = {};

  try {
    await writeChunk(
      gzip,
      JSON.stringify({
        metadata: {
          app: "chatzi",
          database: db.databaseName,
          createdAt: new Date().toISOString(),
          format: "json.gz",
          collections: collections.map((collection) => collection.name)
        }
      }).replace(/}$/, ',"collections":{')
    );

    for (let index = 0; index < collections.length; index += 1) {
      const collection = collections[index];
      const collectionName = collection.name;
      counts[collectionName] = 0;

      if (index > 0) await writeChunk(gzip, ",");
      await writeChunk(gzip, `${JSON.stringify(collectionName)}:[`);

      const cursor = db.collection(collectionName).find({}).batchSize(500);
      let first = true;
      for await (const document of cursor) {
        if (!first) await writeChunk(gzip, ",");
        await writeChunk(gzip, JSON.stringify(document));
        first = false;
        counts[collectionName] += 1;
      }

      await writeChunk(gzip, "]");
    }

    await writeChunk(gzip, "}}");
    await new Promise<void>((resolve, reject) => {
      output.once("finish", resolve);
      output.once("error", reject);
      gzip.once("error", reject);
      gzip.end();
    });

    const fileStat = await stat(filePath);
    return {
      ok: true,
      name,
      path: filePath,
      sizeBytes: fileStat.size,
      durationMs: Date.now() - startedAt,
      collectionCounts: counts
    };
  } catch (error) {
    gzip.destroy();
    output.destroy();
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
}

export async function getDeveloperMetrics(): Promise<DeveloperMetrics> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  const [disk, mongo, redis, pm2, backups] = await Promise.all([
    getDiskUsage(),
    getMongoStats(),
    getRedisStatus(),
    getPm2Status(),
    listDatabaseBackups()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    node: {
      version: process.version,
      env: process.env.NODE_ENV || "development",
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage()
    },
    host: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.round(os.uptime()),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      memoryTotalBytes: totalMemory,
      memoryFreeBytes: freeMemory,
      memoryUsedPercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 1000) / 10
    },
    disk,
    mongo,
    redis,
    pm2,
    backups,
    controls: {
      restartEnabled: RESTART_ENABLED,
      backupDir: BACKUP_DIR
    }
  };
}

export async function restartManagedServices(target: RestartTarget) {
  if (!RESTART_ENABLED) {
    return {
      ok: false,
      disabled: true,
      message: "Restart controls are disabled. Set DEVELOPER_PANEL_ALLOW_RESTART=true to enable them."
    };
  }

  const apps = ALLOWED_PM2_TARGETS[target];
  if (!apps) {
    throw new Error("Unsupported restart target.");
  }

  if (target === "web" || target === "all") {
    setTimeout(() => {
      execFile("pm2", ["restart", ...apps], { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          console.error("[developer-panel] PM2 restart failed", error.message, stderr);
          return;
        }
        console.log("[developer-panel] PM2 restart completed", stdout);
      });
    }, 1000);

    return {
      ok: true,
      scheduled: true,
      target,
      apps,
      message: "Restart has been scheduled. The current web process may reconnect shortly."
    };
  }

  const { stdout, stderr } = await execFileAsync("pm2", ["restart", ...apps], {
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });

  return {
    ok: true,
    scheduled: false,
    target,
    apps,
    stdout,
    stderr
  };
}
