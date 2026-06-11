import "../src/server/channels/outboundWorker";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";

startWorkerHeartbeat("worker-outbound");
