import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { StudentsController } from './students.controller';
import { LecturersController } from './lecturers.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, StudentsController, LecturersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
