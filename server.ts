import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const browserUrl = process.env.APP_URL || `http://localhost:${port}`;

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

  (globalThis as any).__socketIO = io;

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on ${browserUrl}`);
    console.log(`> Listening on http://${hostname}:${port}`);
  });
});
