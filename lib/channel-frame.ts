import { LongInt, ShortInt, ShortString } from "./amqp-data-types";
import { AMQPChannelMethod, AMQPClassesId, AMQPMethodFrame } from "./base-frames";

export class ChannelOpen extends AMQPMethodFrame {
    constructor(private readonly channelId: number){
        super(AMQPClassesId.CHANNEL, AMQPChannelMethod.OPEN, channelId);
        this.apply(new ShortInt(0));
        this.endFrame();
    }
}

export class ChannelClose extends AMQPMethodFrame {
    constructor(
        _channelId: number,
        private readonly replyCode: number,
        private readonly replyText: string,
        private readonly classId: AMQPClassesId,
        private readonly methodId: AMQPChannelMethod,
    ){
        super(AMQPClassesId.CHANNEL, AMQPChannelMethod.CLOSE, _channelId);
        this.apply(new LongInt(replyCode));
        this.apply(new ShortString(replyText));
        this.apply(new LongInt(classId));
        this.apply(new LongInt(methodId));
        this.endFrame();
    }
}