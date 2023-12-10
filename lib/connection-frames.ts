import { LongInt, LongLongInt, LongString, ShortInt, ShortString, Table } from "./amqp-data-types";
import { AMQPMethodFrame, AMQPConnectionMethod, AMQPClassesId  } from "./base-frames";

export type ConnectionProperties = {
    product: LongString,
    version: LongString,
}

const DEFAULT_CONNECTION_CHANNEL = 0;

export class ConnectionStartOk extends AMQPMethodFrame {
    constructor(connectionProperties: Table<ConnectionProperties>, mechanism: string, response: string, locale: string){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.START_OK, DEFAULT_CONNECTION_CHANNEL);
        this.apply(connectionProperties);
        this.apply(new ShortString(mechanism));
        this.apply(new LongString(response));
        this.apply(new ShortString(locale));
        this.endFrame();
    }
}

export class ConnectionOpen extends AMQPMethodFrame {
    constructor(vhost: string){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.OPEN, DEFAULT_CONNECTION_CHANNEL);
        this.apply(new ShortString(vhost));
        this.apply(new ShortInt(0));
        this.apply(new ShortInt(0));
        this.endFrame();
    }
}

export class ConnectionTuneOk extends AMQPMethodFrame {
    constructor(
        private readonly _channelMax: number,
        private readonly _frameSizeMax: number,
        private readonly _heartbeat: number
    ){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.TUNE_OK, DEFAULT_CONNECTION_CHANNEL);
        this.apply(new LongInt(_channelMax));
        this.apply(new LongLongInt(_frameSizeMax));
        this.apply(new LongInt(_heartbeat));
        this.endFrame();
    }
}