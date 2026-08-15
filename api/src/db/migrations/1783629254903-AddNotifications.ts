import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotifications1783629254903 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`notifications\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`type\` varchar(255) NOT NULL, \`severity\` varchar(255) NOT NULL DEFAULT 'info', \`title\` varchar(255) NOT NULL, \`message\` text NOT NULL, \`is_read\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_notifications_user_id\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_notifications_user\``);
        await queryRunner.query(`DROP TABLE \`notifications\``);
    }

}
