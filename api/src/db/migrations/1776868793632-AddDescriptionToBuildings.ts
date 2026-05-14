import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDescriptionToBuildings1776868793632 implements MigrationInterface {
    name = 'AddDescriptionToBuildings1776868793632'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`description\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`description\``);
    }

}
