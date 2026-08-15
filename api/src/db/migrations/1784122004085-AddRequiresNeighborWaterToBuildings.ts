import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequiresNeighborWaterToBuildings1784122004085 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requires_neighbor_water\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requires_neighbor_water\``);
    }

}
