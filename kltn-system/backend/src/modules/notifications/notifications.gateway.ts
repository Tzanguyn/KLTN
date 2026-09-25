import { ConnectedSocket, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? [], credentials: true },
})
export class NotificationsGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('join')
  join(@ConnectedSocket() socket: { join: (room: string) => void }, userId: string) {
    socket.join(`user:${userId}`);
  }

  emitToUser(userId: string, payload: unknown) {
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', payload);
    }
  }
}
