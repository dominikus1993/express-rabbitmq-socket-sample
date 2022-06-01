import express from "express"
import pino from "pino"
import http from "http";
import express_pino from "express-pino-logger"
import body_parser from "body-parser"
import { RabbitMqBus } from "./rabbitmq/index"
import { Server } from "socket.io";
import { TestMessage } from "./model/message";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Emitter } from "@socket.io/redis-emitter";
const logger = pino({level: process.env.NODE_ENV === "development" ? "debug": "warn"})
const expresLogger = express_pino({logger: logger})
const pubClient = createClient({ url: process.env.REDIS_CONNECTION ?? "redis://db:6379" });
const subClient = pubClient.duplicate();

const app = express()
app.use(body_parser.urlencoded({ extended: true }));
app.use(expresLogger)

const bus = RabbitMqBus.from(process.env.RABBITMQ_CONNECTION ?? "amqp://guest:guest@rabbitmq:5672/")

app.get('/:to', async function (req, res) {
    await bus.publish<TestMessage>({exchange: "test", topic: "#", message: { to: req.params['to'] }})
    res.send('send')
  })


const server = http.createServer(app);

const io = new Server(server, { cors: { origin: '*' }}); // < Interesting!

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
const emitter = new Emitter(pubClient)
await bus.consume({exchange: process.env.EXCHANGE ?? "test", queue: process.env.QUEUE ?? "test", topic: process.env.TOPIC ?? "#"}, (msg: TestMessage) => {
    emitter.emit("message", msg)
    logger.info(`Hello ${msg.to}`)
});

io.on("connection", (socket) => {
    logger.info("New client connected");
    socket.on("disconnect", () => {
        logger.info("Client disconnected");
    });
  });


server.listen(process.env.PORT ?? 3000, () => { logger.info("Server is listening") })
