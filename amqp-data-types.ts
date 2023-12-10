import { Buffer } from 'node:buffer';

export interface AMQPDataType {
    copyTo(buffer: Buffer, offset: number): number;
    getBuffer(): Buffer;
}

export class ShortString implements AMQPDataType {
    private _buffer: Buffer;
    constructor(value: string){
        const valueBuffer = Buffer.from(value);
        if(valueBuffer.byteLength > 255){
            throw new Error('Invalid ShortString. Max Length in Bytes 255');
        }
        this._buffer = Buffer.alloc(1 + valueBuffer.byteLength);
        this._buffer.writeUInt8(valueBuffer.byteLength, 0);
        valueBuffer.copy(this._buffer, 1);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }
    
}

export class LongString implements AMQPDataType {
    private _buffer: Buffer;
    private _valueBuffer: Buffer;

    constructor(value: string){
        this._valueBuffer = Buffer.from(value);
        this._buffer = Buffer.alloc(4 + this._valueBuffer.byteLength);
        this._buffer.writeUInt32BE(this._valueBuffer.byteLength, 0);
        this._valueBuffer.copy(this._buffer, 4);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }
}

export class Table<T extends object> {
    constructor(record: T){}
}

export class ShortInt implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.from([this._value]);
    }

    copyTo(buffer: Buffer, offset: number): number{
        return this._buffer.copy(buffer, offset);
    }

    getBuffer() {
        return this._buffer;
    }
}

export class LongInt implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.alloc(2);
        this._buffer.writeUInt16BE(_value, 0);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }
}

export class LongLongInt implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.alloc(4);
        this._buffer.writeInt32BE(_value, 0);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }
}