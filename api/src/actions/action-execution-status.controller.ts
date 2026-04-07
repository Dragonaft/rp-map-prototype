import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ActionExecutionStateService } from './action-execution-state.service';

/** No JWT: clients connect here to receive processing state changes via SSE. */
@Controller('actions')
export class ActionExecutionStatusController {
  constructor(private readonly actionExecutionState: ActionExecutionStateService) {}

  @Sse('execution-stream')
  stream(): Observable<MessageEvent> {
    return this.actionExecutionState.execution$.pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
