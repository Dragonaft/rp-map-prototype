import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTechEffects1783942334993 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`techs\` ADD \`effects\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`techs\` DROP COLUMN \`effects\``);
    }

}
