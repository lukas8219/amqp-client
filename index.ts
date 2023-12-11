import { Socket } from 'net';
import { ShortString, LongString, ShortInt, LongInt, LongLongInt, Table } from './lib/amqp-data-types';
import { Buffer } from 'buffer';
import { ChannelClose, ChannelOpen } from './lib/channel-frame';
import { ConnectionOpen, ConnectionStartOk, ConnectionTuneOk } from './lib/connection-frames';
import { AMQPChannelMethod, AMQPClassesId } from './lib/base-frames';

function generateStartOkBuffer(){
    const clientProperties = {
        product: new LongString('MyApp'),
        version: new LongString('1.0.0'),
    };

    const mechanism = 'PLAIN';
    const response = `\u0000guest\u0000guest`;
    const locale = 'en_US';

    return new ConnectionStartOk(new Table(clientProperties), mechanism, response, locale).getBuffer();
}

function generateTuneOkFrame(channelMax: number, frameSizeMax: number, heartbeat: number){
    return new ConnectionTuneOk(channelMax, frameSizeMax, heartbeat).getBuffer();
}

function generateConnectionOpenFrame(){
    return new ConnectionOpen('/').getBuffer();
}

function generateChannelOpenFrame(channelId: number){
    return new ChannelOpen(channelId).getBuffer();
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
                setTimeout(() => {
                    console.log(`sending Basic.Publish`)
                    const closeBuffer = new ChannelClose(1, 404, "porque eu quis", AMQPClassesId.CHANNEL, AMQPChannelMethod.OPEN).getBuffer();
                    return connection.write(closeBuffer);
                }, 1000)
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