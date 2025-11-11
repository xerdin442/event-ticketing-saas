import { createLogger, format, Logger, transports } from "winston";
import { Secrets } from "../env";

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, timestamp, label }) => {
  return `${timestamp} ${label} ${level} ${message}`
})

const newLogger = (env: string): Logger => {
  return createLogger({
    level: 'debug',
    format: combine(
      format.colorize(),
      label({ label: env }),
      timestamp(),
      myFormat
    ),
    transports: [
      new transports.File({ filename: 'error.log', level: 'error', dirname: './logs' }),
      new transports.File({ filename: 'combined.log', dirname: './logs' }),
      new transports.Console()
    ]
  })
}

let logger: Logger = newLogger('DEV');

if (Secrets.NODE_ENV === 'production') {
  logger = newLogger('PROD')
}
if (Secrets.NODE_ENV === 'test') {
  logger = newLogger('TEST')
}

export default logger;