import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, HttpStatus, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@app/app.module";
import loadFixtures, { FixtureFactory } from "@test/helpers/loadFixtures";
import { Repository } from "typeorm";
import { userLogin } from "@test/helpers/userLogin";
import { Profile } from "@app/entities/profile.entity";

describe("Profiles (e2e)", () => {
  let app: INestApplication;
  let fixtures: FixtureFactory;
  let profileRepository: Repository<Profile>;
  let profile1accessToken: string;
  let profile2accessToken: string;
  let profile3accessToken: string;

  beforeAll(async () => {
    fixtures = await loadFixtures();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    profileRepository = moduleFixture.get("ProfileRepository");

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    profile1accessToken = await userLogin("profile1@email.com", "Qwert12345!", app).then(
      (res) => res.body.accessToken
    );
    profile2accessToken = await userLogin("profile2@email.com", "Qwert12345!", app).then(
      (res) => res.body.accessToken
    );
    profile3accessToken = await userLogin("profile3@email.com", "Qwert12345!", app).then(
      (res) => res.body.accessToken
    );
  });

  describe("/profiles (PATCH) - update profile's data", () => {
    it("should update profile height in database for given accessToken if height is number", async () => {
      let userId: string;
      await request
        .default(app.getHttpServer())
        .patch("/profiles")
        .set("Authorization", `Bearer ${profile1accessToken}`)
        .send({ height: 180 })
        .then((res) => {
          expect(res.status).toEqual(HttpStatus.OK);
          expect(res.body.height).toEqual(180);
          userId = res.body.userId;
        });

      return profileRepository.findOneBy({ userId }).then((profile) => {
        expect(profile.height).toEqual(180);
      });
    });

    it("should not update profile height in database for given accessToken if height is number", () => {
      return request
        .default(app.getHttpServer())
        .patch("/profiles")
        .set("Authorization", "Bearer someToken")
        .then((res) => {
          expect(res.status).toEqual(HttpStatus.UNAUTHORIZED);
        });
    });

    it("should not update profile height in database for given accessToken if height is not number", () => {
      return request
        .default(app.getHttpServer())
        .patch("/profiles")
        .set("Authorization", `Bearer ${profile2accessToken}`)
        .send({ height: "180" })
        .then((res) => {
          expect(res.status).toEqual(HttpStatus.BAD_REQUEST);
        });
    });
  });

  describe("/profiles (GET) - get profile's data", () => {
    it("should get profile height for given accessToken", () => {
      return request
        .default(app.getHttpServer())
        .get("/profiles")
        .set("Authorization", `Bearer ${profile3accessToken}`)
        .then((res) => {
          expect(res.status).toEqual(HttpStatus.OK);
          expect(res.body.height).toEqual(fixtures.get("profile3").height);
        });
    });

    it("should not get profile height for invalid accessToken", () => {
      return request
        .default(app.getHttpServer())
        .get("/profiles")
        .set("Authorization", "Bearer someToken")
        .then((res) => {
          expect(res.status).toEqual(HttpStatus.UNAUTHORIZED);
        });
    });
  });
});
