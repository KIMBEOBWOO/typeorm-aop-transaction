import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { UserV1Service } from './user.v1.service';

@Processor('TEST_QUEUE')
export class TestJobConsumer {
  constructor(private readonly userService: UserV1Service) {}

  @Process('TEST_JOB')
  async transcode(job: Job<unknown>) {
    await this.userService.findAll();

    return job.data;
  }
}
