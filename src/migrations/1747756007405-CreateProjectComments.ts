import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectComments1747756007405 implements MigrationInterface {
    name = 'CreateProjectComments1747756007405'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "PROJECT_COMMENTS" ("comment_id" SERIAL NOT NULL, "content" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" integer, "user_id" uuid, CONSTRAINT "PK_a077fd25064024df89668cc2576" PRIMARY KEY ("comment_id"))`);
        await queryRunner.query(`ALTER TABLE "PROJECT_COMMENTS" ADD CONSTRAINT "FK_007d7c1b3a4e03f623bf16f5e3a" FOREIGN KEY ("project_id") REFERENCES "PROJECTS"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PROJECT_COMMENTS" ADD CONSTRAINT "FK_5ecc4a9fd12afb00e2c18cd1105" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "PROJECT_COMMENTS" DROP CONSTRAINT "FK_5ecc4a9fd12afb00e2c18cd1105"`);
        await queryRunner.query(`ALTER TABLE "PROJECT_COMMENTS" DROP CONSTRAINT "FK_007d7c1b3a4e03f623bf16f5e3a"`);
        await queryRunner.query(`DROP TABLE "PROJECT_COMMENTS"`);
    }

}
