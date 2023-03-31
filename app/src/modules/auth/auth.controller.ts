import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AuthService } from "@app/modules/auth/auth.service";
import { CurrentUser } from "@app/common/decorators/currentUser.decorator";
import { HttpExceptionFilter } from "@app/common/filter/HttpException.filter";
import { LoginResponse } from "@app/modules/auth/types/login-response";
import { UserNotFoundException } from "@app/common/exceptions/userNotFound.exception";
import { UserAuthenticateException } from "@app/modules/auth/exceptions/userAuthenticate.exception";
import { UserNotVerifiedException } from "@app/modules/auth/exceptions/userNotVerified.exception";
import { MessageInfo } from "@app/common/types/messageInfo";
import { JwtAuthGuard } from "@app/common/guards/jwt-auth.guard";
import { InvalidRefreshTokenException } from "@app/modules/auth/exceptions/invalidRefreshToken.exception";
import { CurrentUserDecorator } from "@app/common/types/currentUserDecorator";
import { LogoutResponse } from "@app/modules/auth/types/logout-response";
import { TokenDto } from "@app/modules/auth/dto/token.dto";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { LoginDto } from "@app/modules/auth/dto/login.dto";
import { EmailDto } from "@app/modules/auth/dto/email.dto";
import { EmailService } from "@app/modules/email/email.service";
import { UsersService } from "@app/modules/user/user.service";
import { UserAlreadyConfirmedException } from "@app/modules/auth/exceptions/userAlreadyConfirmed.exception";
import { User } from "../user/entities/user.entity";
import { UpdateCredentialsDto } from "./dto/update-creadentials.dto";

@ApiTags("auth")
@UseFilters(HttpExceptionFilter)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService
  ) {}

  @ApiOperation({ summary: "account confirmation" })
  @ApiResponse({ status: 200, type: MessageInfo, description: "user has been successfully verified" })
  @Get("confirmation/:token")
  async userConfirmation(@Param("token") token: string): Promise<MessageInfo> {
    try {
      const email = await this.authService.decodeConfirmationToken(token);
      return await this.authService.userConfirmation(email);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof UserAlreadyConfirmedException) {
        throw new BadRequestException(error.message);
      } else if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "user registration" })
  @ApiResponse({ status: 201, type: MessageInfo, description: "confirmation email has been resend" })
  @UsePipes(ValidationPipe)
  @Post("resend-confirmation")
  async resendConfirmationLink(@Body() userInfo: EmailDto): Promise<MessageInfo> {
    try {
      const user = await this.usersService.getUserByEmail(userInfo.email);
      await this.emailService.sendEmail(user.email);
      return { status: "ok", message: "confirmation email has been resend" };
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "user login" })
  @ApiResponse({ status: 201, type: LoginResponse, description: "user has been successfully logged in" })
  @UsePipes(ValidationPipe)
  @Post()
  async login(@Body() user: LoginDto): Promise<LoginResponse> {
    try {
      return await this.authService.login(user);
    } catch (error) {
      console.log(error.message);
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof UserAuthenticateException) {
        throw new UnauthorizedException(error.message);
      } else if (error instanceof UserNotVerifiedException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "user logout" })
  @ApiResponse({ status: 200, type: LogoutResponse, description: "user has been successfully logged out" })
  @ApiBearerAuth()
  @UsePipes(ValidationPipe)
  @UseGuards(JwtAuthGuard)
  @Patch()
  async logout(@CurrentUser() user: CurrentUserDecorator, @Body() token: TokenDto): Promise<LogoutResponse> {
    try {
      return await this.authService.logout(user.id, token.refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "get new access and refresh tokens" })
  @ApiResponse({ status: 200, type: LoginResponse, description: "tokens has been successfully refreshed" })
  @UsePipes(ValidationPipe)
  @Patch("tokens")
  async getNewTokens(@Body() token: TokenDto): Promise<LoginResponse> {
    try {
      return await this.authService.getNewToken(token.refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @ApiOperation({ summary: "update credentials" })
  @ApiResponse({ status: 200, type: User, description: "credentials has been successfully updated" })
  @ApiBearerAuth()
  @UsePipes(ValidationPipe)
  @UseGuards(JwtAuthGuard)
  @Patch("credentials")
  async updateUser(@CurrentUser() user: CurrentUserDecorator, @Body() userInfo: UpdateCredentialsDto): Promise<User> {
    try {
      return await this.authService.updateCredentials(user.id, userInfo);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }
}
