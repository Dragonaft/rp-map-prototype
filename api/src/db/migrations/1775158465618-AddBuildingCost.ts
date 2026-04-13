import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBuildingCost1775158465618 implements MigrationInterface {
    name = 'AddBuildingCost1775158465618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop FK constraint first (if it exists), then drop the index (MySQL won't drop an FK-backing index directly)
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP FOREIGN KEY \`FK_1074b7865322644bb8a3de6b1c7\``).catch(() => {});
        await queryRunner.query(`DROP INDEX \`FK_1074b7865322644bb8a3de6b1c7\` ON \`provinces\``).catch(() => {});
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`cost\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD CONSTRAINT \`FK_1074b7865322644bb8a3de6b1c7\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP FOREIGN KEY \`FK_1074b7865322644bb8a3de6b1c7\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`cost\``);
        await queryRunner.query(`CREATE INDEX \`FK_1074b7865322644bb8a3de6b1c7\` ON \`provinces\` (\`user_id\`)`);
    }

}
