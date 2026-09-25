import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('joinTopic')
  joinTopic(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: string | { topicId: string },
  ) {
    const topicId = typeof payload === 'string' ? payload : payload?.topicId;
    if (topicId) {
      socket.join(`topic:${topicId}`);
    }
  }

  @SubscribeMessage('leaveTopic')
  leaveTopic(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: string | { topicId: string },
  ) {
    const topicId = typeof payload === 'string' ? payload : payload?.topicId;
    if (topicId) {
      socket.leave(`topic:${topicId}`);
    }
  }

  @SubscribeMessage('joinGroup')
  joinGroup(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: string | { groupId: string },
  ) {
    const groupId = typeof payload === 'string' ? payload : payload?.groupId;
    if (groupId) {
      socket.join(`group:${groupId}`);
    }
  }

  @SubscribeMessage('leaveGroup')
  leaveGroup(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: string | { groupId: string },
  ) {
    const groupId = typeof payload === 'string' ? payload : payload?.groupId;
    if (groupId) {
      socket.leave(`group:${groupId}`);
    }
  }

  emitToTopic(topicId: string, message: unknown) {
    if (this.server) {
      this.server.to(`topic:${topicId}`).emit('message', message);
      this.server.to(`topic:${topicId}`).emit('new_message', message);
    }
  }

  emitToGroup(groupId: string, message: unknown) {
    if (this.server) {
      this.server.to(`group:${groupId}`).emit('message', message);
      this.server.to(`group:${groupId}`).emit('new_message', message);
    }
  }
}
