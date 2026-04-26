import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArmyModule1777211064193 implements MigrationInterface {
    name = 'AddArmyModule1777211064193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`armies\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(255) NULL, \`user_id\` varchar(255) NOT NULL, \`province_id\` varchar(255) NOT NULL, \`flat_upkeep\` int NOT NULL DEFAULT '100', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`userId\` varchar(255) NULL, \`provinceId\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`army_units\` (\`id\` varchar(36) NOT NULL, \`army_id\` varchar(255) NOT NULL, \`troop_type_id\` varchar(255) NOT NULL, \`count\` int NOT NULL DEFAULT '0', \`armyId\` varchar(255) NULL, \`troopTypeId\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`troop_types\` (\`id\` varchar(36) NOT NULL, \`key\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`category\` enum ('INFANTRY', 'RANGED', 'CAVALRY', 'SPECIAL') NOT NULL, \`cost_per_100\` int NOT NULL DEFAULT '0', \`attack\` float NOT NULL DEFAULT '1', \`defense\` float NOT NULL DEFAULT '1', \`upkeep_per_100\` int NOT NULL DEFAULT '100', \`tech_requirement\` varchar(255) NULL, \`building_requirement\` varchar(255) NULL, UNIQUE INDEX \`IDX_4b3eadb1a042c2d26898605da9\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND', 'ARMY_CREATE', 'ARMY_MOVE', 'ARMY_RECRUIT', 'ARMY_MERGE', 'ARMY_DISBAND') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_e1c4a2151663fce49e5fd3cdba5\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_3bebc86d03f3a475efa3bd8f8ea\` FOREIGN KEY (\`provinceId\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_a47b83231767658b8001bfca534\` FOREIGN KEY (\`armyId\`) REFERENCES \`armies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_53888e675b373ceaa0f78659c40\` FOREIGN KEY (\`troopTypeId\`) REFERENCES \`troop_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_53888e675b373ceaa0f78659c40\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_a47b83231767658b8001bfca534\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_3bebc86d03f3a475efa3bd8f8ea\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_e1c4a2151663fce49e5fd3cdba5\``);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH', 'REMOVE', 'DISBAND') NOT NULL`);
        await queryRunner.query(`DROP INDEX \`IDX_4b3eadb1a042c2d26898605da9\` ON \`troop_types\``);
        await queryRunner.query(`DROP TABLE \`troop_types\``);
        await queryRunner.query(`DROP TABLE \`army_units\``);
        await queryRunner.query(`DROP TABLE \`armies\``);
    }

}
