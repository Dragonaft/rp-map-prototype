import { Controller, Get } from '@nestjs/common';
import { ActionExecutionStateService } from './action-execution-state.service';

/** No JWT: clients must poll this while other routes return 503 during batch execution. */
@Controller('actions')
export class ActionExecutionStatusController {
  constructor(private readonly actionExecutionState: ActionExecutionStateService) {}

  @Get('execution-status')
  getExecutionStatus(): { processing: boolean; completedBatchSeq: number } {
    return this.actionExecutionState.getClientPayload();
  }
}
