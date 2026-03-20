import { MigrationInterface, QueryRunner } from "typeorm";

export class Test1774020407966 implements MigrationInterface {
    name = 'Test1774020407966'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`buildings\` (\`id\` varchar(36) NOT NULL, \`type\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`income\` varchar(255) NULL, \`upkeep\` varchar(255) NULL, \`modifier\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`provinces\` (\`id\` varchar(36) NOT NULL, \`terrain\` varchar(255) NOT NULL, \`user_id\` varchar(255) NULL, \`local_troops\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`login\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`country_name\` varchar(255) NULL, \`money\` int NULL, \`troops\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`provinces_buildings\` (\`province_id\` varchar(255) NOT NULL, \`building_id\` varchar(255) NOT NULL, INDEX \`IDX_f27e7289fe30d3fe3d10cf614c\` (\`province_id\`), INDEX \`IDX_a27fc4ab16068611582c14f6dc\` (\`building_id\`), PRIMARY KEY (\`province_id\`, \`building_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD CONSTRAINT \`FK_1074b7865322644bb8a3de6b1c7\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`provinces_buildings\` ADD CONSTRAINT \`FK_f27e7289fe30d3fe3d10cf614c8\` FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`provinces_buildings\` ADD CONSTRAINT \`FK_a27fc4ab16068611582c14f6dcb\` FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces_buildings\` DROP FOREIGN KEY \`FK_a27fc4ab16068611582c14f6dcb\``);
        await queryRunner.query(`ALTER TABLE \`provinces_buildings\` DROP FOREIGN KEY \`FK_f27e7289fe30d3fe3d10cf614c8\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP FOREIGN KEY \`FK_1074b7865322644bb8a3de6b1c7\``);
        await queryRunner.query(`DROP INDEX \`IDX_a27fc4ab16068611582c14f6dc\` ON \`provinces_buildings\``);
        await queryRunner.query(`DROP INDEX \`IDX_f27e7289fe30d3fe3d10cf614c\` ON \`provinces_buildings\``);
        await queryRunner.query(`DROP TABLE \`provinces_buildings\``);
        await queryRunner.query(`DROP TABLE \`users\``);
        await queryRunner.query(`DROP TABLE \`provinces\``);
        await queryRunner.query(`DROP TABLE \`buildings\``);
    }

}
