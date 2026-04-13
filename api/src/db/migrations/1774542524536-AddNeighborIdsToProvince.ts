import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNeighborIdsToProvince1774542524536 implements MigrationInterface {
    name = 'AddNeighborIdsToProvince1774542524536'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`neighbor_ids\` text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`neighbor_ids\``);
    }

}
