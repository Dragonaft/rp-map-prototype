import { IsEnum, IsObject } from 'class-validator';
import { ActionType } from '../entities/action-queue.entity';

/**
 * Envelope for POST /actions. The global ValidationPipe rejects unknown action
 * types and non-object payloads here; the per-type shape of `actionData` is
 * validated in ActionsService.validateActionPayload (it varies by action type).
 */
export class CreateActionDto {
  @IsEnum(ActionType)
  type: ActionType;

  @IsObject()
  actionData: Record<string, any>;
}
