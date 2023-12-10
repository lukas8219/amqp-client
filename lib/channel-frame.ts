import { ShortInt } from "./amqp-data-types";
import { AMQPChannelMethod, AMQPClassesId, AMQPMethodFrame } from "./base-frames";

export class ChannelOpen extends AMQPMethodFrame {
    constructor(private readonly channelId: number, private readonly reservedOne: ShortInt){
        super(AMQPClassesId.CHANNEL, AMQPChannelMethod.OPEN, channelId);
        this.apply(reservedOne);
        this.endFrame();
    }
}