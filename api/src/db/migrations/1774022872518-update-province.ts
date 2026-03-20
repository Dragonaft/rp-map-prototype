import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProvince1774022872518 implements MigrationInterface {
    name = 'UpdateProvince1774022872518'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`terrain\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`type\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`landscape\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`resource_type\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`region_id\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`color\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`color\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`region_id\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`resource_type\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`landscape\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`type\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`terrain\` varchar(255) NOT NULL`);
    }

}
