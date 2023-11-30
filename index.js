const { Socket } = require('net');
const { ConnectionStartOk } = require('./frames');

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
    frameBuffer.writeUInt16BE(classId, 7); // Method ID
    frameBuffer.writeUint16BE(methodId, 7+2);

    const argumentsLengthByteOffset = 7 + 2 + 1 + 1;

    frameBuffer.writeUint32BE(frameSize, argumentsLengthByteOffset);

    payloadBuffer.copy(frameBuffer, argumentsLengthByteOffset + 4, 0, byteOffset);

    let currentByteOffset = frameSize + argumentsLengthByteOffset + 4;

    //PLAIN shortstring
    const mechanismBuffer = Buffer.from("PLAIN");
    frameBuffer.writeUint8(mechanismBuffer.byteLength, currentByteOffset);
    currentByteOffset += frameBuffer.write("PLAIN", ++currentByteOffset);

    //006775657374006775657374
    const responseBuffer = Buffer.from(`\u0000guest\u0000guest`);
    frameBuffer.writeUint32BE(responseBuffer.byteLength, ++currentByteOffset); currentByteOffset += 4;
    currentByteOffset += frameBuffer.write(`\u0000guest\u0000guest`, currentByteOffset);

    const localeBuffer = Buffer.from("en_US");
    frameBuffer.writeUint8(localeBuffer.byteLength, currentByteOffset);
    currentByteOffset += frameBuffer.write("en_US", ++currentByteOffset);

    frameBuffer.writeUInt8(0xCE, ++currentByteOffset); // Frame end marker

    frameBuffer.writeUInt32BE(
        frameSize + 2
        + mechanismBuffer.byteLength
        + 4
        + responseBuffer.byteLength
        + 2
        + localeBuffer.byteLength
        + 2
        + 4, 3); // Payload size excluding the method ID (4 bytes)

    const finalBuffer = frameBuffer.subarray(0, ++currentByteOffset);

    return  finalBuffer;
}

async function run(){
    const connection = new Socket();
    process.on('SIGINT', () => connection.destroy())
    connection.on('data', (data) => {
        const view = new DataView(data.buffer);
        const type = view.getUint8(0);
        const channelId = view.getUint16(1);
        const frameSize = view.getUint32(3);
        const frameEnd = view.getUint8(7 + frameSize)
        console.log(type, channelId, frameSize, frameEnd);

        if(frameEnd !== 206){
            throw new Error('Frame end invalid');
        }

        if(type === 1){
            const classId = view.getUint16(7);
            const methodId = view.getUint16(7 + 2);
            console.log(classId, methodId);
            if(classId === 10 && methodId === 10){
                console.log(`Received Connection#Start -> replying Connection#Start.Ok`);
//                connection.write(frameBuffer);
                const frame = generateStartOkBuffer();
//                const frame = new ConnectionStartOk().toBuffer();
                console.log(`writing package with byteLength ${frame.byteLength}`)
                const flushed = connection.write(frame);
                if(!flushed){
                    console.error('packet was not sent')
                }
            }   
        }
    }); 

    connection.connect(5672, 'localhost', () => {
        console.log('connected');
        connection.write(Buffer.from(`AMQP${String.fromCharCode(0,0,9,1)}`));
    })
}

run();