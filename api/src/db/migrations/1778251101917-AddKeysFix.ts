import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKeysFix1778251101917 implements MigrationInterface {
    name = 'AddKeysFix1778251101917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_3bebc86d03f3a475efa3bd8f8ea\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_e1c4a2151663fce49e5fd3cdba5\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_53888e675b373ceaa0f78659c40\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_a47b83231767658b8001bfca534\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP COLUMN \`provinceId\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP COLUMN \`armyId\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP COLUMN \`troopTypeId\``);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_5e028c8b12e7d655759206d991f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_9eb602169ae9eb8f70f7cec9db9\` FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_4f223ac4531eac4da94fcb4ea3a\` FOREIGN KEY (\`army_id\`) REFERENCES \`armies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_4298e909190c8d475c65c3c14af\` FOREIGN KEY (\`troop_type_id\`) REFERENCES \`troop_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_4298e909190c8d475c65c3c14af\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` DROP FOREIGN KEY \`FK_4f223ac4531eac4da94fcb4ea3a\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_9eb602169ae9eb8f70f7cec9db9\``);
        await queryRunner.query(`ALTER TABLE \`armies\` DROP FOREIGN KEY \`FK_5e028c8b12e7d655759206d991f\``);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD \`troopTypeId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD \`armyId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD \`userId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD \`provinceId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_a47b83231767658b8001bfca534\` FOREIGN KEY (\`armyId\`) REFERENCES \`armies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`army_units\` ADD CONSTRAINT \`FK_53888e675b373ceaa0f78659c40\` FOREIGN KEY (\`troopTypeId\`) REFERENCES \`troop_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_e1c4a2151663fce49e5fd3cdba5\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`armies\` ADD CONSTRAINT \`FK_3bebc86d03f3a475efa3bd8f8ea\` FOREIGN KEY (\`provinceId\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
