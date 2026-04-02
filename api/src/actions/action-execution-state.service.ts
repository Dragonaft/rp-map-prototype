import { Injectable } from '@nestjs/common';

/**
 * In-memory flag for "action batch is running". Single-process only; use Redis/DB if you scale API horizontally.
 */
@Injectable()
export class ActionExecutionStateService {
  private processing = false;
  /** Increments each time a batch finishes (endProcessing). Clients poll to detect completion. */
  private completedBatchSeq = 0;

  beginProcessing(): void {
    this.processing = true;
  }

  endProcessing(): void {
    this.processing = false;
    this.completedBatchSeq += 1;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  getClientPayload(): { processing: boolean; completedBatchSeq: number } {
    return {
      processing: this.processing,
      completedBatchSeq: this.completedBatchSeq,
    };
  }
}
