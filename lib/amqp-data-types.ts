import { Buffer } from 'node:buffer';
import { FOUR_OCTET, SINGLE_OCTET, TWO_OCTET } from './constants';

export interface AMQPDataType {
    copyTo(buffer: Buffer, offset: number): number;
    getBuffer(): Buffer;
    getDataType(): AMQPTableTypes;
}

enum AMQPTableTypes {
    SHORT_STRING = 's'.charCodeAt(0),
    LONG_STRING = 'S'.charCodeAt(0),
    SHORT_INT = 'U'.charCodeAt(0),
    LONG_INT = 'I'.charCodeAt(0),
    LONG_LONG_INT = 'L'.charCodeAt(0),
    TABLE = 'T',
    BOOLEAN = 'B'
}

export class ShortString implements AMQPDataType {
    private _buffer: Buffer;
    constructor(value: string){
        const valueBuffer = Buffer.from(value);
        if(valueBuffer.byteLength > 255){
            throw new Error('Invalid ShortString. Max Length in Bytes 255');
        }
        this._buffer = Buffer.alloc(SINGLE_OCTET + valueBuffer.byteLength);
        this._buffer.writeUInt8(valueBuffer.byteLength, 0);
        valueBuffer.copy(this._buffer, SINGLE_OCTET);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.SHORT_STRING;
    }
    
}

export class LongString implements AMQPDataType {
    private _buffer: Buffer;
    private _valueBuffer: Buffer;

    constructor(value: string){
        this._valueBuffer = Buffer.from(value);
        this._buffer = Buffer.alloc(FOUR_OCTET + this._valueBuffer.byteLength);
        this._buffer.writeUInt32BE(this._valueBuffer.byteLength, 0);
        this._valueBuffer.copy(this._buffer, 4);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.LONG_STRING;
    }
}

export class Table<T extends Record<string, AMQPDataType>> implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(record: T){
        let payloadBuffer = Buffer.alloc(4096);
        let byteOffset = 0 + FOUR_OCTET;
        //SKIP first FOUR bytes reserved for Table Size
        for(const [key,value] of Object.entries(record)){
            const fieldLength = new ShortString(key).copyTo(payloadBuffer, byteOffset); byteOffset += fieldLength;

            payloadBuffer.writeUInt8(value.getDataType() as number, byteOffset); byteOffset += SINGLE_OCTET;
            const writtenValueBytes = value.copyTo(payloadBuffer, byteOffset); byteOffset += writtenValueBytes;
        }
        //Subtract skipped 4 bytes from line 72;
        payloadBuffer.writeUInt32BE(byteOffset - FOUR_OCTET, 0);
        this._buffer = payloadBuffer.subarray(0, byteOffset);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.TABLE;
    }
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

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.SHORT_INT;
    }
}

export class LongInt implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.alloc(TWO_OCTET);
        this._buffer.writeUInt16BE(_value, 0);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.LONG_INT;
    }
}

export class LongLongInt implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.alloc(FOUR_OCTET);
        this._buffer.writeInt32BE(_value, 0);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.LONG_LONG_INT;
    }
}

export class Long64Int implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly _value: number){
        this._buffer = Buffer.alloc(FOUR_OCTET * 2);
        this._buffer.writeBigUInt64BE(BigInt(_value), 0);
    }

    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }

    getBuffer(): Buffer {
        return this._buffer;
    }

    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.LONG_LONG_INT;
    }
}

export class BooleanBit implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(value: boolean){
        this._buffer = Buffer.from([value === true ? 1 : 0]);
    }
    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer);
    }
    getBuffer(): Buffer {
        return this._buffer;
    }
    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.BOOLEAN
    }
}

export class BooleanSequence implements AMQPDataType {
    private readonly _buffer: Buffer;
    constructor(private readonly values: boolean[]){
        this._buffer = Buffer.from([values.filter(Boolean).length]);
    }
    copyTo(buffer: Buffer, offset: number): number {
        return this._buffer.copy(buffer, offset);
    }
    getBuffer(): Buffer {
        return this._buffer;
    }
    getDataType(): AMQPTableTypes {
        return AMQPTableTypes.BOOLEAN
    }
}