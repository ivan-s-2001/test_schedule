import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const configuredUrl =
  process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:41873";

function resolvePort(): number {
  const explicitPort = Number.parseInt(process.env.PORT ?? "", 10);
  if (Number.isInteger(explicitPort) && explicitPort > 0 && explicitPort <= 65535) {
    return explicitPort;
  }

  try {
    const url = new URL(configuredUrl);
    const urlPort = Number.parseInt(url.port, 10);

    if (Number.isInteger(urlPort) && urlPort > 0 && urlPort <= 65535) {
      return urlPort;
    }

    return url.protocol === "https:" ? 443 : 80;
  } catch {
    return 41873;
  }
}

const port = resolvePort();

function resolveBrowserUrl(): string {
  try {
    const url = new URL(configuredUrl);
    url.port = String(port);
    return url.origin;
  } catch {
    return `http://localhost:${port}`;
  }
}

const browserUrl = resolveBrowserUrl();
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/ws",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ---- Room management ----

    socket.on("join:org", (orgId: string) => {
      socket.join(`org:${orgId}`);
      console.log(`Socket ${socket.id} joined org:${orgId}`);
    });

    socket.on("join:schedule", (scheduleId: string) => {
      socket.join(`schedule:${scheduleId}`);
      console.log(`Socket ${socket.id} joined schedule:${scheduleId}`);
    });

    socket.on("leave:schedule", (scheduleId: string) => {
      socket.leave(`schedule:${scheduleId}`);
      console.log(`Socket ${socket.id} left schedule:${scheduleId}`);
    });

    // ---- Live-mode events (forwarded to schedule room) ----

    socket.on("live:started", (data: { scheduleId: string }) => {
      socket.to(`schedule:${data.scheduleId}`).emit("live:started", data);
    });

    socket.on("live:stopped", (data: { scheduleId: string }) => {
      socket.to(`schedule:${data.scheduleId}`).emit("live:stopped", data);
    });

    socket.on(
      "live:booking",
      (data: {
        scheduleId: string;
        shiftId: string;
        userId: string;
        action: string;
      }) => {
        socket.to(`schedule:${data.scheduleId}`).emit("live:booking", data);
      }
    );

    // ---- Disconnect ----

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  (globalThis as { __socketIO?: SocketIOServer }).__socketIO = io;

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on ${browserUrl}`);
    console.log(`> Listening on http://${hostname}:${port}`);
  });
});
