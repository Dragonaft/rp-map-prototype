import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionIdChange1774881515815 implements MigrationInterface {
    name = 'ActionIdChange1774881515815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`polygon\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`polygon\` text NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`id\` \`id\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD \`id\` varchar(36) NOT NULL PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'RECRUIT', 'UPGRADE', 'TRANSFER_TROOPS') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD \`id\` int NOT NULL AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD PRIMARY KEY (\`id\`)`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`id\` \`id\` int NOT NULL AUTO_INCREMENT`);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`polygon\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`polygon\` mediumtext NOT NULL`);
    }

}
