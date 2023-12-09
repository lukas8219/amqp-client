export enum AMQPClassesId {
    CONNECTION = 10,
    CHANNEL = 20,
}

export enum AMQPConnectionMethod {
    START = 10,
    START_OK = 11,
    TUNE = 30,
    TUNE_OK = 31,
    OPEN = 40,
    OPEN_OK = 41,
    CLOSE = 50,
}

export enum AMQPChannelMethod {
    OPEN = 10,
    OPEN_OK = 11,
}

export enum AMQPFrameType {
    METHOD = 1,
    HEARTBEAT = 8,
}

export class AMQPMethodFrame {
    constructor(
        private readonly _classId: AMQPClassesId,
        private readonly _methodId: AMQPChannelMethod | AMQPConnectionMethod,
        private readonly _channel: number
    ){}
}

