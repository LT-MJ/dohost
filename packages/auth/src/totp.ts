import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpProvisioningUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  return generateURI({ issuer: params.issuer, label: params.accountName, secret: params.secret });
}

export async function totpQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri);
}

export async function verifyTotpToken(params: { secret: string; token: string }): Promise<boolean> {
  try {
    const result = await verify({ secret: params.secret, token: params.token });
    return result.valid;
  } catch {
    return false;
  }
}
