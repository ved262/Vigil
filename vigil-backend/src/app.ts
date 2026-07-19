import express, { Application } from "express";
import helmet from "helmet";
import { config } from "./config/index.js";
import cors from 'cors'
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { generateRequestId } from "./utils/requestId.js";
import { logger } from "./utils/logger.js"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp(): Application {
    const app = express();
    app.use(helmet());
    app.use(cors({
        origin: config.CORS_ORIGIN,
        credentials: true
    }))
    app.use(express.json());
    app.use(cookieParser());

    app.use(
        pinoHttp({
            logger,
            genReqId: generateRequestId,
            customLogLevel: (req,res,err) => {
                if(err || res.statusCode >= 500) return 'error';
                else if( res.statusCode >= 400) return 'warn';
                return 'info';
            }
        })
    )

    app.get('/api/health', (req,res)=>{
        res.status(200).json({
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            version: config.APP_VERSION,
            environment: config.NODE_ENV
        })
    })

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}