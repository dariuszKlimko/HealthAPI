import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "@app/entities/user.entity";
import { CreateUserDto } from "@app/dtos/user/create-user.dto";
import { UserDuplicateException } from "@app/common/exceptions/user/userDuplicate.exception";
import { UserNotFoundException } from "@app/common/exceptions/userNotFound.exception";
import { UserNotVerifiedException } from "@app/common/exceptions/auth/userNotVerified.exception";
import { Profile } from "@app/entities/profile.entity";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>) {}

  async registerUser(userInfo: CreateUserDto): Promise<User> {
    const user = await this.userRepository.findOneBy({ email: userInfo.email });
    if (user) {
      throw new UserDuplicateException("user with given email address aldeady exist in database");
    }
    const userPayload = this.userRepository.create(userInfo);
    const profile = new Profile();
    userPayload.profile = profile;
    await this.userRepository.save(userPayload);
    return userPayload;
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    return user;
  }

  async deleteUser(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    await this.userRepository.delete(id);
    return user;
  }

  async checkIfEmailExist(email: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new UserNotFoundException("user with given email address not exist in database");
    }
    return user;
  }

  async checkIfEmailVerified(email: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new UserNotFoundException("user with given email address not exist in database");
    } else if (!user.verified) {
      throw new UserNotVerifiedException("user with given email is not verified");
    }
    return user;
  }
}
