import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ExecutionStateEvent {
  processing: boolean;
}

/**
 * In-memory flag for "action batch is running". Single-process only; use Redis/pub-sub if you scale API horizontally.
 */
@Injectable()
export class ActionExecutionStateService implements OnModuleDestroy {
  private processing = false;
  private readonly executionSubject = new BehaviorSubject<ExecutionStateEvent>({ processing: false });

  /** Observable that emits current state on subscribe, then each state change. */
  readonly execution$: Observable<ExecutionStateEvent> = this.executionSubject.asObservable();

  beginProcessing(): void {
    this.processing = true;
    this.executionSubject.next({ processing: true });
  }

  endProcessing(): void {
    this.processing = false;
    this.executionSubject.next({ processing: false });
  }

  isProcessing(): boolean {
    return this.processing;
  }

  onModuleDestroy(): void {
    this.executionSubject.complete();
  }
}
