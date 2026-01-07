import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api" }));
app.get("/api/hello", async () => ({ message: "Hello from IRVE API" }));

const port = Number(process.env.PORT ?? 4010);
await app.listen({ port, host: "0.0.0.0" });
