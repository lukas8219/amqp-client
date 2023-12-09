const { Socket } = require('net');
const { ShortString, LongString } = require('./amqp-data-types');

const { Buffer } = require('buffer');

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
    frameBuffer.writeUInt8(frameType, 0); // Frame type
    frameBuffer.writeUInt16BE(channel, 1); // Channel

    //RESERVER 3rd byte (1 octets) for Frame Size = 3
    frameBuffer.writeUInt16BE(classId, 7); // Method ID
    frameBuffer.writeUint16BE(methodId, 7 + 2);

    const argumentsLengthByteOffset = 7 + 2 + 1 + 1;

    frameBuffer.writeUint32BE(frameSize, argumentsLengthByteOffset);

    payloadBuffer.copy(frameBuffer, argumentsLengthByteOffset + 4, 0, byteOffset);

    let currentByteOffset = frameSize + argumentsLengthByteOffset + 4;

    const mechanismFrameLength = new ShortString("PLAIN").copyTo(frameBuffer, currentByteOffset); currentByteOffset += mechanismFrameLength;
    const responseFrameLength = new LongString(`\u0000guest\u0000guest`).copyTo(frameBuffer, ++currentByteOffset); currentByteOffset += responseFrameLength;
    const localeFrameLength = new ShortString("en_US").copyTo(frameBuffer, currentByteOffset); currentByteOffset += localeFrameLength;

    frameBuffer.writeUInt8(0xCE, ++currentByteOffset); // Frame end marker

    frameBuffer.writeUInt32BE(currentByteOffset - 7, 3); //TODO understand why - 7. Probably some miscalc up there

    return  frameBuffer.subarray(0, ++currentByteOffset);
}

function generateTuneOkFrame(channelMax, frameSizeMax, heartbeat){
    const frameType = 1; //METHOD
    const classId = 10;
    const methodId = 31; //TuneOk
    const channel = 0; //connection related communication

    const frameBuffer = Buffer.alloc(frameSizeMax);

    let frameOffset = 0;

    frameBuffer.writeUInt8(frameType, frameOffset); // Frame type
    frameBuffer.writeUInt16BE(channel, frameOffset += 1); // Channel
    frameBuffer.writeUInt16BE(classId, frameOffset += (4+2)); // Method ID
    frameBuffer.writeUInt16BE(methodId, frameOffset += 2);

    frameBuffer.writeUInt16BE(channelMax, frameOffset += 2);
    frameBuffer.writeUInt32BE(frameSizeMax, frameOffset += 2);
    frameBuffer.writeUInt16BE(heartbeat, frameOffset += 4);

    frameBuffer.writeUInt32BE(frameOffset - 4 - 1, 3);

    frameBuffer.writeUInt8(0xCE, frameOffset += 2); frameOffset++;

    return frameBuffer.subarray(0, frameOffset);
}

function generateConnectionOpenFrame(){
    const frameType = 1;
    const classId = 10;
    const methodId = 40; //TuneOk
    const channel = 0; //connection related communication

    const frameBuffer = Buffer.alloc(4096);

    let frameOffset = 0;

    frameBuffer.writeUInt8(frameType, frameOffset); // Frame type
    frameBuffer.writeUInt16BE(channel, frameOffset += 1); // Channel
    frameBuffer.writeUInt16BE(classId, frameOffset += (4+2)); // ClassID
    frameBuffer.writeUInt16BE(methodId, frameOffset += 2);
    
    const vhostFrameLength = new ShortString("/").copyTo(frameBuffer, frameOffset += 2);
    frameOffset += vhostFrameLength;

    //SKIP Reserverd Bytes - two octets (8 bytes)
    frameOffset += 1 + 1;
    
    frameBuffer.writeUint32BE(frameOffset - 4 - 2, 3);
    frameBuffer.writeUInt8(0xCE, frameOffset += 1);

    return frameBuffer.subarray(0, ++frameOffset);
}

function generateChannelOpenFrame(channelId){
    const frameType = 1;
    const classId = 20;
    const methodId = 10; //Open
    const channel = channelId; //connection related communication

    const frameBuffer = Buffer.alloc(4096);

    let frameOffset = 0;

    frameBuffer.writeUInt8(frameType, frameOffset); // Frame type
    frameBuffer.writeUInt16BE(channel, frameOffset += 1); // Channel
    frameBuffer.writeUInt16BE(classId, frameOffset += (4+2)); // ClassID
    frameBuffer.writeUInt16BE(methodId, frameOffset += 2);

    frameBuffer.writeUInt8(0, frameOffset += 2);
    ++frameOffset;

    frameBuffer.writeUInt32BE(5, 3);
    frameBuffer.writeUInt8(0xCE, frameOffset);
    return frameBuffer.subarray(0, ++frameOffset);
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