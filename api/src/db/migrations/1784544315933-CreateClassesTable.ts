import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClassesTable1784544315933 implements MigrationInterface {
    name = 'CreateClassesTable1784544315933'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`classes\` (
                \`id\` varchar(36) NOT NULL,
                \`key\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`is_visible\` tinyint NOT NULL DEFAULT 1,
                UNIQUE INDEX \`IDX_classes_key\` (\`key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Seed the canonical classes — their `key` must stay equal to the matching
        // Tech.branch string, since that coupling (TechsService, CLASS_RESTRICTED_TROOPS)
        // is pure string equality, not an FK. api/src/scripts/seed-classes.ts is the
        // ongoing source of truth after this.
        await queryRunner.query(`
            INSERT INTO \`classes\` (\`id\`, \`key\`, \`name\`, \`is_visible\`) VALUES
                (UUID(), 'noble', 'Noble', 1),
                (UUID(), 'holy', 'Holy', 1),
                (UUID(), 'guild', 'Guild', 1)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`classes\``);
    }

}
