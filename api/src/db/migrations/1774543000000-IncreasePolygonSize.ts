import { MigrationInterface, QueryRunner } from "typeorm";

export class IncreasePolygonSize1774543000000 implements MigrationInterface {
    name = 'IncreasePolygonSize1774543000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` MODIFY \`polygon\` MEDIUMTEXT NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` MODIFY \`polygon\` varchar(255) NOT NULL`);
    }
}
