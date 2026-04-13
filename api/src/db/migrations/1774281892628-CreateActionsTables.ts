import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateActionsTables1774281892628 implements MigrationInterface {
    name = 'CreateActionsTables1774281892628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`execution_locks\` (\`lockKey\` varchar(100) NOT NULL, \`lockedAt\` timestamp NOT NULL, \`lockedBy\` varchar(255) NULL, \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`lockKey\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`action_queue\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` varchar(255) NOT NULL, \`actionType\` enum ('BUILD', 'INVADE', 'RECRUIT', 'UPGRADE', 'TRANSFER_TROOPS') NOT NULL, \`actionData\` json NOT NULL, \`status\` enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRACTED') NOT NULL DEFAULT 'PENDING', \`scheduledFor\` timestamp NOT NULL, \`failureReason\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`actions_log\` (\`id\` int NOT NULL AUTO_INCREMENT, \`data\` json NOT NULL, \`timetable\` varchar(10) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD CONSTRAINT \`FK_b036b88dba641d65a416e4a7f31\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP FOREIGN KEY \`FK_b036b88dba641d65a416e4a7f31\``);
        await queryRunner.query(`DROP TABLE \`actions_log\``);
        await queryRunner.query(`DROP TABLE \`action_queue\``);
        await queryRunner.query(`DROP TABLE \`execution_locks\``);
    }

}
