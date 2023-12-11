import { BooleanBit, BooleanSequence, LongInt, ShortInt, ShortString } from "./amqp-data-types";
import { AMQPBasicMethod, AMQPClassesId, AMQPMethodFrame } from "./base-frames";

export class BasicPublish extends AMQPMethodFrame{
    constructor(
        _channelId: number,
        exchange: string,
        routingKey: string,
        mandatory: boolean,
        immediate: boolean,
    ){
        super(AMQPClassesId.BASIC, AMQPBasicMethod.PUBLISH, _channelId);
        this.apply(new LongInt(0));
        this.apply(new ShortString(exchange));
        this.apply(new ShortString(routingKey));
        this.apply(new BooleanSequence([mandatory, immediate]));
        this.endFrame();
    }
}