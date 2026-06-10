import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVisibleCanRecruitToBuildings1781106862483 implements MigrationInterface {
    name = 'AddVisibleCanRecruitToBuildings1781106862483'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`province_building\` DROP FOREIGN KEY \`FK_province_building_building\``);
        await queryRunner.query(`ALTER TABLE \`province_building\` DROP FOREIGN KEY \`FK_province_building_province\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`visible\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`can_recruit\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND', 'ARMY_EDIT', 'COLONIZE') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`province_building\` ADD CONSTRAINT \`FK_5183db28c82ba476de9b83c177b\` FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`province_building\` ADD CONSTRAINT \`FK_cf692ef2f2d1fd817141055e10c\` FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`province_building\` DROP FOREIGN KEY \`FK_cf692ef2f2d1fd817141055e10c\``);
        await queryRunner.query(`ALTER TABLE \`province_building\` DROP FOREIGN KEY \`FK_5183db28c82ba476de9b83c177b\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND', 'ARMY_EDIT', 'COLONIZE') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`can_recruit\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`visible\``);
        await queryRunner.query(`ALTER TABLE \`province_building\` ADD CONSTRAINT \`FK_province_building_province\` FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`province_building\` ADD CONSTRAINT \`FK_province_building_building\` FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
