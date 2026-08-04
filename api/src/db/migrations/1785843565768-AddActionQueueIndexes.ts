import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActionQueueIndexes1785843565768 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // `action_queue` had only its PK and the implicit FK index on `userId` — `status` and
        // `order` (the two columns every hot-path query filters/sorts by) were unindexed. Under
        // MySQL's default REPEATABLE READ, that forces cleanupExecutedActions' every-turn
        // `DELETE ... WHERE status IN (...)` and retractAction's `UPDATE ... WHERE order > :x`
        // to full-table-scan and next-key-lock rows/gaps far beyond what they actually touch,
        // which was deadlocking against concurrent `POST /actions` inserts.
        await queryRunner.query('CREATE INDEX `IDX_action_queue_order` ON `action_queue` (`order`)');
        await queryRunner.query('CREATE INDEX `IDX_action_queue_userId_status` ON `action_queue` (`userId`, `status`)');
        await queryRunner.query('CREATE INDEX `IDX_action_queue_status_order` ON `action_queue` (`status`, `order`)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX `IDX_action_queue_status_order` ON `action_queue`');
        await queryRunner.query('DROP INDEX `IDX_action_queue_userId_status` ON `action_queue`');
        await queryRunner.query('DROP INDEX `IDX_action_queue_order` ON `action_queue`');
    }

}
