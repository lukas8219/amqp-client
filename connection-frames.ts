import { LongInt, LongLongInt, LongString, ShortInt, ShortString, Table } from "./amqp-data-types";
import { AMQPMethodFrame, AMQPConnectionMethod, AMQPClassesId  } from "./base-frames";

export type ConnectionProperties = {
    product: string,
    version: string,
}

const DEFAULT_CONNECTION_CHANNEL = 0;

export class ConnectionStartOk extends AMQPMethodFrame {
    constructor(connectionProperties: Table<ConnectionProperties>, mechanism: ShortString, response: LongString, locale: ShortString){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.START_OK, DEFAULT_CONNECTION_CHANNEL);
    }
}

export class ConnectionOpen extends AMQPMethodFrame {
    constructor(vhost: ShortString, reservedOne: ShortInt, reservedTwo: ShortInt){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.OPEN, DEFAULT_CONNECTION_CHANNEL);
        this.apply(vhost);
        this.apply(reservedOne);
        this.apply(reservedTwo);
        this.endFrame();
    }
}

export class ConnectionTuneOk extends AMQPMethodFrame {
    constructor(
        private readonly _channelMax: LongInt,
        private readonly _frameSizeMax: LongLongInt,
        private readonly _heartbeat: LongInt
    ){
        super(AMQPClassesId.CONNECTION, AMQPConnectionMethod.TUNE_OK, DEFAULT_CONNECTION_CHANNEL);
        this.apply(_channelMax);
        this.apply(_frameSizeMax);
        this.apply(_heartbeat);
        this.endFrame();
    }
}