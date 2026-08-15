import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWaterCombatModifierToTroopTypes1784122011627 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`water_combat_modifier\` float NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`water_combat_modifier\``);
    }

}
