import "dotenv/config";
import { getQdrantHealth } from "../src/lib/qdrant";

async function main() {
  const health = await getQdrantHealth();
  console.log(JSON.stringify(health, null, 2));
  if (health.status === "error") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
