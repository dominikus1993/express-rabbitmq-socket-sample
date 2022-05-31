import express from "express"
import pino from "pino"
import http from "http";
import express_pino from "express-pino-logger"
import body_parser from "body-parser"
import { RabbitMqBus } from "./rabbitmq/index"
import { TestMessage } from "./model/message";

const logger = pino({level: "debug"})
const expresLogger = express_pino({logger: logger})

const app = express()
app.use(body_parser.urlencoded({ extended: true }));
app.use(expresLogger)

const bus = RabbitMqBus.from(process.env.RABBITMQ_CONNECTION ?? "amqp://guest:guest@rabbitmq:5672/")

app.get('/', async function (req, res) {
    await bus.publish<TestMessage>({exchange: "test", topic: "#", message: { to: "xDDD"}})
    res.send('send')
  })


const server = http.createServer(app);

await bus.consume({exchange: "test", queue: "test", topic: "#"}, (msg: TestMessage) => {
    logger.info(`Hello ${msg.to}`)
})

server.listen(process.env.PORT ?? 3000, () => { logger.info("Server is listening") })
