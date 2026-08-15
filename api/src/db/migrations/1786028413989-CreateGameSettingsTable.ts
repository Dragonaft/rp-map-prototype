import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGameSettingsTable1786028413989 implements MigrationInterface {
    name = 'CreateGameSettingsTable1786028413989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`game_settings\` (
                \`id\` varchar(255) NOT NULL,
                \`is_paused\` tinyint NOT NULL DEFAULT 0,
                \`pause_message\` varchar(255) NULL,
                \`turns_enabled\` tinyint NOT NULL DEFAULT 1,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Singleton row — the table only ever has this one id = 'global' record,
        // see GameSettingsService for the get-or-create logic that keeps it that way.
        await queryRunner.query(`
            INSERT INTO \`game_settings\` (\`id\`, \`is_paused\`, \`pause_message\`, \`turns_enabled\`) VALUES
                ('global', 0, NULL, 1)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`game_settings\``);
    }

}
