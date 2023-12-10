import { Socket } from "net";
import { AMQPChannelMethod, AMQPClassesId, ProtocolFrame } from "./lib/base-frames";
import EventEmitter, { once } from "events";
import { ConnectionOpen, ConnectionStartOk, ConnectionTuneOk } from "./lib/connection-frames";
import { LongString, Table } from "./lib/amqp-data-types";
import { ChannelClose, ChannelOpen } from "./lib/channel-frame";

async function createConnection(uri: string, options: any = {}): Promise<AMQPClient> {
    const sock = new Socket();
    return new Promise((resolve, reject) => {
        sock.on('error', reject);
        sock.on('close', reject);
        sock.connect(5672, 'localhost', () => {
            console.log(`Connected`);
            const client = new AMQPClient(sock);
            return client.connect().then(resolve);
        })
    })
}

class AMQPClient {
    private readonly __channels = [];
    private readonly __framesEmitter = new EventEmitter();

    constructor(private readonly _socket: Socket){
        this._recvFrames();
    }

    async connect(){
        const protocolFrame = new ProtocolFrame();
        this._socket.write(protocolFrame.getBuffer());
        await once(this.__framesEmitter, 'Connection#Start');
        this._socket.write(this._createConnectionStartOkFrame());
        const [{ frameSizeMax, channelMax, heartbeat }] = await once(this.__framesEmitter, 'Connection#Tune');
        this._socket.write(new ConnectionTuneOk(channelMax, frameSizeMax, heartbeat).getBuffer());
        this._socket.write(new ConnectionOpen("/").getBuffer());
        await once(this.__framesEmitter, 'Connection#OpenOk');
        return this;
    }

    _createConnectionStartOkFrame(){
        const clientProperties = {
            product: new LongString('MyApp'),
            version: new LongString('1.0.0'),
        };
    
        const mechanism = 'PLAIN';
        const response = `\u0000guest\u0000guest`;
        const locale = 'en_US';
    
        return new ConnectionStartOk(new Table(clientProperties), mechanism, response, locale).getBuffer();
    }

    _recvFrames(){
        this._socket.on('data', (data) => {
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
                return this._socket.write(Buffer.from(new Uint8Array([8, 0, 0, 0, 0, 0, 0, 206])));
            }
    
            if(type === 1){
                console.log(`Received Method`);
                const classId = view.getUint16(frameOffset);
                const methodId = view.getUint16(frameOffset +=  2);
                console.log(JSON.stringify({ classId, methodId }));
    
                if(classId === 10 && methodId === 10){
                    console.log(`Received Connection#Start`);
                    this.__framesEmitter.emit('Connection#Start');
                }

                if(classId === 10 && methodId === 30){
                    console.log(`Received Connection#Tune`);
                    const channelMax = view.getInt16(frameOffset += 2);
                    const frameSizeMax = view.getInt32(frameOffset += 2);
                    const heartBeat = view.getInt16(frameOffset += 4);
                    console.log('server tunning parameters', JSON.stringify({ channelMax, frameSizeMax, heartBeat }));

                    this.__framesEmitter.emit('Connection#Tune', { channelMax, frameSizeMax, heartBeat });
                }

                if(classId === 10 && methodId === 41){
                    console.log(`Received Connection#OpenOk`);
                    this.__framesEmitter.emit('Connection#OpenOk');
                }

                if(classId === 20 && methodId == 41){
                    console.log(`Received Channel#CloseOk`);
                    this.__framesEmitter.emit('Channel#CloseOk');
                }

                if(classId === 20 && methodId === 11){
                    this.__framesEmitter.emit('Channel#OpenOk');
                }
            }
        });
    }

    async createChannel(){
        this._socket.write(new ChannelOpen(this.__channels.length + 1).getBuffer());
        await once(this.__framesEmitter, 'Channel#OpenOk');
        return new AMQPChannel(this.__channels.length + 1, this._socket, this.__framesEmitter);
    }
}

class AMQPChannel {
    constructor(
        private readonly _channelId: number,
        private readonly _sock: Socket,
        private readonly __frameEmitter: EventEmitter,
    ){}

    async close(){
        this._sock.write(new ChannelClose(this._channelId, 200, "Client closed connection", AMQPClassesId.CHANNEL, AMQPChannelMethod.CLOSE).getBuffer());
        await once(this.__frameEmitter, 'Channel#CloseOk');
    }
}

const client = await createConnection('amqp://localhost:5672');
const channel = await client.createChannel();