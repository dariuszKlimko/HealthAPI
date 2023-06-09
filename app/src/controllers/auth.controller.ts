import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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
import { AuthService } from "@app/services/auth.service";
import { CurrentUser } from "@app/common/decorators/currentUser.decorator";
import { HttpExceptionFilter } from "@app/common/filter/HttpException.filter";
import { LoginResponse } from "@app/common/types/auth/login-response";
import { UserNotFoundException } from "@app/common/exceptions/userNotFound.exception";
import { UserAuthenticateException } from "@app/common/exceptions/auth/userAuthenticate.exception";
import { MessageInfo } from "@app/common/types/messageInfo";
import { JwtAuthGuard } from "@app/common/guards/jwt-auth.guard";
import { InvalidRefreshTokenException } from "@app/common/exceptions/auth/invalidRefreshToken.exception";
import { CurrentUserDecorator } from "@app/common/types/currentUserDecorator";
import { LogoutResponse } from "@app/common/types/auth/logout-response";
import { TokenDto } from "@app/dtos/auth/token.dto";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { LoginDto } from "@app/dtos/auth/login.dto";
import { EmailDto } from "@app/dtos/auth/email.dto";
import { EmailService } from "@app/services/email.service";
import { UserAlreadyConfirmedException } from "@app/common/exceptions/auth/userAlreadyConfirmed.exception";
import { User } from "@app/entities/user.entity";
import { UpdateCredentialsDto } from "@app/dtos/auth/update-creadentials.dto";
import { ResetPasswordDto } from "@app/dtos/auth/password-reset.dto";
import { InvalidVerificationCodeException } from "@app/common/exceptions/auth/invalidVerificationCode.exception ";
import { EmailVerifiedGuard } from "@app/common/guards/email-verified.guard";
import { EmailExistGuard } from "@app/common/guards/email-exist.guard";

@ApiTags("auth")
@UseFilters(HttpExceptionFilter)
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly emailService: EmailService) {}

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
  @UseGuards(EmailExistGuard)
  @UsePipes(ValidationPipe)
  @HttpCode(200)
  @Post("resend-confirmation")
  async resendConfirmationLink(@Body() userInfo: EmailDto): Promise<MessageInfo> {
    try {
      const text = this.emailService.verificationEmailText(userInfo.email);
      const subject = "Account confirmation ✔";
      await this.emailService.sendEmail(userInfo.email, text, subject);
      return { status: "ok", message: "confirmation email has been resend" };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "user login" })
  @ApiResponse({ status: 201, type: LoginResponse, description: "user has been successfully logged in" })
  @UseGuards(EmailVerifiedGuard)
  @UsePipes(ValidationPipe)
  @Post()
  async login(@Body() user: LoginDto): Promise<LoginResponse> {
    try {
      return await this.authService.login(user);
    } catch (error) {
      if (error instanceof UserAuthenticateException) {
        throw new UnauthorizedException(error.message);
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
  async updateCredentials(
    @CurrentUser() user: CurrentUserDecorator,
    @Body() userInfo: UpdateCredentialsDto
  ): Promise<User> {
    try {
      return await this.authService.updateCredentials(user.id, userInfo);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "reset password" })
  @ApiResponse({ status: 200, type: MessageInfo, description: "verification code has been send" })
  @UsePipes(ValidationPipe)
  @UseGuards(EmailVerifiedGuard)
  @Patch("reset-password")
  async resetPassword(@Body() userInfo: EmailDto): Promise<MessageInfo> {
    try {
      const code = await this.authService.codeGenerator(userInfo.email);
      const text = this.emailService.resetPasswordEmailText(userInfo.email, code);
      const subject = "Reset password verification code ✔";
      await this.emailService.sendEmail(userInfo.email, text, subject);
      return { status: "ok", message: "verification code has been send" };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  @ApiOperation({ summary: "reset password confirmation" })
  @ApiResponse({ status: 200, type: MessageInfo, description: "password has been reset" })
  @UsePipes(ValidationPipe)
  @UseGuards(EmailVerifiedGuard)
  @Patch("reset-password-confirm")
  async resetPasswordConfirm(@Body() resetPassword: ResetPasswordDto): Promise<MessageInfo> {
    try {
      return await this.authService.resetPasswordConfirm(resetPassword);
    } catch (error) {
      if (error instanceof InvalidVerificationCodeException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException();
    }
  }
}
