import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionTypeColonize1778688347278 implements MigrationInterface {
    name = 'ActionTypeColonize1778688347278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND', 'ARMY_EDIT', 'COLONIZE') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND', 'ARMY_EDIT') NOT NULL`);
    }

}
