import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsNpcToUsers1784467842069 implements MigrationInterface {
    name = 'AddIsNpcToUsers1784467842069'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`is_npc\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`is_npc\``);
    }

}
