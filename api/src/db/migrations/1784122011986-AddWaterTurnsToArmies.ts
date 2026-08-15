import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWaterTurnsToArmies1784122011986 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`armies\` ADD \`water_turns\` int NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`armies\` DROP COLUMN \`water_turns\``);
    }

}
