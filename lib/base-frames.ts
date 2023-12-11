import { AMQPDataType, Long64Int, LongInt, LongLongInt, ShortInt, Table } from "./amqp-data-types";
import { FOUR_OCTET, FRAME_HEADER_SIZE, FRAME_SIZE_OFFSET, SINGLE_OCTET, TWO_OCTET } from "./constants";

export enum AMQPClassesId {
    CONNECTION = 10,
    CHANNEL = 20,
    BASIC = 60,
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
    CLOSE = 40,
}

export enum AMQPBasicMethod {
    PUBLISH = 40,
}

export enum AMQPFrameType {
    METHOD = 1,
    CONTENT_HEADER = 2,
    CONTENT_BODY = 3,
    HEARTBEAT = 8,
}

class AMQPFrame {
    protected readonly _buffer: Buffer = Buffer.alloc(4096);
    protected _currentOffset = 0;

    constructor(private _methodType: AMQPFrameType, private _channelId: number){
        this._buffer.writeUint8(_methodType, this._currentOffset); this._currentOffset += SINGLE_OCTET;
        this._buffer.writeUInt16BE(_channelId, this._currentOffset); this._currentOffset += TWO_OCTET;
        this._currentOffset += 4;
    }

    apply(dataType: AMQPDataType){
        this.write(dataType.getBuffer());
    }

    write(data: Buffer, offset: number = this._currentOffset){
        if(!data.length){
            return 0;
        }
        const copied = data.copy(this._buffer, offset)
        this._currentOffset += copied;
        return copied;
    }

    endFrame(){
        this._buffer.writeUint32BE(this._currentOffset - FRAME_HEADER_SIZE, FRAME_SIZE_OFFSET);
        this._buffer.writeUint8(0xCE, this._currentOffset); this._currentOffset += SINGLE_OCTET;
    }

    getBuffer(){
        return this._buffer.subarray(0, this._currentOffset);
    }
}

export class AMQPMethodFrame extends AMQPFrame {

    constructor(
        private readonly _classId: AMQPClassesId,
        private readonly _methodId: AMQPChannelMethod | AMQPConnectionMethod | AMQPBasicMethod,
        private readonly _channel: number
    ){
        super(AMQPFrameType.METHOD, _channel);
        this._buffer.writeUInt16BE(_classId, this._currentOffset); this._currentOffset += TWO_OCTET;
        this._buffer.writeUInt16BE(_methodId, this._currentOffset); this._currentOffset += TWO_OCTET;
    }
}

export class AMQPContentHeaderFrame<T extends Record<string, AMQPDataType>> extends AMQPFrame {
    constructor(private _channel: number, payloadSize: number, propertyFlag: number, headers: Table<T>){
        super(AMQPFrameType.CONTENT_HEADER, _channel);
        this._buffer.writeUInt16BE(AMQPClassesId.BASIC, this._currentOffset); this._currentOffset += TWO_OCTET;
        this.apply(new LongInt(0));
        this.apply(new Long64Int(payloadSize));
        this.apply(new ShortInt(2000));
        this.apply(headers);
        this.endFrame();
    }
}

export class AMQPContentBodyFrame extends AMQPFrame {
    constructor(private _channel: number, data: Buffer){
        super(AMQPFrameType.CONTENT_BODY, _channel);
        this.write(data);
        this.endFrame(data.byteLength);
    }

    endFrame(payloadSize: number = this._currentOffset){
        this._buffer.writeUInt32BE(payloadSize, 3);
        this._buffer.writeUint8(0xCE, this._currentOffset); this._currentOffset++;
    }
}


export class ProtocolFrame {
    private readonly _buffer: Buffer;
    constructor(){
        this._buffer = Buffer.from(`AMQP${String.fromCharCode(0,0,9,1)}`);
    }

    getBuffer(){
        return this._buffer;
    }
}