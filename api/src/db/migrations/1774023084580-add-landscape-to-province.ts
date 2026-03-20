import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLandscapeToProvince1774023084580 implements MigrationInterface {
    name = 'AddLandscapeToProvince1774023084580'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`polygon\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`polygon\``);
    }

}
