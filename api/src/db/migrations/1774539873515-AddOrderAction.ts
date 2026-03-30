import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderAction1774539873515 implements MigrationInterface {
    name = 'AddOrderAction1774539873515'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`scheduledFor\` \`order\` timestamp NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP COLUMN \`order\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD \`order\` int NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` DROP COLUMN \`order\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` ADD \`order\` timestamp NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`order\` \`scheduledFor\` timestamp NOT NULL`);
    }

}
