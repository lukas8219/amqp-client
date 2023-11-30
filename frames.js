module.exports.ConnectionStartOk = class extends DataView {

    #methodId = 11;
    #type = 1;
    #channel = 0;
    #clientProperties = { product: 'MyApp', version: '1.0.0'};

    constructor(clientProperties){
        super(new ArrayBuffer(4096));
//        this.clientProperties = clientProperties;
        this.#populate();
    }

    #populate(){
        this.setUint8(0, this.#type);
        this.setUint16(1, this.#channel);
        this.setUint16(7, this.#methodId);
        ///set client properties at 9 off-set
        const FRAME_SIZE = this.#generateClientPropertiesBuffer(9);
        this.setUint32(3, FRAME_SIZE - 4);
        this.setUint8(FRAME_SIZE, 206);

    }

    #generateClientPropertiesBuffer(byteOffset){
        const clientPropertiesBuffer = Buffer.from(JSON.stringify(this.#clientProperties), 'utf-8');

        const frameSize = clientPropertiesBuffer.length + 8;


        clientPropertiesBuffer.copy(Buffer.from(this.buffer), 9); // Copy client properties to the frame buffer

/*         const productBuffer = Buffer.from(this.#clientProperties.product);
        this.setUint8(byteOffset, productBuffer.byteLength)
        Buffer.from(this.buffer, byteOffset + 1, productBuffer.byteLength).write(this.#clientProperties.product);

        const versionBuffer = Buffer.from(this.#clientProperties.version);
        this.setUint8(byteOffset, versionBuffer.byteLength)
        Buffer.from(this.buffer, byteOffset + 2, versionBuffer.byteLength).write(this.#clientProperties.version); */

        return frameSize;
    }


    toBuffer(){
        return Buffer.from(this.buffer);
    }
}