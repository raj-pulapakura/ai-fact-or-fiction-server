import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './services/redis.service';
import { GameModule } from './modules/game/game.module';
import { RedisModule } from 'nestjs-redis'

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),

    GameModule,

  ],
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
  ],
})
export class AppModule { }
