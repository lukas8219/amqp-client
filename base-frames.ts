import { AMQPDataType } from "./amqp-data-types";
import { FRAME_HEADER_SIZE } from "./constants";

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

    private readonly _buffer: Buffer = Buffer.alloc(4096);
    private _currentOffset = 0;

    constructor(
        private readonly _classId: AMQPClassesId,
        private readonly _methodId: AMQPChannelMethod | AMQPConnectionMethod,
        private readonly _channel: number
    ){
        this._buffer.writeUInt8(AMQPFrameType.METHOD, this._currentOffset); this._currentOffset += 1;
        this._buffer.writeUInt16BE(_channel, this._currentOffset); this._currentOffset += 2; 
        this._currentOffset += 4;
        this._buffer.writeUInt16BE(_classId, this._currentOffset); this._currentOffset += 2;
        this._buffer.writeUInt16BE(_methodId, this._currentOffset); this._currentOffset += 2;
    }

    apply(dataType: AMQPDataType){
        this.write(dataType.getBuffer());
    }

    write(data: Buffer, offset: number = this._currentOffset){
        const copied = data.copy(this._buffer, offset)
        this._currentOffset += copied;
        return copied;
    }

    endFrame(){
        this._buffer.writeUint32BE(this._currentOffset - FRAME_HEADER_SIZE, 3);
        this._buffer.writeUint8(0xCE, this._currentOffset); this._currentOffset += 1;
    }

    getBuffer(){
        return this._buffer.subarray(0, this._currentOffset);
    }
}

