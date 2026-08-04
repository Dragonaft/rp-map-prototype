import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArmyTransferActionType1785838756498 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'UPGRADE', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_TRANSFER', 'ARMY_DISBAND', 'ARMY_EDIT', 'COLONIZE') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND', 'ARMY_EDIT', 'COLONIZE') NOT NULL`);
    }

}
