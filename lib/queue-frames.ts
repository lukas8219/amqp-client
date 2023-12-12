import { BooleanSequence, LongInt, ShortInt, ShortString, Table } from "./amqp-data-types";
import { AMQPClassesId, AMQPMethodFrame, AMQPQueueMethod } from "./base-frames";

export type QueueArgs = any;

export class QueueDeclare extends AMQPMethodFrame {
    constructor(_channelId: number, queueName: string, passive: boolean, durable: boolean, exclusive: boolean, autoDelete: boolean, queueArgs: QueueArgs){
        super(AMQPClassesId.QUEUE, AMQPQueueMethod.DECLARE, _channelId);
        this.apply(new LongInt(0));
        this.apply(new ShortString(queueName));
        //Revisit BitSequence
        this.apply(new BooleanSequence(([
            passive,
            durable,
            exclusive,
            autoDelete,
            false
        ])));
        this.apply(new Table(queueArgs));
        this.endFrame();
    }
}