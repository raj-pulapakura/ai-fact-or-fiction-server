import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './services/redis.service';
import { GameModule } from './modules/game/game.module';
import { LlmService } from './services/llm.service';
import { QuestionsModule } from './modules/questions/questions.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),

    GameModule,
    QuestionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
    LlmService,
  ],
})
export class AppModule { }
