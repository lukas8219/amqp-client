const { Socket } = require('net');
const { ShortString, LongString, ShortInt } = require('./amqp-data-types');

const { Buffer } = require('buffer');
const { ChannelOpen } = require('./channel-frame');
const { ConnectionOpen } = require('./connection-frames');

const FRAME_SIZE_FOUR_OCTETS = 4;
const FRAME_TYPE_OCTET = 1;
const FRAME_CHANNEL_OCTET = 2;
const FRAME_HEADER_SIZE = FRAME_SIZE_FOUR_OCTETS + FRAME_TYPE_OCTET + FRAME_CHANNEL_OCTET;

function generateStartOkBuffer(){
    // Connection.StartOk frame parameters
    const clientProperties = {
        product: 'MyApp',
        version: '1.0.0',
    };

    // Convert client properties to a buffer
    let payloadBuffer = Buffer.alloc(4096);
    let byteOffset = 0;
    for(const [key,value] of Object.entries(clientProperties)){
        const keyBuffer = Buffer.from(key);
        const valueBuffer = Buffer.from(value);
        //shortstring - length + value WRITES THE FIELD NAME
        payloadBuffer.writeUint8(keyBuffer.byteLength, byteOffset); byteOffset++;
        byteOffset += payloadBuffer.write(key, byteOffset);
        
        //set field value - for now only string WRITES THE FIELD VALUE
        payloadBuffer.writeUint8('S'.charCodeAt(0), byteOffset); byteOffset++;
        payloadBuffer.writeUint32BE(valueBuffer.byteLength, byteOffset); byteOffset += 4;
        byteOffset += payloadBuffer.write(value, byteOffset);
    }

    payloadBuffer = payloadBuffer.subarray(0, byteOffset);
    
    // Calculate the correct frame size
    const frameSize = payloadBuffer.byteLength;

    // Generate the Connection.StartOk frame
    const classId = 10; // Connection.StartOk method ID
    const methodId = 11;
    const frameType = 1; // Connection.StartOk frame type -> METHOD
    const channel = 0; // For connection-level frames

    const frameBuffer = Buffer.alloc(4096); // Add 1 for the frame end marker

    let bOffset = 0;

    frameBuffer.writeUInt8(frameType, bOffset); bOffset += 1; // Frame type offset 0
    frameBuffer.writeUInt16BE(channel, bOffset); bOffset += 2 // Channel offset 1
    //RESERVE 3rd - 7th byte (4 octets) for Frame Size offset 3 - 4 octets
    bOffset += 4;
    frameBuffer.writeUInt16BE(classId, bOffset); bOffset += 2; // Method ID
    frameBuffer.writeUint16BE(methodId, bOffset); bOffset += 2;

    //Writes clientProperties table size
    frameBuffer.writeUint32BE(frameSize, bOffset); bOffset += 4;
    const clientProperiesWrittenBytes = payloadBuffer.copy(frameBuffer, bOffset, 0, byteOffset); bOffset += clientProperiesWrittenBytes;

    const mechanismFrameLength = new ShortString("PLAIN").copyTo(frameBuffer, bOffset); bOffset += mechanismFrameLength;
    const responseFrameLength = new LongString(`\u0000guest\u0000guest`).copyTo(frameBuffer, bOffset); bOffset += responseFrameLength;
    const localeFrameLength = new ShortString("en_US").copyTo(frameBuffer, bOffset); bOffset += localeFrameLength;

    frameBuffer.writeUInt32BE(bOffset - FRAME_HEADER_SIZE, 3);
    frameBuffer.writeUInt8(0xCE, bOffset);
    return  frameBuffer.subarray(0, ++bOffset);
}

function generateTuneOkFrame(channelMax, frameSizeMax, heartbeat){
    const frameType = 1; //METHOD
    const classId = 10;
    const methodId = 31; //TuneOk
    const channel = 0; //connection related communication

    const frameBuffer = Buffer.alloc(frameSizeMax);

    let frameOffset = 0;

    frameBuffer.writeUInt8(frameType, frameOffset); frameOffset += 1;
    frameBuffer.writeUInt16BE(channel, frameOffset); frameOffset += 2;
    frameOffset += 4;
    frameBuffer.writeUInt16BE(classId, frameOffset); frameOffset += 2;
    frameBuffer.writeUInt16BE(methodId, frameOffset); frameOffset += 2;

    frameBuffer.writeUInt16BE(channelMax, frameOffset); frameOffset += 2;
    frameBuffer.writeUInt32BE(frameSizeMax, frameOffset); frameOffset += 4;
    frameBuffer.writeUInt16BE(heartbeat, frameOffset); frameOffset += 2;

    frameBuffer.writeUInt32BE(frameOffset - FRAME_HEADER_SIZE, 3);

    frameBuffer.writeUInt8(0xCE, frameOffset); frameOffset++;

    return frameBuffer.subarray(0, frameOffset);
}

function generateConnectionOpenFrame(){
    return new ConnectionOpen(
        new ShortString("/"),
        new ShortInt(0),
        new ShortInt(0)
    ).getBuffer();
}

function generateChannelOpenFrame(channelId){
    return new ChannelOpen(channelId, new ShortInt(0)).getBuffer();
}

function heartbeatFrame(){
    return Buffer.from(new Uint8Array([8, 0, 0, 0, 0, 0, 0, 206]));
}

async function run(){
    const connection = new Socket();
    process.on('SIGINT', () => connection.destroy())
    connection.on('data', (data) => {
        let frameOffset = 0;
        const view = new DataView(data.buffer);
        const type = view.getUint8(frameOffset);
        const channelId = view.getUint16(frameOffset += 1);
        const frameSize = view.getUint32(frameOffset += 2);
        const frameEnd = view.getUint8((frameOffset += 4) + frameSize);

        console.log(JSON.stringify({type, channelId, frameSize, frameEnd}));

        if(frameEnd !== 206){
            throw new Error(`Frame end invalid ${frameEnd}`);
        }

        if(type === 8){
            console.log(`heartbeat`);
            return connection.write(heartbeatFrame());
        }

        if(type === 1){
            console.log(`Received Method`);
            const classId = view.getUint16(frameOffset);
            const methodId = view.getUint16(frameOffset +=  2);
            console.log(JSON.stringify({ classId, methodId }));

            if(classId === 10 && methodId === 10){
                console.log(`Received Connection#Start -> replying Connection#Start.Ok`);
                const frame = generateStartOkBuffer();
                console.log(`writing package with byteLength ${frame.byteLength}`)
                const flushed = connection.write(frame);
                if(!flushed){
                    console.error('packet was not sent')
                }
            }

            if(classId === 10 && methodId === 30){
                console.log(`Received Connection#Tune -> replying w/ Connection#TuneOk & Connection#Open`);
                const channelMax = view.getInt16(frameOffset += 2);
                const frameSizeMax = view.getInt32(frameOffset += 2);
                const heartBeat = view.getInt16(frameOffset += 4);

                console.log('server tunning parameters', JSON.stringify({ channelMax, frameSizeMax, heartBeat }));
                const responseFrame = generateTuneOkFrame(channelMax, 4096, 60 );

                const connectionOpenFrame = generateConnectionOpenFrame();

                const packetSent = connection.write(responseFrame);
                if(!packetSent){
                    console.error(`Connection#TuneOk was not sent`)
                }

                const connectionOpenPacket = connection.write(connectionOpenFrame);
                if(!connectionOpenPacket){
                    console.error(`Connection#Open was not sent`)
                }
            }

            if(classId === 10 && methodId === 41){
                console.log(`received Connection#OpenOk -> temporarily replying w/ Channel#Open`);
                const channelOpenFrame = generateChannelOpenFrame(1);
                return connection.write(channelOpenFrame);
            }

            if(classId === 10 && methodId === 50){
                console.log(`Received Connection#Close. Need to parse details`);
                connection.destroy();
            }
        }
    }); 

    connection.connect(5672, 'localhost', () => {
        console.log('connected');
        connection.write(Buffer.from(`AMQP${String.fromCharCode(0,0,9,1)}`));
    })
}

run();