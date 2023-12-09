import { LongString, ShortString, Table } from "./amqp-data-types";
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