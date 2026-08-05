import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";

import { AUTH_RSA_PRIVATE_KEY, AUTH_RSA_PUBLIC_KEY } from "@/constant/auth";

function randomAesKeyMaterial() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let out = "";
    for (let i = 0; i < 32; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export function encryptRequestBody(payload: unknown): { body: string; encryptKey: string } {
    const aesKey = CryptoJS.enc.Utf8.parse(randomAesKeyMaterial());
    const encryptedBody = CryptoJS.AES.encrypt(JSON.stringify(payload), aesKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    }).toString();

    const rsa = new JSEncrypt();
    rsa.setPublicKey(AUTH_RSA_PUBLIC_KEY);
    const encryptKey = rsa.encrypt(CryptoJS.enc.Base64.stringify(aesKey));
    if (!encryptKey) throw new Error("Request encryption failed");

    return { body: encryptedBody, encryptKey };
}

export function decryptResponseBody(encryptedBody: string, encryptKeyHeader: string): unknown {
    const rsa = new JSEncrypt();
    rsa.setPrivateKey(AUTH_RSA_PRIVATE_KEY);
    const base64Key = rsa.decrypt(encryptKeyHeader);
    if (!base64Key) throw new Error("Response decryption failed");

    const aesKey = CryptoJS.enc.Base64.parse(base64Key);
    const decrypted = CryptoJS.AES.decrypt(encryptedBody, aesKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("Response decryption failed");
    return JSON.parse(decrypted);
}
