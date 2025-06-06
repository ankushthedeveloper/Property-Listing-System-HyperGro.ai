import { AuthHeaderTokens } from "@constants/auth.constants";
import { StatusCode } from "@constants/common.constants";
import { ErrorMessages } from "@constants/error.constants";
import { AuthorizationTokens } from "@HyperTypes/middlewares.types";
import { Property } from "@models/property";
import { User } from "@models/user";
import { ApiError } from "@utils/apiResponse";
import { asyncHandler } from "@utils/asyncHandler";
import { getTokensFromHeaders, refreshTokenRotationUtil, verifyAccessToken, verifyRefreshToken } from "@utils/auth";
import { NextFunction, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { validateObjectId } from "validations/commonValidations";

export const verifyJWT = asyncHandler(
  async (req: any, res: Response, next: NextFunction) => {

    const { accessToken, refreshToken, authId } = getTokensFromHeaders(req);
    if (!accessToken || !refreshToken || !authId) {
      throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
    }
  
    validateObjectId(authId);

    let decodedAccess: JwtPayload | null = null;
    let decodedRefresh: JwtPayload | null = null;

    try {
      decodedAccess = verifyAccessToken(accessToken, process.env.ACCESS_TOKEN_SECRET!);
    } catch (error) {
      if ((error as Error).message === ErrorMessages.EXPIRED_ACCESS_TOKEN) {
        decodedRefresh = verifyRefreshToken(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
        if (authId !== decodedRefresh._id.toString()) {
          throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
        }

        req.user = await rotateTokens(req, res);
        return next();
      }
      throw error;
    }

    decodedRefresh = verifyRefreshToken(refreshToken, process.env.REFRESH_TOKEN_SECRET!);

    if (decodedAccess._id !== decodedRefresh._id) {
      throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
    }    
    req.user = await validateUser(decodedAccess, refreshToken, authId);
    next();
  }
);

export const setMiddlewareData = (res: Response, data: AuthorizationTokens) => {
  res.locals.middlewareData = data;
};

export const getMiddlewareData = (res: Response): AuthorizationTokens => {
  return res.locals.middlewareData;
};


// validate user
const validateUser = async (decodedAccess: JwtPayload, refreshToken: string, authId: string) => {
  if (!decodedAccess._id) {
    throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
  }

  const user:any = await User.findById(decodedAccess._id) ?? null;
  
  if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
    throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
  }

  if (authId !== user._id.toString()) {
    throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.NOT_AUTHORIZED);
  }
  return user;
};

// rotate tokens
const rotateTokens = async (req: any, res: Response) => {
  const { accessToken, refreshToken, user } = await refreshTokenRotationUtil(req);
  if (!accessToken || !refreshToken || !user) {
    throw new ApiError(StatusCode.UNAUTHORIZED, ErrorMessages.EXPIRED_ACCESS_TOKEN);
  }

  setMiddlewareData(res, {
    accessToken: { name: AuthHeaderTokens.AUTHORIZATION, value: accessToken },
    refreshToken: { name: AuthHeaderTokens.REFRESH_TOKEN, value: refreshToken },
  } as AuthorizationTokens)

  return user;
};