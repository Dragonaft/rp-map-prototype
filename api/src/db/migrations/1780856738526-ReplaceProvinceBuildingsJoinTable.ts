import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceProvinceBuildingsJoinTable1780856738526 implements MigrationInterface {
    name = 'ReplaceProvinceBuildingsJoinTable1780856738526'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the new province_building table
        await queryRunner.query(`
            CREATE TABLE \`province_building\` (
                                                   \`id\` varchar(36) NOT NULL,
                                                   \`province_id\` varchar(255) NOT NULL,
                                                   \`building_id\` varchar(255) NOT NULL,
                                                   PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // 2. Copy existing data from the join table, generating UUIDs
        await queryRunner.query(`
            INSERT INTO \`province_building\` (\`id\`, \`province_id\`, \`building_id\`)
            SELECT UUID(), \`province_id\`, \`building_id\`
            FROM \`provinces_buildings\`
        `);

        // 3. Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE \`province_building\`
                ADD CONSTRAINT \`FK_province_building_province\`
                    FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`province_building\`
            ADD CONSTRAINT \`FK_province_building_building\`
            FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON DELETE CASCADE
        `);

        // 4. Drop the old join table
        await queryRunner.query(`DROP TABLE \`provinces_buildings\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Recreate the old join table
        await queryRunner.query(`
            CREATE TABLE \`provinces_buildings\` (
                                                     \`province_id\` varchar(255) NOT NULL,
                                                     \`building_id\` varchar(255) NOT NULL,
                                                     PRIMARY KEY (\`province_id\`, \`building_id\`),
                                                     CONSTRAINT \`FK_pb_province\` FOREIGN KEY (\`province_id\`) REFERENCES \`provinces\`(\`id\`) ON DELETE CASCADE,
                                                     CONSTRAINT \`FK_pb_building\` FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 2. Copy data back (deduplicate since new table allows duplicates)
        await queryRunner.query(`
            INSERT IGNORE INTO \`provinces_buildings\` (\`province_id\`, \`building_id\`)
            SELECT \`province_id\`, \`building_id\`
            FROM \`province_building\`
        `);

        // 3. Drop the new table
        await queryRunner.query(`DROP TABLE \`province_building\``);
    }
}
